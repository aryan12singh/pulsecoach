import logging
import os
import tempfile
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db, AsyncSessionLocal
from services.ingestion.apple_health import AppleHealthAdapter
from services.ingestion.persist import upsert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])

_apple_adapter = AppleHealthAdapter()

# In-memory job store (single-user, process-local)
_jobs: dict[str, dict] = {}


def _ingest_summary(counts) -> dict:
    return {
        "status": "ok",
        "workouts_inserted": counts.workouts_inserted,
        "workouts_updated": counts.workouts_updated,
        "metrics_inserted": counts.metrics_inserted,
    }


# ── Apple Health webhook (existing) ────────────────────────────────────────────

@router.post("/apple-health")
async def ingest_apple_health(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(None),
):
    """Receive Health Auto Export push. Always returns 200."""
    if settings.webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != settings.webhook_secret:
            logger.warning("Apple Health webhook: invalid secret")
            return {"status": "ok", "error": "invalid secret"}

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Failed to parse Apple Health payload: %s", exc)
        return {"status": "ok", "error": "invalid json"}

    try:
        result = _apple_adapter.normalize(payload)
        counts = await upsert(result, db)
        logger.info(
            "Apple Health ingest: %d new / %d updated workouts, %d metrics",
            counts.workouts_inserted, counts.workouts_updated, counts.metrics_inserted,
        )
        return _ingest_summary(counts)
    except Exception as exc:
        logger.error("Apple Health ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


# ── Hevy API (existing) ─────────────────────────────────────────────────────────

@router.post("/hevy/sync")
async def sync_hevy(db: AsyncSession = Depends(get_db)):
    """On-demand pull from the Hevy API."""
    if not settings.enable_hevy:
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")
    if not settings.hevy_api_key:
        raise HTTPException(status_code=503, detail="HEVY_API_KEY not configured")

    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(settings.hevy_api_key)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return _ingest_summary(counts)


@router.post("/hevy/webhook")
async def hevy_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(None),
):
    """Receive a Hevy workout push. Always returns 200 so Hevy won't retry."""
    if not settings.enable_hevy:
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")

    if settings.webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != settings.webhook_secret:
            logger.warning("Hevy webhook: invalid secret")
            return {"status": "ok", "error": "invalid secret"}

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Hevy webhook: bad json — %s", exc)
        return {"status": "ok", "error": "invalid json"}

    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(settings.hevy_api_key or "")

    try:
        workout_id = (payload.get("workout") or {}).get("id") or payload.get("id")
        if workout_id and settings.hevy_api_key:
            result = await adapter.fetch_one_and_normalize(str(workout_id))
        else:
            inline = payload.get("workouts") or ([payload["workout"]] if payload.get("workout") else [])
            result = adapter.normalize({"workouts": inline})

        counts = await upsert(result, db)
        return _ingest_summary(counts)
    except Exception as exc:
        logger.error("Hevy webhook ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


# ── Strava OAuth + polling (existing) ───────────────────────────────────────────

def _require_strava() -> None:
    if not settings.enable_strava:
        raise HTTPException(status_code=404, detail="Strava integration not enabled")
    if not (settings.strava_client_id and settings.strava_client_secret):
        raise HTTPException(status_code=503, detail="Strava client credentials not configured")


@router.get("/strava/connect")
async def strava_connect():
    """Redirect the user to Strava's OAuth consent screen."""
    _require_strava()
    from services.ingestion.strava import authorize_url
    return RedirectResponse(authorize_url())


@router.get("/strava/callback")
async def strava_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """OAuth redirect target — exchanges the code for tokens, then returns to the UI."""
    _require_strava()
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/trends?strava=error")

    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db)
    await adapter.exchange_code(code)
    return RedirectResponse(f"{settings.frontend_url}/trends?strava=connected")


@router.post("/strava/sync")
async def strava_sync(db: AsyncSession = Depends(get_db)):
    """Pull recent activities from Strava and upsert them."""
    _require_strava()
    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return _ingest_summary(counts)


# ── Bulk file import endpoints ──────────────────────────────────────────────────

def _new_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "progress": 0, "result": None, "error": None}
    return job_id


def _write_temp(upload: UploadFile, suffix: str) -> str:
    tmp_dir = tempfile.mkdtemp()
    path = os.path.join(tmp_dir, f"upload{suffix}")
    # Read synchronously — upload.file is a SpooledTemporaryFile
    with open(path, "wb") as f:
        f.write(upload.file.read())
    return path


async def _run_import_job(job_id: str, file_path: str, source: str) -> None:
    _jobs[job_id]["status"] = "running"
    errors: list[str] = []
    try:
        async with AsyncSessionLocal() as db:
            if source == "apple_health":
                from services.ingestion.apple_health_file import AppleHealthFileAdapter
                adapter = AppleHealthFileAdapter()
                result = adapter.parse_file(file_path)
            elif source == "hevy":
                from services.ingestion.hevy_csv import parse_csv_file
                with open(file_path, encoding="utf-8", errors="replace") as f:
                    content = f.read()
                result = parse_csv_file(content)
            elif source == "strava":
                from services.ingestion.strava_csv import parse_file
                result = parse_file(file_path)
            else:
                raise ValueError(f"Unknown source: {source}")

            counts = await upsert(result, db)

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = {
            "workouts_added": counts.workouts_inserted,
            "workouts_skipped_dupe": counts.workouts_updated,
            "sets_added": getattr(counts, "sets_inserted", 0),
            "metrics_added": counts.metrics_inserted,
            "errors": errors,
        }
    except Exception as exc:
        logger.error("Import job %s failed: %s", job_id, exc, exc_info=True)
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(exc)
    finally:
        try:
            os.remove(file_path)
            os.rmdir(os.path.dirname(file_path))
        except Exception:
            pass


@router.post("/apple-health/import")
async def import_apple_health(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Accept export.zip or export.xml from Apple Health and queue a background import."""
    suffix = ".zip" if (file.filename or "").lower().endswith(".zip") else ".xml"
    path = _write_temp(file, suffix)
    job_id = _new_job()
    background_tasks.add_task(_run_import_job, job_id, path, "apple_health")
    return {"job_id": job_id}


@router.post("/hevy/import")
async def import_hevy(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Accept a Hevy workout CSV or measurements CSV and queue a background import."""
    path = _write_temp(file, ".csv")
    job_id = _new_job()
    background_tasks.add_task(_run_import_job, job_id, path, "hevy")
    return {"job_id": job_id}


@router.post("/strava/import")
async def import_strava(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Accept Strava bulk export .zip or activities.csv and queue a background import."""
    suffix = ".zip" if (file.filename or "").lower().endswith(".zip") else ".csv"
    path = _write_temp(file, suffix)
    job_id = _new_job()
    background_tasks.add_task(_run_import_job, job_id, path, "strava")
    return {"job_id": job_id}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Poll the status of a background import job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
