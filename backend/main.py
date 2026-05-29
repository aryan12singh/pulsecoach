from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas import AppConfig

app = FastAPI(title="PulseCoach API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Always-on routers
from routers import ingest, workouts, strength, metrics, goals
app.include_router(ingest.router)
app.include_router(workouts.router)
app.include_router(strength.router)
app.include_router(metrics.router)
app.include_router(goals.router)

# Optional coaching router
if settings.enable_coaching:
    from routers import coaching
    app.include_router(coaching.router)


@app.get("/config", response_model=AppConfig)
async def get_config():
    return AppConfig(
        coaching_enabled=settings.enable_coaching,
        hevy_enabled=settings.enable_hevy,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
