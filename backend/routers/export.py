"""Full data export — everything the user owns, as a downloadable JSON file."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Goal, HealthMetric, Workout

router = APIRouter(prefix="/export", tags=["export"])


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return str(value)


@router.get("/json")
async def export_json(db: AsyncSession = Depends(get_db)):
    workouts = list((await db.execute(
        select(Workout).options(selectinload(Workout.strength_sets)).order_by(Workout.start_at)
    )).scalars().all())
    metrics = list((await db.execute(
        select(HealthMetric).order_by(HealthMetric.recorded_at)
    )).scalars().all())
    goals = list((await db.execute(select(Goal))).scalars().all())

    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "format_version": 1,
        "workouts": [
            {
                "source": w.source.value,
                "external_id": w.external_id,
                "workout_type": w.workout_type.value,
                "raw_type": w.raw_type,
                "start_at": w.start_at,
                "end_at": w.end_at,
                "duration_mins": w.duration_mins,
                "active_calories": w.active_calories,
                "avg_heart_rate": w.avg_heart_rate,
                "max_heart_rate": w.max_heart_rate,
                "distance_km": w.distance_km,
                "strength_sets": [
                    {
                        "exercise_name": s.exercise_name,
                        "exercise_order": s.exercise_order,
                        "set_number": s.set_number,
                        "reps": s.reps,
                        "weight": s.weight,
                        "weight_unit": s.weight_unit.value,
                        "rpe": s.rpe,
                        "duration_seconds": s.duration_seconds,
                        "distance_m": s.distance_m,
                        "is_warmup": s.is_warmup,
                    }
                    for s in sorted(w.strength_sets, key=lambda s: (s.exercise_order, s.set_number))
                ],
            }
            for w in workouts
        ],
        "health_metrics": [
            {
                "metric_type": m.metric_type,
                "value": m.value,
                "unit": m.unit,
                "recorded_at": m.recorded_at,
                "source": m.source.value,
            }
            for m in metrics
        ],
        "goals": [
            {
                "goal_type": g.goal_type,
                "metric_scope": g.metric_scope.value,
                "target_value": g.target_value,
                "target_unit": g.target_unit,
                "comparison": g.comparison.value,
                "window": g.window.value,
                "deadline": g.deadline,
                "is_active": g.is_active,
                "notes": g.notes,
            }
            for g in goals
        ],
    }

    body = json.dumps(payload, default=_json_default, indent=2)
    filename = f"pulsecoach-export-{datetime.now(timezone.utc).date().isoformat()}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
