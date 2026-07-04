from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from models import (
    ComparisonEnum,
    MetricScopeEnum,
    SourceEnum,
    WeightUnitEnum,
    WindowEnum,
    WorkoutTypeEnum,
)

# ── Strength sets ──────────────────────────────────────────────────────────────

class StrengthSetIn(BaseModel):
    exercise_name: str
    # Both derived server-side from row order when omitted (manual logging)
    exercise_order: int | None = None
    set_number: int | None = None
    reps: int | None = None
    weight: float | None = None
    weight_unit: WeightUnitEnum = WeightUnitEnum.kg
    rpe: float | None = None
    duration_seconds: float | None = None
    distance_m: float | None = None
    is_warmup: bool = False


class StrengthSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workout_id: int
    exercise_name: str
    exercise_order: int
    set_number: int
    reps: int | None
    weight: float | None
    weight_unit: WeightUnitEnum
    rpe: float | None
    duration_seconds: float | None
    distance_m: float | None
    is_warmup: bool


# ── Workouts ───────────────────────────────────────────────────────────────────

class WorkoutIn(BaseModel):
    source: SourceEnum = SourceEnum.manual
    workout_type: WorkoutTypeEnum
    raw_type: str | None = None
    start_at: datetime
    end_at: datetime | None = None
    duration_mins: float
    active_calories: float | None = None
    avg_heart_rate: float | None = None
    max_heart_rate: float | None = None
    distance_km: float | None = None
    sets: list[StrengthSetIn] = []


class WorkoutUpdate(BaseModel):
    """Partial update; `sets` replaces all strength sets when provided."""
    workout_type: WorkoutTypeEnum | None = None
    raw_type: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    duration_mins: float | None = None
    active_calories: float | None = None
    avg_heart_rate: float | None = None
    max_heart_rate: float | None = None
    distance_km: float | None = None
    sets: list[StrengthSetIn] | None = None


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: SourceEnum
    external_id: str | None
    workout_type: WorkoutTypeEnum
    raw_type: str | None
    start_at: datetime
    end_at: datetime | None
    duration_mins: float
    active_calories: float | None
    avg_heart_rate: float | None
    max_heart_rate: float | None
    distance_km: float | None
    has_strength_detail: bool
    created_at: datetime
    updated_at: datetime


class WorkoutDetail(WorkoutOut):
    strength_sets: list[StrengthSetOut] = []


class WeeklySummary(BaseModel):
    week_start: date
    sessions_count: int
    total_calories: float
    avg_duration_mins: float
    avg_heart_rate: float | None
    most_common_type: str | None
    total_strength_volume: float


class MonthlySummary(BaseModel):
    month_start: date
    sessions_count: int
    total_calories: float
    avg_duration_mins: float
    avg_heart_rate: float | None
    most_common_type: str | None
    total_strength_volume: float


# ── Strength progress ──────────────────────────────────────────────────────────

class StrengthProgressPoint(BaseModel):
    date: date
    top_weight: float
    total_volume: float
    sets_count: int


# ── Health metrics ─────────────────────────────────────────────────────────────

class MetricIn(BaseModel):
    metric_type: str
    value: float
    unit: str
    recorded_at: datetime | None = None  # defaults to now server-side
    source: SourceEnum = SourceEnum.manual


class MetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    metric_type: str
    value: float
    unit: str
    recorded_at: datetime
    date: date
    source: SourceEnum


class MetricSummaryItem(BaseModel):
    metric_type: str
    latest_value: float | None
    unit: str
    trend: float | None  # delta vs previous period (positive = up)


# ── Goals ──────────────────────────────────────────────────────────────────────

class GoalIn(BaseModel):
    goal_type: str
    metric_scope: MetricScopeEnum
    target_value: float
    target_unit: str
    comparison: ComparisonEnum = ComparisonEnum.gte
    window: WindowEnum = WindowEnum.weekly
    deadline: date | None = None
    notes: str | None = None


class GoalUpdate(BaseModel):
    goal_type: str | None = None
    target_value: float | None = None
    target_unit: str | None = None
    comparison: ComparisonEnum | None = None
    window: WindowEnum | None = None
    deadline: date | None = None
    notes: str | None = None
    is_active: bool | None = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    goal_type: str
    metric_scope: MetricScopeEnum
    target_value: float
    target_unit: str
    comparison: ComparisonEnum
    window: WindowEnum
    deadline: date | None
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class GoalStatus(GoalOut):
    current_value: float
    percentage_complete: float
    status: str  # on_track | behind | ahead | completed


# ── Coaching ───────────────────────────────────────────────────────────────────

class ChatIn(BaseModel):
    message: str


class ChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_message: str
    ai_response: str
    model: str
    created_at: datetime


# ── Analytics (v2) ───────────────────────────────────────────────────────────

class ExercisePR(BaseModel):
    exercise_name: str
    best_weight: float
    best_weight_unit: str
    best_weight_date: date
    best_est_1rm: float            # Epley estimate
    best_est_1rm_date: date
    is_recent_pr: bool             # PR set within the last 30 days


class MuscleVolume(BaseModel):
    muscle_group: str
    total_volume: float            # Σ reps × weight in the window
    sets_count: int


class OvertrainingFlag(BaseModel):
    metric: str                    # e.g. "acwr", "weekly_volume_spike"
    level: str                     # ok | caution | high
    value: float
    message: str


class AnalyticsSummary(BaseModel):
    prs: list[ExercisePR]
    muscle_volume: list[MuscleVolume]
    overtraining: list[OvertrainingFlag]
    window_days: int


# ── Config ─────────────────────────────────────────────────────────────────────

class AppConfig(BaseModel):
    coaching_enabled: bool
    hevy_enabled: bool
    strava_enabled: bool
    analytics_enabled: bool = True


# ── Settings ───────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    hevy_enabled: bool
    hevy_api_key: str | None       # masked if set
    strava_enabled: bool
    strava_client_id: str | None
    strava_client_secret: str | None  # masked if set
    strava_redirect_uri: str
    coaching_enabled: bool
    anthropic_api_key: str | None  # masked if set
    claude_model: str | None
    webhook_secret: str | None     # masked if set


class SettingsUpdate(BaseModel):
    hevy_enabled: bool | None = None
    hevy_api_key: str | None = None
    strava_enabled: bool | None = None
    strava_client_id: str | None = None
    strava_client_secret: str | None = None
    strava_redirect_uri: str | None = None
    coaching_enabled: bool | None = None
    anthropic_api_key: str | None = None
    claude_model: str | None = None
    webhook_secret: str | None = None


class TestResult(BaseModel):
    ok: bool
    message: str
