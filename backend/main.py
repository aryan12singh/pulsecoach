from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import AsyncSessionLocal
from schemas import AppConfig


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        from services.settings_service import seed_from_env
        await seed_from_env(db)
    yield


app = FastAPI(title="PulseCoach API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3010",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Always-on routers
from routers import ingest, workouts, strength, metrics, goals, analytics, settings as settings_router
app.include_router(ingest.router)
app.include_router(workouts.router)
app.include_router(strength.router)
app.include_router(metrics.router)
app.include_router(goals.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)

# Optional coaching router
if settings.enable_coaching:
    from routers import coaching
    app.include_router(coaching.router)


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
    return {"status": "ok"}
