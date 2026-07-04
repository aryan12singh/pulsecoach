"""Claude AI coaching service. Reads configuration from DB-backed settings."""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import CoachingSession, HealthMetric, Workout
from services import settings_service as svc

logger = logging.getLogger(__name__)

DEFAULT_CLAUDE_MODEL = "claude-opus-4-8"

# Days of workout/metric history included in the coaching context.
CONTEXT_DAYS = 14
# Prior exchanges replayed so the chat is an actual conversation.
HISTORY_TURNS = 5

SYSTEM_PROMPT = """You are a personal fitness coach reviewing real health and workout data.
Your tone is direct, honest, and specific — you always cite actual numbers from the data provided.
You are not a medical professional; redirect any health concerns to a doctor.
Answer the user's actual question first. When giving a general check-in, structure it as:
1. 2-3 sentence summary of the user's recent activity
2. Per-goal status (reference each active goal)
3. 2-3 observations from the data (personal records, training load and muscle balance included)
4. 1-3 concrete next steps
Keep responses to 300 words or fewer.
Do not add caveats about the data being incomplete — work with what you have."""


async def _require_config(db: AsyncSession) -> tuple[str, str]:
    if not await svc.get_bool("coaching_enabled", db):
        raise RuntimeError("Coaching is not enabled")
    api_key = await svc.get_str("anthropic_api_key", db)
    if not api_key:
        raise RuntimeError("Anthropic API key not configured — set it in Settings")
    model = await svc.get_str("claude_model", db) or DEFAULT_CLAUDE_MODEL
    return api_key, model


async def _assemble_messages(user_message: str, db: AsyncSession) -> tuple[list[dict], dict]:
    """Prior exchanges as real turns + the new question wrapped with fresh data context."""
    context = await _build_context(db)
    full_message = f"""--- USER HEALTH CONTEXT ---
Date: {datetime.now(timezone.utc).date().isoformat()}
Active goals (with status): {json.dumps(context['goals'], default=str)}
Last {CONTEXT_DAYS} days workouts: {json.dumps(context['workouts'], default=str)}
Latest health metrics: {json.dumps(context['metrics'], default=str)}
Weekly summary: {json.dumps(context['weekly_summary'], default=str)}
Strength analytics: {json.dumps(context['analytics'], default=str)}
User question: {user_message}
--- END CONTEXT ---"""

    history = list((await db.execute(
        select(CoachingSession).order_by(CoachingSession.created_at.desc()).limit(HISTORY_TURNS)
    )).scalars().all())
    messages: list[dict] = []
    for session in reversed(history):
        messages.append({"role": "user", "content": session.user_message})
        messages.append({"role": "assistant", "content": session.ai_response})
    messages.append({"role": "user", "content": full_message})
    return messages, context


async def _persist(
    user_message: str, ai_text: str, context: dict, model: str, db: AsyncSession
) -> CoachingSession:
    session = CoachingSession(
        user_message=user_message,
        ai_response=ai_text,
        context_snapshot=context,
        model=model,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_coaching_response(user_message: str, db: AsyncSession) -> CoachingSession:
    api_key, model = await _require_config(db)
    messages, context = await _assemble_messages(user_message, db)

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    ai_text = next((b.text for b in response.content if b.type == "text"), "")
    return await _persist(user_message, ai_text, context, model, db)


async def stream_coaching_response(user_message: str, db: AsyncSession) -> AsyncIterator[str]:
    """Yield SSE events: {"type":"delta"} chunks, then {"type":"done"} with the saved session."""
    def sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    try:
        api_key, model = await _require_config(db)
        messages, context = await _assemble_messages(user_message, db)
    except Exception as exc:
        yield sse({"type": "error", "message": str(exc)})
        return

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    parts: list[str] = []
    try:
        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                parts.append(text)
                yield sse({"type": "delta", "text": text})
    except Exception as exc:
        logger.error("Coaching stream failed: %s", exc, exc_info=True)
        yield sse({"type": "error", "message": str(exc)})
        return

    ai_text = "".join(parts)
    session = await _persist(user_message, ai_text, context, model, db)
    yield sse({
        "type": "done",
        "session": {
            "id": session.id,
            "user_message": session.user_message,
            "ai_response": session.ai_response,
            "model": session.model,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        },
    })


async def _build_context(db: AsyncSession) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=CONTEXT_DAYS)

    workouts_stmt = select(Workout).where(Workout.start_at >= since).order_by(Workout.start_at.desc())
    workouts = list((await db.execute(workouts_stmt)).scalars().all())

    metrics_stmt = (
        select(HealthMetric)
        .where(HealthMetric.recorded_at >= since)
        .order_by(HealthMetric.recorded_at.desc())
    )
    metrics = list((await db.execute(metrics_stmt)).scalars().all())

    from routers.workouts import _build_summary
    from services import analytics_service
    from services.goal_service import evaluate_all

    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    weekly = await _build_summary(week_start, week_start + timedelta(days=7), db, is_weekly=True)
    goals = await evaluate_all(db)

    prs = await analytics_service.detect_prs(db, window_days=30)
    muscle = await analytics_service.muscle_volume(db, window_days=30)
    overtraining = await analytics_service.overtraining_flags(db)

    return {
        "workouts": [
            {
                "date": w.start_at.date().isoformat(),
                "type": w.workout_type.value,
                "duration_mins": w.duration_mins,
                "calories": w.active_calories,
                "avg_hr": w.avg_heart_rate,
            }
            for w in workouts
        ],
        "metrics": [
            {"type": m.metric_type, "value": m.value, "unit": m.unit, "date": m.date.isoformat()}
            for m in metrics[:60]
        ],
        "weekly_summary": weekly.model_dump(),
        "goals": [g.model_dump() for g in goals],
        "analytics": {
            "personal_records": [
                {
                    "exercise": p.exercise_name,
                    "best_weight": p.best_weight,
                    "unit": p.best_weight_unit,
                    "best_est_1rm": p.best_est_1rm,
                    "date": p.best_weight_date.isoformat(),
                    "recent_pr": p.is_recent_pr,
                }
                for p in prs[:15]
            ],
            "muscle_volume_30d": [
                {"group": m.muscle_group, "volume": m.total_volume, "sets": m.sets_count}
                for m in muscle
            ],
            "training_load": [
                {"metric": f.metric, "level": f.level, "value": f.value, "message": f.message}
                for f in overtraining
            ],
        },
    }
