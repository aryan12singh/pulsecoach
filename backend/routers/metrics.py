from __future__ import annotations
from datetime import datetime, date, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import HealthMetric, SourceEnum
from schemas import MetricIn, MetricOut, MetricSummaryItem

router = APIRouter(prefix="/metrics", tags=["metrics"])

_SUMMARY_TYPES = [
    ("weight_kg", "kg"),
    ("bmi", "kg/m²"),
    ("resting_hr", "bpm"),
    ("sleep_hours", "hours"),
    ("hrv", "ms"),
    ("steps", "steps"),
]


@router.get("/summary", response_model=list[MetricSummaryItem])
async def metrics_summary(db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    results: list[MetricSummaryItem] = []

    for metric_type, unit in _SUMMARY_TYPES:
        # Latest value in last 30 days
        latest_stmt = (
            select(HealthMetric.value, HealthMetric.recorded_at)
            .where(
                and_(
                    HealthMetric.metric_type == metric_type,
                    HealthMetric.date >= today - timedelta(days=30),
                )
            )
            .order_by(desc(HealthMetric.recorded_at))
            .limit(1)
        )
        latest_row = (await db.execute(latest_stmt)).first()
        if not latest_row:
            continue

        latest_val = latest_row.value

        # Previous period avg (days 60-31)
        prev_stmt = (
            select(func.avg(HealthMetric.value))
            .where(
                and_(
                    HealthMetric.metric_type == metric_type,
                    HealthMetric.date >= today - timedelta(days=60),
                    HealthMetric.date < today - timedelta(days=30),
                )
            )
        )
        prev_val = (await db.execute(prev_stmt)).scalar()
        trend = round(latest_val - float(prev_val), 2) if prev_val else None

        results.append(MetricSummaryItem(
            metric_type=metric_type,
            latest_value=round(latest_val, 2),
            unit=unit,
            trend=trend,
        ))

    return results


@router.get("", response_model=list[MetricOut])
async def list_metrics(
    type: str | None = Query(None),
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = Query(None),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if type:
        filters.append(HealthMetric.metric_type.in_([t.strip() for t in type.split(",")]))
    if from_:
        filters.append(HealthMetric.recorded_at >= from_)
    if to:
        filters.append(HealthMetric.recorded_at <= to)

    stmt = (
        select(HealthMetric)
        .where(and_(*filters))
        .order_by(HealthMetric.recorded_at.asc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return rows


@router.post("", response_model=MetricOut, status_code=201)
async def create_metric(body: MetricIn, db: AsyncSession = Depends(get_db)):
    metric = HealthMetric(
        **body.model_dump(),
        date=body.recorded_at.date(),
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric
