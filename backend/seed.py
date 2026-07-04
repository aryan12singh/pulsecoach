"""Demo seed script — idempotent, opt-in via SEED_DEMO=true. Run after migrations."""
from __future__ import annotations

import asyncio
import os
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from database import AsyncSessionLocal
from models import (
    ComparisonEnum,
    Goal,
    HealthMetric,
    MetricScopeEnum,
    SourceEnum,
    StrengthSet,
    WeightUnitEnum,
    WindowEnum,
    Workout,
    WorkoutTypeEnum,
)

random.seed(42)


async def seed():
    if os.environ.get("SEED_DEMO", "").lower() not in ("true", "1", "yes"):
        print("SEED_DEMO not enabled — skipping demo data (start fresh and import your own).")
        return

    async with AsyncSessionLocal() as db:
        # Skip if data already exists
        count = (await db.execute(select(func.count(Workout.id)))).scalar()
        if count and count > 0:
            print("Seed data already present, skipping.")
            return

        today = datetime.now(timezone.utc)

        def now(delta_days=0):
            return today - timedelta(days=delta_days)

        # ── Goals ──────────────────────────────────────────────────────────────
        goals = [
            Goal(
                goal_type="sessions_per_week",
                metric_scope=MetricScopeEnum.workout,
                target_value=3,
                target_unit="sessions",
                comparison=ComparisonEnum.gte,
                window=WindowEnum.weekly,
                notes="Hit the gym at least 3 times a week",
            ),
            Goal(
                goal_type="total_volume_weekly",
                metric_scope=MetricScopeEnum.strength,
                target_value=10000,
                target_unit="kg·reps",
                comparison=ComparisonEnum.gte,
                window=WindowEnum.weekly,
                notes="Total weekly lifting volume",
            ),
            Goal(
                goal_type="weight_target",
                metric_scope=MetricScopeEnum.health_metric,
                target_value=70.0,
                target_unit="kg",
                comparison=ComparisonEnum.lte,
                window=WindowEnum.weekly,
                notes="Reach 70 kg body weight",
            ),
            Goal(
                goal_type="sleep_avg_hours",
                metric_scope=MetricScopeEnum.health_metric,
                target_value=7.0,
                target_unit="hours",
                comparison=ComparisonEnum.gte,
                window=WindowEnum.weekly,
                notes="Average 7 hours of sleep",
            ),
        ]
        db.add_all(goals)
        await db.flush()

        # ── Workouts ───────────────────────────────────────────────────────────
        workout_schedule = [
            # (days_ago, type, duration, calories, avg_hr)
            (1,  WorkoutTypeEnum.strength, 55, 320, 138),
            (2,  WorkoutTypeEnum.running,  35, 280, 155),
            (3,  WorkoutTypeEnum.strength, 60, 340, 140),
            (5,  WorkoutTypeEnum.cycling,  45, 310, 148),
            (6,  WorkoutTypeEnum.strength, 50, 300, 135),
            (7,  WorkoutTypeEnum.running,  30, 240, 152),
            (8,  WorkoutTypeEnum.strength, 65, 360, 142),
            (9,  WorkoutTypeEnum.walking,  40, 180, 110),
            (10, WorkoutTypeEnum.strength, 55, 315, 137),
            (12, WorkoutTypeEnum.running,  38, 290, 157),
            (13, WorkoutTypeEnum.strength, 60, 350, 141),
            (14, WorkoutTypeEnum.cycling,  50, 330, 150),
        ]

        strength_exercises = [
            ("Bench Press", 0),
            ("Squat", 1),
            ("Barbell Row", 2),
        ]

        # Base weights that progress slightly over time
        base_weights = {"Bench Press": 80.0, "Squat": 100.0, "Barbell Row": 70.0}

        for days_ago, wtype, duration, calories, avg_hr in workout_schedule:
            start = now(days_ago).replace(hour=8, minute=0, second=0, microsecond=0)
            end = start + timedelta(minutes=duration)

            workout = Workout(
                source=SourceEnum.manual,
                workout_type=wtype,
                raw_type=wtype.value.title(),
                start_at=start,
                end_at=end,
                duration_mins=float(duration),
                active_calories=float(calories),
                avg_heart_rate=float(avg_hr),
                max_heart_rate=float(avg_hr + random.randint(15, 25)),
                distance_km=(
                    random.uniform(4, 8)
                    if wtype in (WorkoutTypeEnum.running, WorkoutTypeEnum.cycling)
                    else None
                ),
                has_strength_detail=wtype == WorkoutTypeEnum.strength,
            )
            db.add(workout)
            await db.flush()

            if wtype == WorkoutTypeEnum.strength:
                # Progress weights slightly for more recent workouts
                progress_factor = 1 + (14 - days_ago) * 0.005
                for ex_name, ex_order in strength_exercises:
                    num_sets = random.randint(3, 4)
                    base_w = base_weights[ex_name] * progress_factor
                    for set_num in range(1, num_sets + 1):
                        weight = round(base_w + random.uniform(-2.5, 2.5), 1)
                        reps = random.randint(6, 10)
                        db.add(StrengthSet(
                            workout_id=workout.id,
                            exercise_name=ex_name,
                            exercise_order=ex_order,
                            set_number=set_num,
                            reps=reps,
                            weight=weight,
                            weight_unit=WeightUnitEnum.kg,
                            rpe=random.uniform(7, 9),
                        ))

        # ── Health Metrics (30 days) ───────────────────────────────────────────
        metrics: list[HealthMetric] = []
        for i in range(30):
            day = (today - timedelta(days=i)).replace(hour=7, minute=0, second=0, microsecond=0)
            day_date = day.date()

            # Weight: slow downward trend 73 → 71 kg
            weight = round(73.0 - (i / 29) * 2.0 + random.uniform(-0.3, 0.3), 1)
            bmi = round(weight / (1.75 ** 2), 1)

            metrics.append(HealthMetric(
                metric_type="weight_kg", value=weight, unit="kg",
                recorded_at=day, date=day_date, source=SourceEnum.manual,
            ))
            metrics.append(HealthMetric(
                metric_type="bmi", value=bmi, unit="kg/m²",
                recorded_at=day + timedelta(seconds=1), date=day_date, source=SourceEnum.manual,
            ))
            metrics.append(HealthMetric(
                metric_type="resting_hr",
                value=round(random.uniform(58, 65), 0),
                unit="bpm",
                recorded_at=day + timedelta(seconds=2), date=day_date, source=SourceEnum.manual,
            ))
            metrics.append(HealthMetric(
                metric_type="sleep_hours",
                value=round(random.uniform(6.5, 8.0), 1),
                unit="hours",
                recorded_at=day + timedelta(seconds=3), date=day_date, source=SourceEnum.manual,
            ))
            metrics.append(HealthMetric(
                metric_type="steps",
                value=round(random.uniform(7000, 12000), 0),
                unit="steps",
                recorded_at=day + timedelta(seconds=4), date=day_date, source=SourceEnum.manual,
            ))

        db.add_all(metrics)
        await db.commit()
        print(f"Seed complete: {len(workout_schedule)} workouts, {len(metrics)} metrics, {len(goals)} goals.")


if __name__ == "__main__":
    asyncio.run(seed())
