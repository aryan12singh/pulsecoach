"""Hevy API adapter (on-demand pull). Only instantiated when ENABLE_HEVY=true."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from models import SourceEnum, WeightUnitEnum, WorkoutTypeEnum
from services.ingestion.base import (
    IngestResult,
    NormalizedStrengthSet,
    NormalizedWorkout,
    SourceAdapter,
)

logger = logging.getLogger(__name__)

HEVY_BASE_URL = "https://api.hevyapp.com/v1"


class HevyAdapter(SourceAdapter):
    source_name = "hevy"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    # ── Pull from API ──────────────────────────────────────────────────────────

    async def pull_and_normalize(self, page_size: int = 50) -> IngestResult:
        """Fetch all workouts from Hevy API and normalise them."""
        workouts_raw = await self._fetch_all_workouts(page_size)
        return self.normalize({"workouts": workouts_raw})

    async def fetch_one_and_normalize(self, workout_id: str) -> IngestResult:
        """Fetch a single workout by id (used by the webhook receiver)."""
        async with httpx.AsyncClient(
            headers={"api-key": self._api_key}, timeout=30,
        ) as client:
            resp = await client.get(f"{HEVY_BASE_URL}/workouts/{workout_id}")
            resp.raise_for_status()
            body = resp.json()
        # Hevy may return the workout bare or wrapped in {"workout": {...}}
        workout = body.get("workout", body)
        return self.normalize({"workouts": [workout]})

    async def _fetch_all_workouts(self, page_size: int) -> list[dict]:
        all_workouts: list[dict] = []
        page = 1
        async with httpx.AsyncClient(
            headers={"api-key": self._api_key},
            timeout=30,
        ) as client:
            while True:
                resp = await client.get(
                    f"{HEVY_BASE_URL}/workouts",
                    params={"page": page, "pageSize": page_size},
                )
                resp.raise_for_status()
                body = resp.json()
                workouts = body.get("workouts", [])
                all_workouts.extend(workouts)
                if len(workouts) < page_size:
                    break
                page += 1
        return all_workouts

    # ── Normalise ──────────────────────────────────────────────────────────────

    def normalize(self, payload: Any) -> IngestResult:
        result = IngestResult()

        for raw in payload.get("workouts", []):
            try:
                nw, sets = self._parse_workout(raw)
                result.workouts.append(nw)
                if sets:
                    result.strength_sets[nw.external_id or ""] = sets
            except Exception as exc:
                logger.warning("Skipping Hevy workout: %s — %s", raw.get("id"), exc)

        return result

    def _parse_workout(self, raw: dict) -> tuple[NormalizedWorkout, list[NormalizedStrengthSet]]:
        start_at = self._parse_dt(raw.get("start_time") or raw.get("created_at"))
        end_raw = raw.get("end_time")
        end_at = self._parse_dt(end_raw) if end_raw else None
        duration_mins = float(raw.get("duration", 0)) / 60 if raw.get("duration") else (
            (end_at - start_at).total_seconds() / 60 if end_at else 0.0
        )

        nw = NormalizedWorkout(
            source=SourceEnum.hevy,
            external_id=str(raw["id"]),
            workout_type=WorkoutTypeEnum.strength,
            raw_type=raw.get("title", "Strength Workout"),
            start_at=start_at,
            end_at=end_at,
            duration_mins=round(duration_mins, 2),
            raw_data=raw,
        )

        sets: list[NormalizedStrengthSet] = []
        for ex_idx, exercise in enumerate(raw.get("exercises", [])):
            ex_name = exercise.get("title") or exercise.get("exercise_template", {}).get("title", "Unknown")
            for set_idx, s in enumerate(exercise.get("sets", [])):
                # weight_kg is already kilograms regardless of the user's display
                # unit; only a bare "weight" needs converting when the unit is lb.
                unit_str = s.get("weight_unit", "kg").lower()
                if s.get("weight_kg") is not None:
                    weight = s["weight_kg"]
                elif s.get("weight") is not None and unit_str == "lb":
                    weight = s["weight"] * 0.45359237
                else:
                    weight = s.get("weight")
                sets.append(NormalizedStrengthSet(
                    exercise_name=ex_name,
                    exercise_order=ex_idx,
                    set_number=set_idx + 1,
                    reps=s.get("reps"),
                    weight=weight,
                    weight_unit=WeightUnitEnum.kg,
                    rpe=s.get("rpe"),
                    duration_seconds=s.get("duration_seconds"),
                    distance_m=s.get("distance_meters"),
                    is_warmup=s.get("indicator") == "warmup",
                ))

        return nw, sets

    @staticmethod
    def _parse_dt(raw: str | int | None) -> datetime:
        if raw is None:
            return datetime.now(timezone.utc)
        if isinstance(raw, int):
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S %z", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                dt = datetime.strptime(raw, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        raise ValueError(f"Cannot parse datetime: {raw!r}")
