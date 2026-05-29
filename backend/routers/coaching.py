from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CoachingSession
from schemas import ChatIn, ChatOut

router = APIRouter(prefix="/coaching", tags=["coaching"])


@router.post("/chat", response_model=ChatOut, status_code=201)
async def chat(body: ChatIn, db: AsyncSession = Depends(get_db)):
    from services.claude_service import get_coaching_response
    session = await get_coaching_response(body.message, db)
    return session


@router.get("/history", response_model=list[ChatOut])
async def history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    stmt = select(CoachingSession).order_by(CoachingSession.created_at.desc()).limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    return rows
