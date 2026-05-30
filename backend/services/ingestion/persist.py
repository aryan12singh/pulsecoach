"""Shared dedup + upsert logic. All adapters funnel through here."""
from __future__ import annotations
import logging
from dataclasses import dataclass

from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models import Workout, StrengthSet, HealthMetric
from services.ingestion.base import IngestResult, NormalizedWorkout, NormalizedMetric

logger = logging.getLogger(__name__)


@dataclass
class UpsertCounts:
    workouts_inserted: int = 0
    workouts_updated: int = 0
    workouts_skipped: int = 0
    metrics_inserted: int = 0
    metrics_skipped: int = 0


async def upsert(result: IngestResult, db: AsyncSession) -> UpsertCounts:
    counts = UpsertCounts()

    for nw in result.workouts:
        workout_id, was_new = await _upsert_workout(nw, db)
        if was_new:
            counts.workouts_inserted += 1
        else:
            counts.workouts_updated += 1

        # Attach strength sets if any
        key = nw.external_id or f"{nw.source}_{nw.start_at.isoformat()}_{nw.workout_type}"
        sets = result.strength_sets.get(key, [])
        if sets and workout_id is not None:
            await db.execute(
                delete(StrengthSet).where(StrengthSet.workout_id == workout_id)
            )
            for s in sets:
                db.add(StrengthSet(workout_id=workout_id, **s.model_dump()))
            await db.execute(
                Workout.__table__.update()
                .where(Workout.id == workout_id)
                .values(has_strength_detail=True)
            )

    for nm in result.metrics:
        inserted = await _upsert_metric(nm, db)
        if inserted:
            counts.metrics_inserted += 1
        else:
            counts.metrics_skipped += 1

    await db.commit()
    return counts


async def _upsert_workout(nw: NormalizedWorkout, db: AsyncSession) -> tuple[int | None, bool]:
    """Insert or update a workout. Returns (workout id, was_newly_inserted)."""
    # Find existing by (source, external_id) or (source, start_at, workout_type)
    if nw.external_id:
        stmt = select(Workout).where(
            and_(Workout.source == nw.source, Workout.external_id == nw.external_id)
        )
    else:
        stmt = select(Workout).where(
            and_(
                Workout.source == nw.source,
                Workout.start_at == nw.start_at,
                Workout.workout_type == nw.workout_type,
            )
        )

    existing = (await db.execute(stmt)).scalar_one_or_none()

    data = nw.model_dump()
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        await db.flush()
        return existing.id, False
    else:
        workout = Workout(**data)
        db.add(workout)
        await db.flush()
        return workout.id, True


async def _upsert_metric(nm: NormalizedMetric, db: AsyncSession) -> bool:
    """Insert metric; skip on conflict. Returns True if inserted."""
    stmt = select(HealthMetric).where(
        and_(
            HealthMetric.metric_type == nm.metric_type,
            HealthMetric.recorded_at == nm.recorded_at,
            HealthMetric.source == nm.source,
        )
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        return False
    db.add(HealthMetric(**nm.model_dump()))
    await db.flush()
    return True
