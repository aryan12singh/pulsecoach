"""Advanced analytics (v2): PR detection, per-muscle volume, overtraining flags."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import StrengthSet, Workout
from schemas import AnalyticsSummary, ExercisePR, MuscleVolume, OvertrainingFlag

logger = logging.getLogger(__name__)

# Substring → muscle group. First match wins; longer/more specific keys first.
_MUSCLE_MAP: list[tuple[str, str]] = [
    ("bench press", "chest"),
    ("incline", "chest"),
    ("chest", "chest"),
    ("squat", "legs"),
    ("leg press", "legs"),
    ("lunge", "legs"),
    ("deadlift", "legs"),
    ("leg curl", "legs"),
    ("leg extension", "legs"),
    ("calf", "legs"),
    ("row", "back"),
    ("pull-up", "back"),
    ("pullup", "back"),
    ("pulldown", "back"),
    ("lat ", "back"),
    ("overhead press", "shoulders"),
    ("shoulder press", "shoulders"),
    ("lateral raise", "shoulders"),
    ("ohp", "shoulders"),
    ("curl", "arms"),
    ("tricep", "arms"),
    ("pushdown", "arms"),
    ("dip", "arms"),
    ("plank", "core"),
    ("crunch", "core"),
    ("ab ", "core"),
]


def _muscle_group(exercise_name: str) -> str:
    name = exercise_name.lower()
    for key, group in _MUSCLE_MAP:
        if key in name:
            return group
    return "other"


def _epley_1rm(weight: float, reps: int) -> float:
    return weight * (1 + reps / 30) if reps and reps > 0 else weight


async def detect_prs(db: AsyncSession, window_days: int = 30) -> list[ExercisePR]:
    """Best top-set weight and best estimated 1RM per exercise, with recency flag."""
    stmt = (
        select(
            StrengthSet.exercise_name,
            StrengthSet.weight,
            StrengthSet.weight_unit,
            StrengthSet.reps,
            func.date(Workout.start_at).label("date"),
        )
        .join(Workout, StrengthSet.workout_id == Workout.id)
        .where(StrengthSet.weight.isnot(None), StrengthSet.is_warmup.is_(False))
    )
    rows = (await db.execute(stmt)).all()

    today = datetime.now(timezone.utc).date()
    recent_cutoff = today - timedelta(days=window_days)

    by_ex: dict[str, dict] = {}
    for r in rows:
        ex = r.exercise_name
        unit = r.weight_unit.value if hasattr(r.weight_unit, "value") else str(r.weight_unit)
        est = _epley_1rm(r.weight, r.reps or 0)
        cur = by_ex.setdefault(ex, {
            "best_weight": -1.0, "best_weight_date": r.date, "unit": unit,
            "best_1rm": -1.0, "best_1rm_date": r.date,
        })
        if r.weight > cur["best_weight"]:
            cur["best_weight"] = r.weight
            cur["best_weight_date"] = r.date
            cur["unit"] = unit
        if est > cur["best_1rm"]:
            cur["best_1rm"] = est
            cur["best_1rm_date"] = r.date

    prs: list[ExercisePR] = []
    for ex, d in sorted(by_ex.items()):
        recent = d["best_weight_date"] >= recent_cutoff or d["best_1rm_date"] >= recent_cutoff
        prs.append(ExercisePR(
            exercise_name=ex,
            best_weight=round(d["best_weight"], 1),
            best_weight_unit=d["unit"],
            best_weight_date=d["best_weight_date"],
            best_est_1rm=round(d["best_1rm"], 1),
            best_est_1rm_date=d["best_1rm_date"],
            is_recent_pr=recent,
        ))
    return prs


async def muscle_volume(db: AsyncSession, window_days: int = 30) -> list[MuscleVolume]:
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    stmt = (
        select(
            StrengthSet.exercise_name,
            func.sum(StrengthSet.reps * StrengthSet.weight).label("volume"),
            func.count(StrengthSet.id).label("sets"),
        )
        .join(Workout, StrengthSet.workout_id == Workout.id)
        .where(Workout.start_at >= since, StrengthSet.is_warmup.is_(False))
        .group_by(StrengthSet.exercise_name)
    )
    rows = (await db.execute(stmt)).all()

    agg: dict[str, dict] = {}
    for r in rows:
        group = _muscle_group(r.exercise_name)
        a = agg.setdefault(group, {"volume": 0.0, "sets": 0})
        a["volume"] += float(r.volume or 0)
        a["sets"] += int(r.sets or 0)

    return [
        MuscleVolume(muscle_group=g, total_volume=round(a["volume"], 1), sets_count=a["sets"])
        for g, a in sorted(agg.items(), key=lambda kv: kv[1]["volume"], reverse=True)
    ]


async def overtraining_flags(db: AsyncSession) -> list[OvertrainingFlag]:
    """Acute:chronic workload ratio + week-over-week volume spike."""
    now = datetime.now(timezone.utc)

    async def volume_between(start: datetime, end: datetime) -> float:
        stmt = (
            select(func.coalesce(func.sum(StrengthSet.reps * StrengthSet.weight), 0.0))
            .join(Workout, StrengthSet.workout_id == Workout.id)
            .where(Workout.start_at >= start, Workout.start_at < end)
        )
        return float((await db.execute(stmt)).scalar() or 0.0)

    acute = await volume_between(now - timedelta(days=7), now)              # last 7d
    chronic_total = await volume_between(now - timedelta(days=28), now)     # last 28d
    chronic_weekly_avg = chronic_total / 4 if chronic_total else 0.0
    prev_week = await volume_between(now - timedelta(days=14), now - timedelta(days=7))

    flags: list[OvertrainingFlag] = []

    # Acute:Chronic Workload Ratio — sweet spot ~0.8–1.3, >1.5 elevated risk
    acwr = (acute / chronic_weekly_avg) if chronic_weekly_avg else 0.0
    if chronic_weekly_avg == 0:
        level, msg = "ok", "Not enough training history to assess workload ratio."
    elif acwr > 1.5:
        level, msg = "high", f"Acute:chronic workload ratio is {acwr:.2f} — sharp spike, ease off."
    elif acwr > 1.3:
        level, msg = "caution", f"Workload ratio {acwr:.2f} is climbing; monitor recovery."
    else:
        level, msg = "ok", f"Workload ratio {acwr:.2f} is in a healthy range."
    flags.append(OvertrainingFlag(metric="acwr", level=level, value=round(acwr, 2), message=msg))

    # Week-over-week spike
    if prev_week > 0:
        spike = (acute - prev_week) / prev_week * 100
        if spike > 50:
            level, msg = "high", f"Weekly volume up {spike:.0f}% vs last week — large jump."
        elif spike > 25:
            level, msg = "caution", f"Weekly volume up {spike:.0f}% vs last week."
        else:
            level, msg = "ok", f"Weekly volume change {spike:+.0f}% vs last week."
        flags.append(OvertrainingFlag(
            metric="weekly_volume_spike", level=level, value=round(spike, 1), message=msg,
        ))

    return flags


async def build_summary(db: AsyncSession, window_days: int = 30) -> AnalyticsSummary:
    return AnalyticsSummary(
        prs=await detect_prs(db, window_days),
        muscle_volume=await muscle_volume(db, window_days),
        overtraining=await overtraining_flags(db),
        window_days=window_days,
    )
