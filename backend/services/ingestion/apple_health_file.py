"""Bulk import adapter for Apple Health's Export All Health Data archive.

Accepts either the raw export.xml or the export.zip that wraps it.
Stream-parses with lxml.etree.iterparse to avoid loading the entire (potentially
hundreds-of-MB) file into memory.
"""
from __future__ import annotations

import logging
import os
import shutil
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Generator

from lxml import etree

from models import SourceEnum, WorkoutTypeEnum
from services.ingestion.base import (
    IngestResult,
    NormalizedMetric,
    NormalizedWorkout,
)

logger = logging.getLogger(__name__)

# HKQuantityTypeIdentifier → (metric_type, unit, conversion_factor_to_canonical)
_METRIC_MAP: dict[str, tuple[str, str, float]] = {
    "HKQuantityTypeIdentifierBodyMass":           ("weight_kg",      "kg",    1.0),
    "HKQuantityTypeIdentifierBodyMassIndex":       ("bmi",            "",      1.0),
    "HKQuantityTypeIdentifierRestingHeartRate":    ("resting_hr",     "bpm",   1.0),
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": ("hrv",       "ms",    1.0),
    "HKQuantityTypeIdentifierStepCount":           ("steps",          "steps", 1.0),
    "HKQuantityTypeIdentifierActiveEnergyBurned":  ("active_energy",  "kcal",  1.0),
    "HKQuantityTypeIdentifierVO2Max":              ("vo2max",         "mL/kg/min", 1.0),
    "HKQuantityTypeIdentifierBodyFatPercentage":   ("body_fat_pct",   "%",     100.0),  # 0-1 → 0-100
}

_WORKOUT_TYPE_MAP: dict[str, WorkoutTypeEnum] = {
    "HKWorkoutActivityTypeRunning":          WorkoutTypeEnum.running,
    "HKWorkoutActivityTypeCycling":          WorkoutTypeEnum.cycling,
    "HKWorkoutActivityTypeWalking":          WorkoutTypeEnum.walking,
    "HKWorkoutActivityTypeHiking":           WorkoutTypeEnum.walking,
    "HKWorkoutActivityTypeTraditionalStrengthTraining": WorkoutTypeEnum.strength,
    "HKWorkoutActivityTypeFunctionalStrengthTraining":  WorkoutTypeEnum.strength,
    "HKWorkoutActivityTypeCrossTraining":    WorkoutTypeEnum.strength,
}

_SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis"
_SLEEP_ASLEEP_VALUES = {
    "HKCategoryValueSleepAnalysisAsleepUnspecified",
    "HKCategoryValueSleepAnalysisAsleepCore",
    "HKCategoryValueSleepAnalysisAsleepREM",
    "HKCategoryValueSleepAnalysisAsleepDeep",
    "HKCategoryValueSleepAnalysisAsleep",
}


def _parse_dt(s: str) -> datetime:
    """Parse Apple Health date strings like '2024-03-15 08:00:00 +0800'."""
    # Replace the space before timezone offset with a +/- that fromisoformat accepts
    s = s.strip()
    # Python 3.11+ handles this directly; for 3.10 compatibility we normalise
    if " +" in s or " -" in s:
        # "2024-03-15 08:00:00 +0800" → "2024-03-15T08:00:00+0800"
        parts = s.rsplit(" ", 1)
        s = parts[0].replace(" ", "T") + parts[1]
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _lb_to_kg(v: float) -> float:
    return v * 0.45359237


def _mi_to_km(v: float) -> float:
    return v * 1.60934


def _xml_stream(path: str) -> Generator[etree._Element, None, None]:
    context = etree.iterparse(path, events=("end",), tag=("Record", "Workout"))
    for _, elem in context:
        yield elem
        elem.clear()


