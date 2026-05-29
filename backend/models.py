import enum
from datetime import datetime, date

from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, Enum, Float, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class SourceEnum(str, enum.Enum):
    apple_health = "apple_health"
    hevy = "hevy"
    strava = "strava"
    manual = "manual"


class WorkoutTypeEnum(str, enum.Enum):
    strength = "strength"
    running = "running"
    cycling = "cycling"
    walking = "walking"
    other = "other"


class WeightUnitEnum(str, enum.Enum):
    kg = "kg"
    lb = "lb"


class ComparisonEnum(str, enum.Enum):
    gte = "gte"
    lte = "lte"


class WindowEnum(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    all_time = "all_time"


class MetricScopeEnum(str, enum.Enum):
    workout = "workout"
    strength = "strength"
    health_metric = "health_metric"


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source: Mapped[SourceEnum] = mapped_column(Enum(SourceEnum), nullable=False)
    external_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    workout_type: Mapped[WorkoutTypeEnum] = mapped_column(Enum(WorkoutTypeEnum), nullable=False)
    raw_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_mins: Mapped[float] = mapped_column(Float, nullable=False)
    active_calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_heart_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_heart_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_strength_detail: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    strength_sets: Mapped[list["StrengthSet"]] = relationship(
        "StrengthSet", back_populates="workout", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "ix_workouts_source_external_id",
            "source", "external_id",
            unique=True,
            postgresql_where="external_id IS NOT NULL",
        ),
    )


class StrengthSet(Base):
    __tablename__ = "strength_sets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    workout_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )
    exercise_name: Mapped[str] = mapped_column(Text, nullable=False)
    exercise_order: Mapped[int] = mapped_column(Integer, nullable=False)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_unit: Mapped[WeightUnitEnum] = mapped_column(
        Enum(WeightUnitEnum), default=WeightUnitEnum.kg, nullable=False
    )
    rpe: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_warmup: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workout: Mapped["Workout"] = relationship("Workout", back_populates="strength_sets")


class HealthMetric(Base):
    __tablename__ = "health_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    metric_type: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[SourceEnum] = mapped_column(Enum(SourceEnum), nullable=False)
    external_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("metric_type", "recorded_at", "source", name="uq_health_metrics_type_time_source"),
    )


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    goal_type: Mapped[str] = mapped_column(Text, nullable=False)
    metric_scope: Mapped[MetricScopeEnum] = mapped_column(Enum(MetricScopeEnum), nullable=False)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    target_unit: Mapped[str] = mapped_column(Text, nullable=False)
    comparison: Mapped[ComparisonEnum] = mapped_column(
        Enum(ComparisonEnum), default=ComparisonEnum.gte, nullable=False
    )
    window: Mapped[WindowEnum] = mapped_column(
        Enum(WindowEnum), default=WindowEnum.weekly, nullable=False
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CoachingSession(Base):
    __tablename__ = "coaching_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    ai_response: Mapped[str] = mapped_column(Text, nullable=False)
    context_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=True)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
