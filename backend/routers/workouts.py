from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import SourceEnum, StrengthSet, Workout, WorkoutTypeEnum
from schemas import MonthlySummary, WeeklySummary, WorkoutDetail, WorkoutIn, WorkoutOut

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("/summary/weekly", response_model=WeeklySummary)
async def weekly_summary(db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    return await _build_summary(week_start, week_start + timedelta(days=7), db, is_weekly=True)


@router.get("/summary/monthly", response_model=MonthlySummary)
async def monthly_summary(db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)
    return await _build_summary(month_start, month_end, db, is_weekly=False)


async def _build_summary(start: date, end: date, db: AsyncSession, is_weekly: bool) -> dict:
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(end.year, end.month, end.day, tzinfo=timezone.utc)

    stmt = select(Workout).where(and_(Workout.start_at >= start_dt, Workout.start_at < end_dt))
    rows = list((await db.execute(stmt)).scalars().all())

    sessions = len(rows)
    total_cal = sum(w.active_calories or 0 for w in rows)
    avg_dur = sum(w.duration_mins for w in rows) / sessions if sessions else 0
    hr_vals = [w.avg_heart_rate for w in rows if w.avg_heart_rate]
    avg_hr = sum(hr_vals) / len(hr_vals) if hr_vals else None

    type_counts: dict[str, int] = {}
    for w in rows:
        type_counts[w.workout_type.value] = type_counts.get(w.workout_type.value, 0) + 1
    most_common = max(type_counts, key=type_counts.get) if type_counts else None

    # Strength volume
    vol_stmt = (
        select(func.sum(StrengthSet.reps * StrengthSet.weight))
        .join(Workout, StrengthSet.workout_id == Workout.id)
        .where(and_(Workout.start_at >= start_dt, Workout.start_at < end_dt))
    )
    vol = (await db.execute(vol_stmt)).scalar() or 0.0

    common = dict(
        sessions_count=sessions,
        total_calories=round(total_cal, 1),
        avg_duration_mins=round(avg_dur, 1),
        avg_heart_rate=round(avg_hr, 1) if avg_hr else None,
        most_common_type=most_common,
        total_strength_volume=round(float(vol), 1),
    )
    if is_weekly:
        return WeeklySummary(week_start=start, **common)
    return MonthlySummary(month_start=start, **common)


@router.get("", response_model=list[WorkoutOut])
async def list_workouts(
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = Query(None),
    type: WorkoutTypeEnum | None = Query(None),
    source: SourceEnum | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if from_:
        filters.append(Workout.start_at >= from_)
    if to:
        filters.append(Workout.start_at <= to)
    if type:
        filters.append(Workout.workout_type == type)
    if source:
        filters.append(Workout.source == source)

    stmt = select(Workout).where(and_(*filters)).order_by(Workout.start_at.desc()).limit(limit).offset(offset)
    rows = list((await db.execute(stmt)).scalars().all())
    return rows


@router.get("/{workout_id}", response_model=WorkoutDetail)
async def get_workout(workout_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Workout)
        .options(selectinload(Workout.strength_sets))
        .where(Workout.id == workout_id)
    )
    workout = (await db.execute(stmt)).scalar_one_or_none()
    if not workout:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.post("", response_model=WorkoutOut, status_code=201)
async def create_workout(body: WorkoutIn, db: AsyncSession = Depends(get_db)):
    sets_data = body.sets
    data = body.model_dump(exclude={"sets"})
    workout = Workout(**data)
    db.add(workout)
    await db.flush()

    # Derive exercise_order (first appearance) and per-exercise set_number
    # when the client omits them.
    order_map: dict[str, int] = {}
    set_counts: dict[str, int] = {}
    for s in sets_data:
        if s.exercise_name not in order_map:
            order_map[s.exercise_name] = len(order_map)
        set_counts[s.exercise_name] = set_counts.get(s.exercise_name, 0) + 1
        payload = s.model_dump()
        if payload["exercise_order"] is None:
            payload["exercise_order"] = order_map[s.exercise_name]
        if payload["set_number"] is None:
            payload["set_number"] = set_counts[s.exercise_name]
        db.add(StrengthSet(workout_id=workout.id, **payload))
    if sets_data:
        workout.has_strength_detail = True

    await db.commit()
    await db.refresh(workout)
    return workout


@router.delete("/{workout_id}", status_code=204)
async def delete_workout(workout_id: int, db: AsyncSession = Depends(get_db)):
    """Hard-delete a workout and its strength sets (cascade)."""
    workout = (await db.execute(
        select(Workout).where(Workout.id == workout_id)
    )).scalar_one_or_none()
    if not workout:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workout not found")
    await db.delete(workout)
    await db.commit()
