"""Bulk import adapter for Hevy's CSV export (no Pro subscription required).

Hevy exports two files:
- Workout CSV  (set-by-set rows, one row per set)
- Measurements CSV (body measurements per date)

A single endpoint accepts one or both files; this module detects which is which
by inspecting the header row.
"""
from __future__ import annotations

import csv
import io
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from models import SourceEnum, WorkoutTypeEnum, WeightUnitEnum
from services.ingestion.base import (
    IngestResult,
    NormalizedMetric,
    NormalizedStrengthSet,
    NormalizedWorkout,
)

logger = logging.getLogger(__name__)

# Hevy measurement CSV date format: "24 May 2025, 09:30" or "24 May 2025, 09:30:00"
_MEASUREMENT_DATE_FMTS = [
    "%d %b %Y, %H:%M:%S",
    "%d %b %Y, %H:%M",
]


def _norm_headers(row: dict) -> dict[str, str]:
    return {k.strip().lower(): v for k, v in row.items()}


def _is_workout_csv(headers: list[str]) -> bool:
    lowered = {h.lower() for h in headers}
    return "exercise_title" in lowered or "set_index" in lowered


def _is_measurement_csv(headers: list[str]) -> bool:
    lowered = {h.lower() for h in headers}
    return "weight_kg" in lowered and "fat_percent" in lowered


def _parse_workout_csv(content: str) -> IngestResult:
    reader = csv.DictReader(io.StringIO(content))
    # Group rows by (title, start_time) → workout key
    groups: dict[str, list[dict]] = defaultdict(list)
    for raw_row in reader:
        row = _norm_headers(raw_row)
        title = row.get("title", "").strip()
        start_time = row.get("start_time", "").strip()
        key = f"{start_time}|{title}"
        groups[key].append(row)

    workouts: list[NormalizedWorkout] = []
    strength_sets: dict[str, list[NormalizedStrengthSet]] = {}

    for key, rows in groups.items():
        first = rows[0]
        title = first.get("title", "").strip()
        start_str = first.get("start_time", "").strip()
        end_str = first.get("end_time", "").strip()

        if not start_str:
            continue

        try:
            start_at = _parse_hevy_dt(start_str)
            end_at = _parse_hevy_dt(end_str) if end_str else None
        except Exception:
            logger.warning("Hevy CSV: could not parse date %r — skipping", start_str)
            continue

        duration_mins = (end_at - start_at).total_seconds() / 60 if end_at else 0.0
        external_id = f"hevy_csv:{start_str}:{title}"

        workout = NormalizedWorkout(
            source=SourceEnum.hevy,
            external_id=external_id,
            workout_type=WorkoutTypeEnum.strength,
            raw_type="hevy_csv",
            start_at=start_at,
            end_at=end_at,
            duration_mins=duration_mins,
        )
        workouts.append(workout)

        sets: list[NormalizedStrengthSet] = []
        # Track exercise order (first appearance of each exercise_title)
        exercise_order_map: dict[str, int] = {}

        for row in rows:
            exercise_name = row.get("exercise_title", "").strip()
            if not exercise_name:
                continue

            if exercise_name not in exercise_order_map:
                exercise_order_map[exercise_name] = len(exercise_order_map)

            try:
                set_number = int(row.get("set_index", "0") or "0")
            except ValueError:
                set_number = 0

            try:
                reps = int(row.get("reps", "") or "") if row.get("reps") else None
            except ValueError:
                reps = None

            try:
                weight = float(row.get("weight_kg", "") or "") if row.get("weight_kg") else None
            except ValueError:
                weight = None

            try:
                rpe = float(row.get("rpe", "") or "") if row.get("rpe") else None
            except ValueError:
                rpe = None

            try:
                duration_seconds = float(row.get("duration_seconds", "") or "") if row.get("duration_seconds") else None
            except ValueError:
                duration_seconds = None

            set_type = (row.get("set_type") or "").lower()
            is_warmup = set_type in ("warmup", "warm_up", "warm-up")

            sets.append(NormalizedStrengthSet(
                exercise_name=exercise_name,
                exercise_order=exercise_order_map[exercise_name],
                set_number=set_number,
                reps=reps,
                weight=weight,
                weight_unit=WeightUnitEnum.kg,
                rpe=rpe,
                duration_seconds=duration_seconds,
                is_warmup=is_warmup,
            ))

        strength_sets[external_id] = sets

    return IngestResult(workouts=workouts, strength_sets=strength_sets)


def _parse_measurement_csv(content: str) -> IngestResult:
    reader = csv.DictReader(io.StringIO(content))
    metrics: list[NormalizedMetric] = []

    for raw_row in reader:
        row = _norm_headers(raw_row)
        date_str = row.get("date", "").strip()
        if not date_str:
            continue

        try:
            recorded_at = _parse_measurement_dt(date_str)
        except Exception:
            logger.warning("Hevy measurements: could not parse date %r — skipping", date_str)
            continue

        day = recorded_at.date()

        if row.get("weight_kg"):
            try:
                val = float(row["weight_kg"])
                metrics.append(NormalizedMetric(
                    metric_type="weight_kg",
                    value=val,
                    unit="kg",
                    recorded_at=recorded_at,
                    date=day,
                    source=SourceEnum.hevy,
                    external_id=f"hevy_measurement:weight_kg:{date_str}",
                ))
            except ValueError:
                pass

        if row.get("fat_percent"):
            try:
                val = float(row["fat_percent"])
                metrics.append(NormalizedMetric(
                    metric_type="body_fat_pct",
                    value=val,
                    unit="%",
                    recorded_at=recorded_at,
                    date=day,
                    source=SourceEnum.hevy,
                    external_id=f"hevy_measurement:body_fat_pct:{date_str}",
                ))
            except ValueError:
                pass

    return IngestResult(metrics=metrics)


def _parse_hevy_dt(s: str) -> datetime:
    """Parse Hevy workout CSV timestamps (ISO-like or locale-formatted)."""
    s = s.strip()
    # Try ISO first
    try:
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    raise ValueError(f"Cannot parse Hevy datetime: {s!r}")


def _parse_measurement_dt(s: str) -> datetime:
    for fmt in _MEASUREMENT_DATE_FMTS:
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse measurement date: {s!r}")


def parse_csv_file(content: str) -> IngestResult:
    """Auto-detect CSV type from headers and parse accordingly."""
    sample = content[:4096]
    try:
        reader = csv.reader(io.StringIO(sample))
        headers = next(reader, [])
    except Exception:
        raise ValueError("Could not read CSV headers")

    if _is_workout_csv(headers):
        return _parse_workout_csv(content)
    elif _is_measurement_csv(headers):
        return _parse_measurement_csv(content)
    else:
        # Best-effort: try workout, then measurements
        try:
            return _parse_workout_csv(content)
        except Exception:
            return _parse_measurement_csv(content)
