import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database import AsyncSessionLocal, engine
from schemas import AppConfig

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("pulsecoach")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        from services.settings_service import seed_from_env
        await seed_from_env(db)
    yield


app = FastAPI(title="PulseCoach API", version="1.1.0", lifespan=lifespan)

# Same-origin requests through the frontend's /api proxy never need CORS;
# this list covers direct browser -> backend access (local dev, custom setups).
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3010",
    "http://frontend:3000",
    "http://frontend:3010",
]
if os.environ.get("FRONTEND_URL"):
    _cors_origins.append(os.environ["FRONTEND_URL"].rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    duration_ms = (time.perf_counter() - start) * 1000
    if request.url.path != "/health":
        logger.info(
            "%s %s -> %d (%.0fms)",
            request.method, request.url.path, response.status_code, duration_ms,
        )
    return response


from routers import (
    analytics,
    coaching,
    export,
    goals,
    ingest,
    metrics,
    settings as settings_router,
    strength,
    workouts,
)

app.include_router(ingest.router)
app.include_router(workouts.router)
app.include_router(strength.router)
app.include_router(metrics.router)
app.include_router(goals.router)
app.include_router(analytics.router)
app.include_router(coaching.router)
app.include_router(settings_router.router)
app.include_router(export.router)


@app.get("/config", response_model=AppConfig)
async def get_config():
    async with AsyncSessionLocal() as db:
        from services.settings_service import get_bool
        return AppConfig(
            coaching_enabled=await get_bool("coaching_enabled", db),
            hevy_enabled=await get_bool("hevy_enabled", db),
            strava_enabled=await get_bool("strava_enabled", db),
            analytics_enabled=True,
        )


@app.get("/health")
async def health():
    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_ok = False
        logger.error("Health check: database unreachable — %s", exc)
    status = "ok" if db_ok else "degraded"
    return {"status": status, "database": "up" if db_ok else "down", "version": app.version}
