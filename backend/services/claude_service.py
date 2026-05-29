"""Claude AI coaching service. Only imported when ENABLE_COACHING=true."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import CoachingSession, Workout, HealthMetric

logger = logging.getLogger(__name__)

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
    if not settings.enable_coaching:
        raise RuntimeError("Coaching is not enabled")
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")
    if not settings.claude_model:
        raise RuntimeError("CLAUDE_MODEL not configured — see docs.claude.com for the current model name")

    context = await _build_context(db)
    full_message = f"""--- USER HEALTH CONTEXT ---
Date: {datetime.now(timezone.utc).date().isoformat()}
Active goals (with status): {json.dumps(context['goals'], default=str)}
Last 14 days workouts: {json.dumps(context['workouts'], default=str)}
Latest health metrics: {json.dumps(context['metrics'], default=str)}
Weekly summary: {json.dumps(context['weekly_summary'], default=str)}
User question: {user_message}
--- END CONTEXT ---"""

    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_message}],
    )
    ai_text = response.content[0].text

    session = CoachingSession(
        user_message=user_message,
        ai_response=ai_text,
        context_snapshot=context,
        model=settings.claude_model,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _build_context(db: AsyncSession) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=14)

    workouts_stmt = select(Workout).where(Workout.start_at >= since).order_by(Workout.start_at.desc())
    workouts = list((await db.execute(workouts_stmt)).scalars().all())

    metrics_stmt = (
        select(HealthMetric)
        .where(HealthMetric.recorded_at >= since)
        .order_by(HealthMetric.recorded_at.desc())
    )
    metrics = list((await db.execute(metrics_stmt)).scalars().all())

    from services.goal_service import evaluate_all
    from routers.workouts import _build_summary
    from datetime import date

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
            for m in metrics[:30]
        ],
        "weekly_summary": weekly.model_dump(),
        "goals": [g.model_dump() for g in goals],
    }
