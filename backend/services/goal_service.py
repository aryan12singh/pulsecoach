from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ComparisonEnum, Goal, HealthMetric, MetricScopeEnum, StrengthSet, WindowEnum, Workout
from schemas import GoalStatus

logger = logging.getLogger(__name__)


def _window_start(window: WindowEnum) -> datetime:
    today = datetime.now(timezone.utc).date()
    if window == WindowEnum.daily:
        start = today
    elif window == WindowEnum.weekly:
        start = today - timedelta(days=today.weekday())
    elif window == WindowEnum.monthly:
        start = today.replace(day=1)
    else:  # all_time
        start = date(2000, 1, 1)
    return datetime(start.year, start.month, start.day, tzinfo=timezone.utc)


async def _compute_current(goal: Goal, db: AsyncSession) -> float:
    since = _window_start(goal.window)

    if goal.metric_scope == MetricScopeEnum.workout:
        return await _workout_value(goal, since, db)
    elif goal.metric_scope == MetricScopeEnum.strength:
        return await _strength_value(goal, since, db)
    else:
        return await _metric_value(goal, since, db)


async def _workout_value(goal: Goal, since: datetime, db: AsyncSession) -> float:
    gt = goal.goal_type
    base = select(Workout).where(Workout.start_at >= since)

    if gt == "sessions_per_week" or gt == "sessions_per_month" or gt == "sessions_daily":
        cnt = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
        return float(cnt)
    elif gt == "active_calories_weekly" or gt == "active_calories_daily":
        val = (await db.execute(
            select(func.sum(Workout.active_calories)).where(Workout.start_at >= since)
        )).scalar() or 0
        return float(val)
    elif gt == "avg_duration_mins":
        val = (await db.execute(
            select(func.avg(Workout.duration_mins)).where(Workout.start_at >= since)
        )).scalar() or 0
        return float(val)
    else:
        # Default: count sessions
        cnt = (await db.execute(
            select(func.count(Workout.id)).where(Workout.start_at >= since)
        )).scalar() or 0
        return float(cnt)


async def _strength_value(goal: Goal, since: datetime, db: AsyncSession) -> float:
    # total volume = sum(reps * weight) for strength workouts in window
    stmt = (
        select(func.sum(StrengthSet.reps * StrengthSet.weight))
        .join(Workout, StrengthSet.workout_id == Workout.id)
        .where(Workout.start_at >= since)
    )
    val = (await db.execute(stmt)).scalar() or 0
    return float(val)


async def _metric_value(goal: Goal, since: datetime, db: AsyncSession) -> float:
    gt = goal.goal_type
    # Derive metric_type from goal_type convention (e.g. weight_target → weight_kg)
    type_map = {
        "weight_target": "weight_kg",
        "sleep_avg_hours": "sleep_hours",
        "steps_daily": "steps",
        "resting_hr_target": "resting_hr",
        "bmi_target": "bmi",
        "vo2max_target": "vo2max",
        "hrv_target": "hrv",
    }
    metric_type = type_map.get(gt, gt)

    stmt = (
        select(func.avg(HealthMetric.value))
        .where(
            and_(
                HealthMetric.metric_type == metric_type,
                HealthMetric.recorded_at >= since,
            )
        )
    )
    val = (await db.execute(stmt)).scalar()
    if val is None:
        # Fall back to latest value
        latest = (await db.execute(
            select(HealthMetric.value)
            .where(HealthMetric.metric_type == metric_type)
            .order_by(HealthMetric.recorded_at.desc())
            .limit(1)
        )).scalar()
        return float(latest) if latest else 0.0
    return float(val)


def _compute_status(current: float, target: float, comparison: ComparisonEnum) -> tuple[float, str]:
    if target == 0:
        pct = 100.0
    elif comparison == ComparisonEnum.gte:
        pct = min((current / target) * 100, 150.0)
    else:  # lte — lower is better
        if current <= target:
            pct = 100.0
        else:
            # How far from target (penalise overshoot)
            pct = max(0.0, (2 * target - current) / target * 100)

    if pct >= 100:
        status = "completed"
    elif pct >= 70:
        status = "on_track"
    elif comparison == ComparisonEnum.gte and current > target:
        status = "ahead"
    else:
        status = "behind"

    return round(pct, 1), status


async def evaluate_all(db: AsyncSession) -> list[GoalStatus]:
    stmt = select(Goal).where(Goal.is_active.is_(True))
    goals = list((await db.execute(stmt)).scalars().all())

    results: list[GoalStatus] = []
    for goal in goals:
        try:
            current = await _compute_current(goal, db)
            pct, status = _compute_status(current, goal.target_value, goal.comparison)
            results.append(GoalStatus(
                id=goal.id,
                goal_type=goal.goal_type,
                metric_scope=goal.metric_scope,
                target_value=goal.target_value,
                target_unit=goal.target_unit,
                comparison=goal.comparison,
                window=goal.window,
                deadline=goal.deadline,
                is_active=goal.is_active,
                notes=goal.notes,
                created_at=goal.created_at,
                updated_at=goal.updated_at,
                current_value=round(current, 2),
                percentage_complete=pct,
                status=status,
            ))
        except Exception as exc:
            logger.error("Goal evaluation failed for goal %d: %s", goal.id, exc, exc_info=True)

    return results
