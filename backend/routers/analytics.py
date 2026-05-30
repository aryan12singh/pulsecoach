from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import AnalyticsSummary, ExercisePR, MuscleVolume, OvertrainingFlag
from services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def analytics_summary(
    window_days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.build_summary(db, window_days)


@router.get("/prs", response_model=list[ExercisePR])
async def personal_records(
    window_days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.detect_prs(db, window_days)


@router.get("/muscle-volume", response_model=list[MuscleVolume])
async def per_muscle_volume(
    window_days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await analytics_service.muscle_volume(db, window_days)


@router.get("/overtraining", response_model=list[OvertrainingFlag])
async def overtraining(db: AsyncSession = Depends(get_db)):
    return await analytics_service.overtraining_flags(db)
