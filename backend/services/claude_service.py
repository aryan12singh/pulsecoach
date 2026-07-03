"""Claude AI coaching service. Reads configuration from DB-backed settings."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import CoachingSession, HealthMetric, Workout
from services import settings_service as svc

logger = logging.getLogger(__name__)

DEFAULT_CLAUDE_MODEL = "claude-opus-4-8"

# Days of workout/metric history included in the coaching context.
CONTEXT_DAYS = 14

SYSTEM_PROMPT = """You are a personal fitness coach reviewing real health and workout data.
Your tone is direct, honest, and specific — you always cite actual numbers from the data provided.
You are not a medical professional; redirect any health concerns to a doctor.
Keep responses to 300 words or fewer, structured as:
1. 2-3 sentence summary of the user's recent activity
2. Per-goal status (reference each active goal)
3. 2-3 observations from the data
4. 1-3 concrete next steps
Do not add caveats about the data being incomplete — work with what you have."""


async def get_coaching_response(user_message: str, db: AsyncSession) -> CoachingSession:
    if not await svc.get_bool("coaching_enabled", db):
        raise RuntimeError("Coaching is not enabled")
    api_key = await svc.get_str("anthropic_api_key", db)
    if not api_key:
        raise RuntimeError("Anthropic API key not configured — set it in Settings")
    model = await svc.get_str("claude_model", db) or DEFAULT_CLAUDE_MODEL

    context = await _build_context(db)
    full_message = f"""--- USER HEALTH CONTEXT ---
Date: {datetime.now(timezone.utc).date().isoformat()}
Active goals (with status): {json.dumps(context['goals'], default=str)}
Last {CONTEXT_DAYS} days workouts: {json.dumps(context['workouts'], default=str)}
Latest health metrics: {json.dumps(context['metrics'], default=str)}
Weekly summary: {json.dumps(context['weekly_summary'], default=str)}
User question: {user_message}
--- END CONTEXT ---"""

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_message}],
    )
    ai_text = next((b.text for b in response.content if b.type == "text"), "")

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
    from services.goal_service import evaluate_all

    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    weekly = await _build_summary(week_start, week_start + timedelta(days=7), db, is_weekly=True)
    goals = await evaluate_all(db)

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
    }
