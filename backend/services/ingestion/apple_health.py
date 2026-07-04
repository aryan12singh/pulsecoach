"""Apple Health via Health Auto Export adapter."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from models import SourceEnum, WorkoutTypeEnum
from services.ingestion.base import (
    IngestResult,
    NormalizedMetric,
    NormalizedWorkout,
    SourceAdapter,
)

logger = logging.getLogger(__name__)

_TYPE_MAP: dict[str, WorkoutTypeEnum] = {
    "traditional strength training": WorkoutTypeEnum.strength,
    "functional strength training": WorkoutTypeEnum.strength,
    "high intensity interval training": WorkoutTypeEnum.strength,
    "running": WorkoutTypeEnum.running,
    "outdoor run": WorkoutTypeEnum.running,
    "treadmill running": WorkoutTypeEnum.running,
    "cycling": WorkoutTypeEnum.cycling,
    "indoor cycling": WorkoutTypeEnum.cycling,
    "outdoor cycling": WorkoutTypeEnum.cycling,
    "walking": WorkoutTypeEnum.walking,
    "outdoor walk": WorkoutTypeEnum.walking,
}

_METRIC_MAP: dict[str, tuple[str, str]] = {
    "weight_body_mass": ("weight_kg", "kg"),
    "body_mass": ("weight_kg", "kg"),
    "body_mass_index": ("bmi", "kg/m²"),
    "bmi": ("bmi", "kg/m²"),
    "resting_heart_rate": ("resting_hr", "bpm"),
    "heart_rate_variability_sdnn": ("hrv", "ms"),
    "hrv": ("hrv", "ms"),
    "sleep_analysis": ("sleep_hours", "hours"),
    "step_count": ("steps", "steps"),
    "steps": ("steps", "steps"),
    "active_energy_burned": ("active_energy", "kcal"),
    "body_fat_percentage": ("body_fat_pct", "%"),
    "vo2_max": ("vo2max", "mL/kg/min"),
}


def _parse_dt(raw: str) -> datetime | None:
    for fmt in (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _normalize_workout_type(raw: str) -> WorkoutTypeEnum:
    return _TYPE_MAP.get(raw.lower(), WorkoutTypeEnum.other)


class AppleHealthAdapter(SourceAdapter):
    source_name = "apple_health"

    def normalize(self, payload: Any) -> IngestResult:
        result = IngestResult()

        data = payload.get("data", payload)

        for raw in data.get("workouts", []):
            try:
                result.workouts.append(self._parse_workout(raw))
            except Exception as exc:
                logger.warning("Skipping malformed workout: %s — %s", raw, exc)

        for raw in data.get("metrics", []):
            try:
                result.metrics.extend(self._parse_metric(raw))
            except Exception as exc:
                logger.warning("Skipping malformed metric: %s — %s", raw, exc)

        return result

    def _parse_workout(self, raw: dict) -> NormalizedWorkout:
        name = raw.get("name", "")
        start = _parse_dt(str(raw["start"])) or datetime.now(timezone.utc)
        end = _parse_dt(str(raw["end"])) if raw.get("end") else None
        duration_mins = (end - start).total_seconds() / 60 if end else 0.0

        calories = None
        cal_data = raw.get("activeEnergyBurned")
        if isinstance(cal_data, dict):
            calories = float(cal_data.get("qty", 0)) or None

        avg_hr = max_hr = None
        hr_data = raw.get("heartRateData", [])
        if hr_data and isinstance(hr_data, list) and isinstance(hr_data[0], dict):
            avg_hr = float(hr_data[0].get("Avg", 0)) or None
            max_hr = float(hr_data[0].get("Max", 0)) or None

        distance_km = None
        dist_data = raw.get("distance")
        if isinstance(dist_data, dict):
            qty = float(dist_data.get("qty", 0))
            unit = dist_data.get("units", "km").lower()
            if qty:
                if unit in ("mi", "miles"):
                    distance_km = qty * 1.60934
                elif unit in ("m", "meters"):
                    distance_km = qty / 1000
                else:
                    distance_km = qty

        return NormalizedWorkout(
            source=SourceEnum.apple_health,
            workout_type=_normalize_workout_type(name),
            raw_type=name,
            start_at=start,
            end_at=end,
            duration_mins=round(duration_mins, 2),
            active_calories=calories,
            avg_heart_rate=avg_hr,
            max_heart_rate=max_hr,
            distance_km=distance_km,
            raw_data=raw,
        )

    def _parse_metric(self, raw: dict) -> list[NormalizedMetric]:
        name = raw.get("name", "").lower().replace(" ", "_")
        mapped = _METRIC_MAP.get(name)
        if not mapped:
            return []

        metric_type, unit = mapped
        records = raw.get("data", [])
        results: list[NormalizedMetric] = []

        for entry in records:
            try:
                dt_raw = entry.get("date") or entry.get("startDate")
                if not dt_raw:
                    continue
                dt = _parse_dt(str(dt_raw))
                if not dt:
                    continue
                qty = entry.get("qty") or entry.get("value")
                if qty is None:
                    continue
                value = float(qty)
                if metric_type == "sleep_hours":
                    # Apple reports sleep in hours already in sleep_analysis
                    pass
                results.append(NormalizedMetric(
                    metric_type=metric_type,
                    value=value,
                    unit=raw.get("units", unit),
                    recorded_at=dt,
                    date=dt.date(),
                    source=SourceEnum.apple_health,
                    raw_data=entry,
                ))
            except Exception as exc:
                logger.warning("Skipping metric entry: %s — %s", entry, exc)

        return results
