import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from services.ingestion.apple_health import AppleHealthAdapter
from services.ingestion.persist import upsert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])

_apple_adapter = AppleHealthAdapter()


@router.post("/apple-health")
async def ingest_apple_health(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(None),
):
    """Receive Health Auto Export push. Always returns 200."""
    if settings.webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != settings.webhook_secret:
            logger.warning("Apple Health webhook: invalid secret")
            return {"status": "ok", "error": "invalid secret"}

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Failed to parse Apple Health payload: %s", exc)
        return {"status": "ok", "error": "invalid json"}

    try:
        result = _apple_adapter.normalize(payload)
        counts = await upsert(result, db)
        logger.info(
            "Apple Health ingest: %d workouts, %d metrics",
            counts.workouts_inserted, counts.metrics_inserted,
        )
        return {
            "status": "ok",
            "workouts_inserted": counts.workouts_inserted,
            "metrics_inserted": counts.metrics_inserted,
        }
    except Exception as exc:
        logger.error("Apple Health ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


@router.post("/hevy/sync")
async def sync_hevy(db: AsyncSession = Depends(get_db)):
    if not settings.enable_hevy:
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")
    if not settings.hevy_api_key:
        raise HTTPException(status_code=503, detail="HEVY_API_KEY not configured")

    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(settings.hevy_api_key)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return {
        "status": "ok",
        "workouts_inserted": counts.workouts_inserted,
        "metrics_inserted": counts.metrics_inserted,
    }
