"""Bulk import adapter for Strava's bulk archive export.

Accepts either the activities.csv directly or the full export .zip that contains it.
Only parses activities.csv (no per-activity GPS/FIT files in v1).
"""
from __future__ import annotations

import csv
import io
import logging
import zipfile
from datetime import datetime, timezone

from models import SourceEnum, WorkoutTypeEnum
from services.ingestion.base import IngestResult, NormalizedWorkout

logger = logging.getLogger(__name__)

_ACTIVITY_TYPE_MAP: dict[str, WorkoutTypeEnum] = {
    "run":            WorkoutTypeEnum.running,
    "trailrun":       WorkoutTypeEnum.running,
    "virtualrun":     WorkoutTypeEnum.running,
    "ride":           WorkoutTypeEnum.cycling,
    "virtualride":    WorkoutTypeEnum.cycling,
    "ebikeride":      WorkoutTypeEnum.cycling,
    "walk":           WorkoutTypeEnum.walking,
    "hike":           WorkoutTypeEnum.walking,
    "weighttraining": WorkoutTypeEnum.strength,
    "crossfit":       WorkoutTypeEnum.strength,
    "workout":        WorkoutTypeEnum.strength,
    "swim":           WorkoutTypeEnum.other,
    "rowing":         WorkoutTypeEnum.other,
}

_DATE_FMTS = [
    "%b %d, %Y, %I:%M:%S %p",  # "Jan 15, 2024, 07:30:00 AM"
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
]


def _norm_row(row: dict) -> dict[str, str]:
    return {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()}


def _parse_date(s: str) -> datetime | None:
    s = s.strip()
    if not s:
        return None
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _map_type(raw: str) -> WorkoutTypeEnum:
    key = raw.lower().replace(" ", "").replace("_", "")
    return _ACTIVITY_TYPE_MAP.get(key, WorkoutTypeEnum.other)


def _to_float(s: str) -> float | None:
    try:
        return float(s) if s else None
    except ValueError:
        return None


def _to_int(s: str) -> int | None:
    try:
        return int(float(s)) if s else None
    except ValueError:
        return None


def parse_csv_content(content: str) -> IngestResult:
    reader = csv.DictReader(io.StringIO(content))
    workouts: list[NormalizedWorkout] = []

    for raw_row in reader:
        row = _norm_row(raw_row)

        # Identify the activity ID column (case-insensitive)
        activity_id = (
            row.get("activity_id")
            or row.get("id")
            or row.get("activity_#")
            or ""
        )
        if not activity_id:
            continue

        activity_type = row.get("activity_type", "")
        date_str = row.get("activity_date", "") or row.get("date", "") or row.get("start_date", "")
        start_at = _parse_date(date_str)
        if not start_at:
            continue

        # Duration: prefer elapsed time, fall back to moving time
        elapsed = _to_float(row.get("elapsed_time", "") or row.get("elapsed_time_(s)", ""))
        moving = _to_float(row.get("moving_time", "") or row.get("moving_time_(s)", ""))
        duration_secs = elapsed or moving or 0.0
        duration_mins = duration_secs / 60

        # Distance (Strava exports in meters for metric users, check unit column if present)
        distance_raw = _to_float(row.get("distance", "") or row.get("distance_(km)", ""))
        dist_unit = row.get("distance_unit", "").lower()
        if dist_unit in ("mi", "miles"):
            distance_km = (distance_raw or 0) * 1.60934
        elif dist_unit in ("m", "meters"):
            distance_km = (distance_raw or 0) / 1000
        else:
            # Strava bulk export uses km by default in metric
            distance_km = distance_raw

        calories = _to_float(row.get("calories", ""))
        avg_hr = _to_float(
            row.get("average_heart_rate", "")
            or row.get("average_heartrate", "")
            or row.get("avg_heart_rate", "")
        )
        max_hr = _to_float(
            row.get("max_heart_rate", "")
            or row.get("max_heartrate", "")
        )

        workouts.append(NormalizedWorkout(
            source=SourceEnum.strava,
            external_id=f"strava_csv:{activity_id}",
            workout_type=_map_type(activity_type),
            raw_type=activity_type,
            start_at=start_at,
            duration_mins=duration_mins,
            distance_km=distance_km,
            active_calories=calories,
            avg_heart_rate=avg_hr,
            max_heart_rate=max_hr,
        ))

    return IngestResult(workouts=workouts)


def parse_file(file_path: str) -> IngestResult:
    """Accept a .zip (Strava bulk archive) or a plain activities.csv."""
    if file_path.lower().endswith(".zip"):
        with zipfile.ZipFile(file_path) as zf:
            names = zf.namelist()
            csv_entry = next((n for n in names if n.lower().endswith("activities.csv")), None)
            if not csv_entry:
                raise ValueError("activities.csv not found in Strava zip archive")
            content = zf.read(csv_entry).decode("utf-8", errors="replace")
    else:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            content = f.read()

    return parse_csv_content(content)
