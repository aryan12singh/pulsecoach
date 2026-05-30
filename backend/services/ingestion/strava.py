"""Strava adapter (OAuth2 + polling pull). Only active when ENABLE_STRAVA=true.

Strava activities import strength sets/reps/weight only via partner apps (e.g. Hevy),
so this adapter captures the workout envelope; in-gym detail still comes from Hevy.
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import OAuthToken, SourceEnum, WorkoutTypeEnum
from services.ingestion.base import IngestResult, NormalizedWorkout, SourceAdapter

logger = logging.getLogger(__name__)

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"

_TYPE_MAP: dict[str, WorkoutTypeEnum] = {
    "run": WorkoutTypeEnum.running,
    "trailrun": WorkoutTypeEnum.running,
    "virtualrun": WorkoutTypeEnum.running,
    "ride": WorkoutTypeEnum.cycling,
    "virtualride": WorkoutTypeEnum.cycling,
    "ebikeride": WorkoutTypeEnum.cycling,
    "walk": WorkoutTypeEnum.walking,
    "hike": WorkoutTypeEnum.walking,
    "weighttraining": WorkoutTypeEnum.strength,
    "workout": WorkoutTypeEnum.strength,
    "crossfit": WorkoutTypeEnum.strength,
}


def authorize_url(client_id: str, redirect_uri: str) -> str:
    """Build the Strava consent URL the user is redirected to."""
    from urllib.parse import urlencode
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": "activity:read_all",
    }
    return f"{STRAVA_AUTH_URL}?{urlencode(params)}"


class StravaAdapter(SourceAdapter):
    source_name = "strava"

    def __init__(self, db: AsyncSession, client_id: str = "", client_secret: str = "") -> None:
        self._db = db
        self._client_id = client_id
        self._client_secret = client_secret

    # ── OAuth ────────────────────────────────────────────────────────────────

    async def exchange_code(self, code: str) -> OAuthToken:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(STRAVA_TOKEN_URL, data={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code": code,
                "grant_type": "authorization_code",
            })
            resp.raise_for_status()
            body = resp.json()
        return await self._store_token(body)

    async def _store_token(self, body: dict) -> OAuthToken:
        expires_at = (
            datetime.fromtimestamp(body["expires_at"], tz=timezone.utc)
            if body.get("expires_at") else None
        )
        existing = (await self._db.execute(
            select(OAuthToken).where(OAuthToken.provider == "strava")
        )).scalar_one_or_none()

        if existing:
            existing.access_token = body["access_token"]
            existing.refresh_token = body.get("refresh_token", existing.refresh_token)
            existing.expires_at = expires_at
            existing.scope = body.get("scope", existing.scope)
            existing.raw_data = body
            token = existing
        else:
            token = OAuthToken(
                provider="strava",
                access_token=body["access_token"],
                refresh_token=body.get("refresh_token"),
                expires_at=expires_at,
                scope=body.get("scope"),
                raw_data=body,
            )
            self._db.add(token)
        await self._db.commit()
        await self._db.refresh(token)
        return token

    async def _valid_access_token(self) -> str:
        token = (await self._db.execute(
            select(OAuthToken).where(OAuthToken.provider == "strava")
        )).scalar_one_or_none()
        if not token:
            raise RuntimeError("Strava not connected — visit /ingest/strava/connect first")

        # Refresh if expired (or about to)
        if token.expires_at and token.expires_at <= datetime.now(timezone.utc) + timedelta(minutes=5):
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(STRAVA_TOKEN_URL, data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": token.refresh_token,
                })
                resp.raise_for_status()
                await self._store_token(resp.json())
                token = (await self._db.execute(
                    select(OAuthToken).where(OAuthToken.provider == "strava")
                )).scalar_one()

        return token.access_token

    # ── Pull + normalise ──────────────────────────────────────────────────────

    async def pull_and_normalize(self, per_page: int = 50, days_back: int = 30) -> IngestResult:
        access_token = await self._valid_access_token()
        after = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

        activities: list[dict] = []
        page = 1
        async with httpx.AsyncClient(
            headers={"Authorization": f"Bearer {access_token}"}, timeout=30,
        ) as client:
            while True:
                resp = await client.get(
                    f"{STRAVA_API_BASE}/athlete/activities",
                    params={"after": after, "per_page": per_page, "page": page},
                )
                resp.raise_for_status()
                batch = resp.json()
                activities.extend(batch)
                if len(batch) < per_page:
                    break
                page += 1

        return self.normalize({"activities": activities})

    def normalize(self, payload: Any) -> IngestResult:
        result = IngestResult()
        for raw in payload.get("activities", []):
            try:
                result.workouts.append(self._parse_activity(raw))
            except Exception as exc:
                logger.warning("Skipping Strava activity %s — %s", raw.get("id"), exc)
        return result

    def _parse_activity(self, raw: dict) -> NormalizedWorkout:
        sport = (raw.get("sport_type") or raw.get("type") or "").lower()
        start = datetime.fromisoformat(raw["start_date"].replace("Z", "+00:00"))
        elapsed = raw.get("elapsed_time") or raw.get("moving_time") or 0
        distance_m = raw.get("distance")

        return NormalizedWorkout(
            source=SourceEnum.strava,
            external_id=str(raw["id"]),
            workout_type=_TYPE_MAP.get(sport, WorkoutTypeEnum.other),
            raw_type=raw.get("sport_type") or raw.get("type"),
            start_at=start,
            end_at=start + timedelta(seconds=elapsed) if elapsed else None,
            duration_mins=round(elapsed / 60, 2),
            active_calories=raw.get("calories") or raw.get("kilojoules"),
            avg_heart_rate=raw.get("average_heartrate"),
            max_heart_rate=raw.get("max_heartrate"),
            distance_km=round(distance_m / 1000, 3) if distance_m else None,
            raw_data=raw,
        )
