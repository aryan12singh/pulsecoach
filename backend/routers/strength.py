from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import StrengthSet, Workout
from schemas import StrengthProgressPoint

router = APIRouter(prefix="/strength", tags=["strength"])


@router.get("/progress", response_model=list[StrengthProgressPoint])
async def strength_progress(
    exercise: str = Query(..., description="Exercise name (case-insensitive)"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            func.date(Workout.start_at).label("date"),
            func.max(StrengthSet.weight).label("top_weight"),
            func.sum(StrengthSet.reps * StrengthSet.weight).label("total_volume"),
            func.count(StrengthSet.id).label("sets_count"),
        )
        .join(Workout, StrengthSet.workout_id == Workout.id)
        .where(func.lower(StrengthSet.exercise_name) == exercise.lower())
        .group_by(func.date(Workout.start_at))
        .order_by(func.date(Workout.start_at))
    )
    rows = (await db.execute(stmt)).all()
    return [
        StrengthProgressPoint(
            date=r.date,
            top_weight=float(r.top_weight or 0),
            total_volume=float(r.total_volume or 0),
            sets_count=r.sets_count,
        )
        for r in rows
    ]