class AppleHealthFileAdapter:
    source_name = "apple_health"

    def parse_file(self, file_path: str) -> IngestResult:
        """Parse export.zip or export.xml at file_path and return IngestResult."""
        if not file_path.lower().endswith(".zip"):
            return self._parse_xml(file_path)

        xml_path = self._extract_xml(file_path)
        try:
            return self._parse_xml(xml_path)
        finally:
            try:
                os.remove(xml_path)
            except OSError:
                pass

    def _extract_xml(self, zip_path: str) -> str:
        import tempfile
        with zipfile.ZipFile(zip_path) as zf:
            names = zf.namelist()
            xml_entry = next(
                (n for n in names if n.endswith("export.xml") and "export_cda" not in n),
                None,
            )
            if not xml_entry:
                raise ValueError("export.xml not found inside zip")
            fd, tmp = tempfile.mkstemp(suffix=".xml")
            try:
                with zf.open(xml_entry) as src, os.fdopen(fd, "wb") as dst:
                    shutil.copyfileobj(src, dst)
            except Exception:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
                raise
        return tmp

    def _parse_xml(self, xml_path: str) -> IngestResult:
        workouts: list[NormalizedWorkout] = []
        metrics: list[NormalizedMetric] = []
        errors: list[str] = []

        # Sleep intervals keyed by night date (prev-day if before noon)
        sleep_intervals: dict[date, float] = defaultdict(float)

        for elem in _xml_stream(xml_path):
            tag = elem.tag
            try:
                if tag == "Record":
                    rec_type = elem.get("type", "")
                    if rec_type in _METRIC_MAP:
                        m = self._parse_metric(elem, rec_type)
                        if m:
                            metrics.append(m)
                    elif rec_type == _SLEEP_TYPE:
                        self._accumulate_sleep(elem, sleep_intervals)
                elif tag == "Workout":
                    w = self._parse_workout(elem)
                    if w:
                        workouts.append(w)
            except Exception as exc:
                errors.append(str(exc))

        # Convert sleep_intervals → metrics
        for night, hours in sleep_intervals.items():
            dt = datetime(night.year, night.month, night.day, 4, 0, tzinfo=timezone.utc)
            metrics.append(NormalizedMetric(
                metric_type="sleep_hours",
                value=round(hours, 2),
                unit="h",
                recorded_at=dt,
                date=night,
                source=SourceEnum.apple_health,
                external_id=f"sleep_hours:{night.isoformat()}",
            ))

        if errors:
            logger.warning("Apple Health import: %d parse errors", len(errors))

        return IngestResult(workouts=workouts, metrics=metrics)

    def _parse_metric(self, elem: etree._Element, rec_type: str) -> NormalizedMetric | None:
        metric_type, canonical_unit, factor = _METRIC_MAP[rec_type]
        raw_val = elem.get("value")
        raw_unit = (elem.get("unit") or "").lower()
        start_str = elem.get("startDate") or elem.get("creationDate") or ""
        if not raw_val or not start_str:
            return None

        value = float(raw_val) * factor

        # Unit conversions
        if metric_type == "weight_kg" and raw_unit in ("lb", "lbs"):
            value = _lb_to_kg(float(raw_val))

        recorded_at = _parse_dt(start_str)
        day = recorded_at.date()
        external_id = f"{rec_type}:{start_str}:{raw_val}"

        return NormalizedMetric(
            metric_type=metric_type,
            value=value,
            unit=canonical_unit,
            recorded_at=recorded_at,
            date=day,
            source=SourceEnum.apple_health,
            external_id=external_id,
        )

    def _accumulate_sleep(self, elem: etree._Element, acc: dict[date, float]) -> None:
        value = elem.get("value", "")
        if value not in _SLEEP_ASLEEP_VALUES:
            return
        start_str = elem.get("startDate") or ""
        end_str = elem.get("endDate") or ""
        if not start_str or not end_str:
            return
        start = _parse_dt(start_str)
        end = _parse_dt(end_str)
        hours = (end - start).total_seconds() / 3600
        if hours <= 0:
            return
        # Attribute to the night: if before noon, previous calendar day
        night = start.date() if start.hour >= 12 else (start - timedelta(days=1)).date()
        acc[night] += hours

    def _parse_workout(self, elem: etree._Element) -> NormalizedWorkout | None:
        raw_type = elem.get("workoutActivityType", "")
        start_str = elem.get("startDate") or ""
        end_str = elem.get("endDate") or ""
        duration_str = elem.get("duration") or "0"
        if not start_str:
            return None

        start_at = _parse_dt(start_str)
        end_at = _parse_dt(end_str) if end_str else None
        duration_mins = float(duration_str)

        # Calories
        cal_str = elem.get("totalEnergyBurned") or "0"
        calories = float(cal_str) if cal_str else None
        cal_unit = (elem.get("totalEnergyBurnedUnit") or "").lower()
        if cal_unit == "kj" and calories:
            calories = calories / 4.184

        # Distance
        dist_str = elem.get("totalDistance") or "0"
        distance_km = float(dist_str) if dist_str else None
        dist_unit = (elem.get("totalDistanceUnit") or "").lower()
        if dist_unit in ("mi", "miles") and distance_km:
            distance_km = _mi_to_km(distance_km)

        workout_type = _WORKOUT_TYPE_MAP.get(raw_type, WorkoutTypeEnum.other)
        external_id = f"{raw_type}:{start_str}:{duration_str}"

        return NormalizedWorkout(
            source=SourceEnum.apple_health,
            external_id=external_id,
            workout_type=workout_type,
            raw_type=raw_type,
            start_at=start_at,
            end_at=end_at,
            duration_mins=duration_mins,
            active_calories=calories,
            distance_km=distance_km,
        )
