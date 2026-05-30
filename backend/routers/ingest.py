import logging
import os
import tempfile
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal
from services import settings_service as svc
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


# ── DB-backed guards ───────────────────────────────────────────────────────────

async def _require_hevy(db: AsyncSession) -> str:
    """Check Hevy is enabled in DB and return the API key."""
    if not await svc.get_bool("hevy_enabled", db):
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")
    api_key = await svc.get_str("hevy_api_key", db)
    if not api_key:
        raise HTTPException(status_code=503, detail="Hevy API key not configured")
    return api_key


async def _require_strava(db: AsyncSession) -> tuple[str, str, str]:
    """Check Strava is enabled in DB and return (client_id, client_secret, redirect_uri)."""
    if not await svc.get_bool("strava_enabled", db):
        raise HTTPException(status_code=404, detail="Strava integration not enabled")
    client_id = await svc.get_str("strava_client_id", db) or ""
    client_secret = await svc.get_str("strava_client_secret", db) or ""
    redirect_uri = (
        await svc.get_str("strava_redirect_uri", db)
        or "http://localhost:8010/ingest/strava/callback"
    )
    if not (client_id and client_secret):
        raise HTTPException(status_code=503, detail="Strava client credentials not configured")
    return client_id, client_secret, redirect_uri


# ── Apple Health webhook ────────────────────────────────────────────────────────

@router.post("/apple-health")
async def ingest_apple_health(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: str | None = Header(None),
):
    """Receive Health Auto Export push. Always returns 200."""
    webhook_secret = await svc.get_str("webhook_secret", db)
    if webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != webhook_secret:
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


# ── Hevy API ────────────────────────────────────────────────────────────────────

@router.post("/hevy/sync")
async def sync_hevy(db: AsyncSession = Depends(get_db)):
    """On-demand pull from the Hevy API."""
    api_key = await _require_hevy(db)
    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(api_key)
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
    if not await svc.get_bool("hevy_enabled", db):
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")

    webhook_secret = await svc.get_str("webhook_secret", db)
    if webhook_secret:
        secret = x_webhook_secret or request.query_params.get("secret")
        if secret != webhook_secret:
            logger.warning("Hevy webhook: invalid secret")
            return {"status": "ok", "error": "invalid secret"}

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Hevy webhook: bad json — %s", exc)
        return {"status": "ok", "error": "invalid json"}

    api_key = await svc.get_str("hevy_api_key", db) or ""
    from services.ingestion.hevy import HevyAdapter
    adapter = HevyAdapter(api_key)

    try:
        workout_id = (payload.get("workout") or {}).get("id") or payload.get("id")
        if workout_id and api_key:
            result = await adapter.fetch_one_and_normalize(str(workout_id))
        else:
            inline = payload.get("workouts") or ([payload["workout"]] if payload.get("workout") else [])
            result = adapter.normalize({"workouts": inline})

        counts = await upsert(result, db)
        return _ingest_summary(counts)
    except Exception as exc:
        logger.error("Hevy webhook ingest error: %s", exc, exc_info=True)
        return {"status": "ok", "error": str(exc)}


# ── Strava OAuth + polling ──────────────────────────────────────────────────────

@router.get("/strava/connect")
async def strava_connect(db: AsyncSession = Depends(get_db)):
    """Redirect the user to Strava's OAuth consent screen."""
    client_id, _, redirect_uri = await _require_strava(db)
    from services.ingestion.strava import authorize_url
    return RedirectResponse(authorize_url(client_id, redirect_uri))


@router.get("/strava/callback")
async def strava_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """OAuth redirect target — exchanges the code for tokens, then returns to the UI."""
    client_id, client_secret, redirect_uri = await _require_strava(db)
    frontend_url = await svc.get_str("frontend_url", db) or "http://localhost:3010"
    if error or not code:
        return RedirectResponse(f"{frontend_url}/trends?strava=error")

    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db, client_id=client_id, client_secret=client_secret)
    await adapter.exchange_code(code)
    return RedirectResponse(f"{frontend_url}/trends?strava=connected")


@router.post("/strava/sync")
async def strava_sync(db: AsyncSession = Depends(get_db)):
    """Pull recent activities from Strava and upsert them."""
    client_id, client_secret, _ = await _require_strava(db)
    from services.ingestion.strava import StravaAdapter
    adapter = StravaAdapter(db, client_id=client_id, client_secret=client_secret)
    result = await adapter.pull_and_normalize()
    counts = await upsert(result, db)
    return _ingest_summary(counts)


# ── Bulk file import ────────────────────────────────────────────────────────────

def _new_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "progress": 0, "result": None, "error": None}
    return job_id


async def _write_temp(upload: UploadFile, suffix: str) -> str:
    tmp_dir = tempfile.mkdtemp()
    path = os.path.join(tmp_dir, f"upload{suffix}")
    data = await upload.read()
    with open(path, "wb") as f:
        f.write(data)
    return path


async def _run_import_job(job_id: str, file_path: str, source: str) -> None:
    _jobs[job_id]["status"] = "running"
    errors: list[str] = []
    try:
        async with AsyncSessionLocal() as db:
            if source == "apple_health":
                from services.ingestion.apple_health_file import AppleHealthFileAdapter
                result = AppleHealthFileAdapter().parse_file(file_path)
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
            "sets_added": counts.sets_inserted,
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
    suffix = ".zip" if (file.filename or "").lower().endswith(".zip") else ".xml"
    path = await _write_temp(file, suffix)
    job_id = _new_job()
    background_tasks.add_task(_run_import_job, job_id, path, "apple_health")
    return {"job_id": job_id}


@router.post("/hevy/import")
async def import_hevy(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.get_bool("hevy_enabled", db):
        raise HTTPException(status_code=404, detail="Hevy integration not enabled")
    path = await _write_temp(file, ".csv")
    job_id = _new_job()
    background_tasks.add_task(_run_import_job, job_id, path, "hevy")
    return {"job_id": job_id}


@router.post("/strava/import")
async def import_strava(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.get_bool("strava_enabled", db):
        raise HTTPException(status_code=404, detail="Strava integration not enabled")
    suffix = ".zip" if (file.filename or "").lower().endswith(".zip") else ".csv"
    path = await _write_temp(file, suffix)
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
