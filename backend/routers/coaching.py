from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CoachingSession
from schemas import ChatIn, ChatOut
from services import settings_service as svc

router = APIRouter(prefix="/coaching", tags=["coaching"])


async def _require_coaching(db: AsyncSession) -> None:
    if not await svc.get_bool("coaching_enabled", db):
        raise HTTPException(status_code=404, detail="Coaching not enabled")


@router.post("/chat", response_model=ChatOut, status_code=201)
async def chat(body: ChatIn, db: AsyncSession = Depends(get_db)):
    await _require_coaching(db)
    from services.claude_service import get_coaching_response
    session = await get_coaching_response(body.message, db)
    return session


@router.get("/history", response_model=list[ChatOut])
async def history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    await _require_coaching(db)
    stmt = select(CoachingSession).order_by(CoachingSession.created_at.desc()).limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    return rows
