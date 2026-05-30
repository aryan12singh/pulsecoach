import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import SettingsResponse, SettingsUpdate, TestResult
from services import settings_service as svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])

_PLACEHOLDER = "***"


def _is_placeholder(v: str | None) -> bool:
    return v is None or v.startswith("***") or v == ""


async def _build_response(db: AsyncSession) -> SettingsResponse:
    data = await svc.get_all(db)

    def val(k: str) -> str | None:
        return data.get(k)

    def masked(k: str) -> str | None:
        return svc.mask(val(k))

    return SettingsResponse(
        hevy_enabled=svc._truthy(val("hevy_enabled")),
        hevy_api_key=masked("hevy_api_key"),
        strava_enabled=svc._truthy(val("strava_enabled")),
        strava_client_id=val("strava_client_id"),
        strava_client_secret=masked("strava_client_secret"),
        strava_redirect_uri=val("strava_redirect_uri") or "http://localhost:8010/ingest/strava/callback",
        coaching_enabled=svc._truthy(val("coaching_enabled")),
        anthropic_api_key=masked("anthropic_api_key"),
        claude_model=val("claude_model"),
        webhook_secret=masked("webhook_secret"),
    )


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await _build_response(db)


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    updates: dict[str, str | None] = {}

    if body.hevy_enabled is not None:
        updates["hevy_enabled"] = str(body.hevy_enabled).lower()
    if body.strava_enabled is not None:
        updates["strava_enabled"] = str(body.strava_enabled).lower()
    if body.coaching_enabled is not None:
        updates["coaching_enabled"] = str(body.coaching_enabled).lower()

    # For secret fields, ignore the masked placeholder value so re-saving the
    # form doesn't wipe existing keys.
    for field, key in [
        ("hevy_api_key", "hevy_api_key"),
        ("strava_client_secret", "strava_client_secret"),
        ("anthropic_api_key", "anthropic_api_key"),
        ("webhook_secret", "webhook_secret"),
    ]:
        v = getattr(body, field)
        if v is not None and not _is_placeholder(v):
            updates[key] = v

    for field, key in [
        ("strava_client_id", "strava_client_id"),
        ("strava_redirect_uri", "strava_redirect_uri"),
        ("claude_model", "claude_model"),
    ]:
        v = getattr(body, field)
        if v is not None:
            updates[key] = v

    if updates:
        await svc.set_many(updates, db)

    return await _build_response(db)


@router.post("/test/{integration}", response_model=TestResult)
async def test_integration(integration: str, db: AsyncSession = Depends(get_db)):
    data = await svc.get_all(db)

    if integration == "hevy":
        api_key = data.get("hevy_api_key")
        if not api_key:
            return TestResult(ok=False, message="No Hevy API key configured")
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.hevyapp.com/v1/workouts",
                headers={"api-key": api_key},
                params={"page": 1, "pageSize": 1},
            )
        if r.status_code == 200:
            return TestResult(ok=True, message="Connected — Hevy API key is valid")
        return TestResult(ok=False, message=f"Hevy returned HTTP {r.status_code}")

    elif integration == "strava":
        from services.ingestion.strava import StravaAdapter
        try:
            adapter = StravaAdapter(db)
            token = await adapter._valid_access_token()
            if token:
                return TestResult(ok=True, message="Strava OAuth token is valid")
            return TestResult(ok=False, message="No Strava token — connect via OAuth first")
        except Exception as exc:
            return TestResult(ok=False, message=str(exc))

    elif integration == "coaching":
        api_key = data.get("anthropic_api_key")
        if not api_key:
            return TestResult(ok=False, message="No Anthropic API key configured")
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=api_key)
            await client.models.list()
            return TestResult(ok=True, message="Anthropic API key is valid")
        except Exception as exc:
            return TestResult(ok=False, message=str(exc))

    elif integration == "apple_health":
        secret = data.get("webhook_secret")
        if secret:
            return TestResult(ok=True, message="Webhook secret configured")
        return TestResult(ok=True, message="No webhook secret (open endpoint — any push accepted)")

    raise HTTPException(status_code=404, detail=f"Unknown integration: {integration}")
