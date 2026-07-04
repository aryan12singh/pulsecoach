from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from models import SourceEnum, WeightUnitEnum, WorkoutTypeEnum


class NormalizedWorkout(BaseModel):
    source: SourceEnum
    external_id: str | None = None
    workout_type: WorkoutTypeEnum
    raw_type: str | None = None
    start_at: datetime
    end_at: datetime | None = None
    duration_mins: float
    active_calories: float | None = None
    avg_heart_rate: float | None = None
    max_heart_rate: float | None = None
    distance_km: float | None = None
    raw_data: dict | None = None


class NormalizedStrengthSet(BaseModel):
    exercise_name: str
    exercise_order: int
    set_number: int
    reps: int | None = None
    weight: float | None = None
    weight_unit: WeightUnitEnum = WeightUnitEnum.kg
    rpe: float | None = None
    duration_seconds: float | None = None
    distance_m: float | None = None
    is_warmup: bool = False


class NormalizedMetric(BaseModel):
    metric_type: str
    value: float
    unit: str
    recorded_at: datetime
    date: date
    source: SourceEnum
    external_id: str | None = None
    raw_data: dict | None = None


class IngestResult(BaseModel):
    workouts: list[NormalizedWorkout] = []
    # keyed by workout external_id (or a synthetic key for workouts without one)
    strength_sets: dict[str, list[NormalizedStrengthSet]] = {}
    metrics: list[NormalizedMetric] = []


class SourceAdapter(ABC):
    source_name: str

    @abstractmethod
    def normalize(self, payload: Any) -> IngestResult:
        ...
