"""DB-backed settings with env-variable bootstrap and in-process caching."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as env_settings
from models import AppSetting

logger = logging.getLogger(__name__)

_MASK = "***"

# All known keys and whether they hold secret values
_SCHEMA: dict[str, bool] = {
    "hevy_enabled": False,
    "hevy_api_key": True,
    "strava_enabled": False,
    "strava_client_id": False,
    "strava_client_secret": True,
    "strava_redirect_uri": False,
    "frontend_url": False,
    "coaching_enabled": False,
    "anthropic_api_key": True,
    "claude_model": False,
    "webhook_secret": True,
}

# Simple in-process cache invalidated on every write
_cache: dict[str, str | None] | None = None
_cache_lock = asyncio.Lock()


def _env_defaults() -> dict[str, str | None]:
    return {
        "hevy_enabled": str(env_settings.enable_hevy).lower(),
        "hevy_api_key": env_settings.hevy_api_key,
        "strava_enabled": str(env_settings.enable_strava).lower(),
        "strava_client_id": env_settings.strava_client_id,
        "strava_client_secret": env_settings.strava_client_secret,
        "strava_redirect_uri": env_settings.strava_redirect_uri,
        "frontend_url": env_settings.frontend_url,
        "coaching_enabled": str(env_settings.enable_coaching).lower(),
        "anthropic_api_key": env_settings.anthropic_api_key,
        "claude_model": env_settings.claude_model,
        "webhook_secret": env_settings.webhook_secret,
    }


async def seed_from_env(db: AsyncSession) -> None:
    """Seed settings from env vars on first boot only.

    Every key uses DO NOTHING: env values populate an empty database, but once
    a row exists the Settings UI owns it — a restart never reverts a toggle or
    credential the user changed in the app.
    """
    defaults = _env_defaults()
    for key, value in defaults.items():
        stmt = (
            pg_insert(AppSetting)
            .values(key=key, value=value, is_secret=_SCHEMA.get(key, False))
            .on_conflict_do_nothing(index_elements=["key"])
        )
        await db.execute(stmt)
    await db.commit()
    _invalidate()
    logger.info("Settings seeded from env vars (existing values preserved)")


async def _load(db: AsyncSession) -> dict[str, str | None]:
    global _cache
    if _cache is not None:
        return _cache
    async with _cache_lock:
        if _cache is not None:
            return _cache
        rows = (await db.execute(select(AppSetting))).scalars().all()
        _cache = {r.key: r.value for r in rows}
        return _cache


def _invalidate() -> None:
    global _cache
    _cache = None


def _truthy(val: str | None) -> bool:
    return (val or "").lower() in ("true", "1", "yes")


def mask(value: str | None) -> str | None:
    if not value:
        return None
    return f"{value[:4]}…{value[-4:]}" if len(value) > 8 else _MASK


def is_masked(value: str | None) -> bool:
    """Return True if value looks like a masked secret — should not be written back to DB."""
    if not value:
        return True
    if value == _MASK:
        return True
    # Matches the "xxxx…xxxx" format produced by mask()
    if len(value) == 9 and value[4] == "…":
        return True
    return False


async def get_all(db: AsyncSession) -> dict[str, Any]:
    return await _load(db)


async def get_bool(key: str, db: AsyncSession) -> bool:
    data = await _load(db)
    return _truthy(data.get(key))


async def get_str(key: str, db: AsyncSession) -> str | None:
    data = await _load(db)
    return data.get(key)


async def set_many(updates: dict[str, str | None], db: AsyncSession) -> None:
    """Upsert multiple key-value pairs."""
    for key, value in updates.items():
        stmt = (
            pg_insert(AppSetting)
            .values(key=key, value=value, is_secret=_SCHEMA.get(key, False))
            .on_conflict_do_update(index_elements=["key"], set_={"value": value})
        )
        await db.execute(stmt)
    await db.commit()
    _invalidate()
