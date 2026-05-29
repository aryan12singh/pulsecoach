import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from services.ingestion.apple_health import AppleHealthAdapter
from services.ingestion.persist import upsert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])

_apple_adapter = AppleHealthAdapter()


def _ingest_summary(counts) -> dict:
    return {
        "status": "ok",
        "workouts_inserted": counts.workouts_inserted,
        "workouts_updated": counts.workouts_updated,
        "metrics_inserted": counts.metrics_inserted,
    }


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
            "Apple Health ingest: %d new / %d updated workouts, %d metrics",
            counts.workouts_inserted, counts.workouts_updated, counts.metrics_inserted,
        )
        return _ingest_summary(counts)
    except Exception as exc:
        logger.error("Apple Health ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


# ── Hevy ───────────────────────────────────────────────────────────────────────

@router.post("/hevy/sync")
async def sync_hevy(db: AsyncSession = Depends(get_db)):
    """On-demand pull from the Hevy API."""
    if not settings.enable_hevy:
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")
    if not settings.hevy_api_key:
        raise HTTPException(status_code=503, detail="HEVY_API_KEY not configured")

    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(settings.hevy_api_key)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return _ingest_summary(counts)


@router.post("/hevy/webhook")
async def hevy_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(None),
):
    """Receive a Hevy workout push. Always returns 200 so Hevy won't retry.

    Hevy posts a lightweight event (e.g. {"workout": {"id": ...}}); we re-fetch the
    full workout from the API so set/rep/weight detail is captured, then upsert.
    """
    if not settings.enable_hevy:
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")

    if settings.webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != settings.webhook_secret:
            logger.warning("Hevy webhook: invalid secret")
            return {"status": "ok", "error": "invalid secret"}

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Hevy webhook: bad json — %s", exc)
        return {"status": "ok", "error": "invalid json"}

    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(settings.hevy_api_key or "")

    try:
        # Prefer re-fetching the full workout by id for complete set detail.
        workout_id = (payload.get("workout") or {}).get("id") or payload.get("id")
        if workout_id and settings.hevy_api_key:
            result = await adapter.fetch_one_and_normalize(str(workout_id))
        else:
            # Fall back to normalising whatever the webhook sent inline.
            inline = payload.get("workouts") or ([payload["workout"]] if payload.get("workout") else [])
            result = adapter.normalize({"workouts": inline})

        counts = await upsert(result, db)
        return _ingest_summary(counts)
    except Exception as exc:
        logger.error("Hevy webhook ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


# ── Strava (OAuth2 + polling) ────────────────────────────────────────────────────

def _require_strava() -> None:
    if not settings.enable_strava:
        raise HTTPException(status_code=404, detail="Strava integration not enabled")
    if not (settings.strava_client_id and settings.strava_client_secret):
        raise HTTPException(status_code=503, detail="Strava client credentials not configured")


@router.get("/strava/connect")
async def strava_connect():
    """Redirect the user to Strava's OAuth consent screen."""
    _require_strava()
    from services.ingestion.strava import authorize_url
    return RedirectResponse(authorize_url())


@router.get("/strava/callback")
async def strava_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """OAuth redirect target — exchanges the code for tokens, then returns to the UI."""
    _require_strava()
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/trends?strava=error")

    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db)
    await adapter.exchange_code(code)
    return RedirectResponse(f"{settings.frontend_url}/trends?strava=connected")


@router.post("/strava/sync")
async def strava_sync(db: AsyncSession = Depends(get_db)):
    """Pull recent activities from Strava and upsert them."""
    _require_strava()
    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return _ingest_summary(counts)
