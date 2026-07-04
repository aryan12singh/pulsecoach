# PulseCoach

A self-hosted personal health and training dashboard. Pulls data from Apple Health, Hevy, and Strava, tracks goals against real metrics, and optionally adds AI coaching powered by Claude.

**Single-user by design.** Clone it, run it, own your data completely.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
  - [.env reference](#env-reference)
  - [In-app Settings](#in-app-settings)
- [Connecting data sources](#connecting-data-sources)
  - [Apple Health — live webhook](#apple-health--live-webhook)
  - [Apple Health — bulk import](#apple-health--bulk-import)
  - [Hevy — live API sync](#hevy--live-api-sync-requires-pro)
  - [Hevy — CSV import (free)](#hevy--csv-import-free)
  - [Strava — OAuth sync](#strava--oauth-sync)
  - [Strava — bulk archive import](#strava--bulk-archive-import)
- [Features](#features)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Using it from your phone](#using-it-from-your-phone)
- [Exporting & backing up](#exporting--backing-up)
- [Development](#development)
- [Stopping & resetting](#stopping--resetting)
- [Security notes](#security-notes)

---

## What it does

| Feature | Details |
|---|---|
| **Dashboard** | Weekly summary cards — sessions, volume, calories, sleep, weight trend |
| **Workouts** | Full workout history with per-exercise set/rep/weight breakdown |
| **Trends** | Time-series charts for weight, BMI, resting HR, HRV, VO2 max, sleep, steps |
| **Goals** | Set targets (sessions/week, strength volume, body weight, sleep) with live progress rings |
| **Analytics** | Personal records, volume by muscle group, ACWR-based overtraining flags |
| **AI Coach** | Chat interface powered by Claude — weekly check-ins, programming advice, trend summaries |
| **Settings** | Enable/disable integrations and enter credentials in-app — no `.env` edits needed after initial boot |
| **Bulk import** | One-shot historical backfill from Apple Health export, Hevy CSV, or Strava archive |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  (http://localhost:3010)                           │
│  Next.js 15 · React 18 · TypeScript · Tailwind CSS         │
└────────────────────┬────────────────────────────────────────┘
                     │ fetch  (http://localhost:8010)
┌────────────────────▼────────────────────────────────────────┐
│  FastAPI backend  (port 8000 inside container → 8010 host)  │
│                                                             │
│  Routers                                                    │
│  ├── /ingest     Apple Health · Hevy · Strava               │
│  ├── /workouts   CRUD + weekly/monthly summaries            │
│  ├── /strength   Per-exercise progress                      │
│  ├── /metrics    Health metrics                             │
│  ├── /goals      Goal management + live progress            │
│  ├── /analytics  PRs · muscle volume · overtraining         │
│  ├── /coaching   Claude AI chat                             │
│  └── /settings   DB-backed runtime config                   │
│                                                             │
│  Services                                                   │
│  ├── ingestion/   Normalisation + dedup upsert pipeline     │
│  │   ├── apple_health.py      Live webhook                  │
│  │   ├── apple_health_file.py Bulk XML/ZIP parser           │
│  │   ├── hevy.py              API adapter (Pro)             │
│  │   ├── hevy_csv.py          CSV importer (free)           │
│  │   ├── strava.py            OAuth adapter                 │
│  │   ├── strava_csv.py        Bulk archive importer         │
│  │   ├── persist.py           Shared dedup + upsert         │
│  │   └── base.py              Normalised data models        │
│  ├── analytics_service.py                                   │
│  ├── claude_service.py                                      │
│  ├── goal_service.py                                        │
│  └── settings_service.py  DB-backed config with env seed    │
└────────────────────┬────────────────────────────────────────┘
                     │ asyncpg
┌────────────────────▼────────────────────────────────────────┐
│  PostgreSQL 16  (port 5432 inside · not exposed to host)    │
│  Tables: workouts · strength_sets · health_metrics          │
│          goals · oauth_tokens · coaching_sessions           │
│          app_settings                                       │
└─────────────────────────────────────────────────────────────┘
```

**Data flow — ingestion:** Every source (webhook, API pull, or file upload) normalises into the same `NormalizedWorkout / NormalizedStrengthSet / NormalizedMetric` structs, then passes through the shared `persist.py` dedup-and-upsert layer. Re-importing the same data is always idempotent.

**Config precedence:** On first boot, `app_settings` is seeded from env vars. After that, the database is the source of truth. The Settings UI writes to the DB; all runtime checks (feature flags, credentials) read from there. Only `DATABASE_URL` and `NEXT_PUBLIC_API_URL` remain as hard environment requirements.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac / Windows / Linux)

No local Python or Node installation required.

---

## Quickstart

```bash
git clone https://github.com/aryan12singh/pulsecoach
cd pulsecoach
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3010 |
| API (interactive docs) | http://localhost:8010/docs |

On first run the app automatically:
1. Runs all database migrations (`alembic upgrade head`)
2. Seeds 30 days of realistic health and workout data so every page has something to show
3. Copies your `.env` values into `app_settings` as bootstrap defaults

Subsequent starts skip the seed (it checks for existing data first) and any new migration is applied automatically.

---

## Configuration

### .env reference

Copy `.env.example` to `.env`. You only need to fill in what you want to use — everything defaults to disabled.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **yes** | set by Compose | Postgres connection string — do not change when using Docker Compose |
| `NEXT_PUBLIC_API_URL` | no | *(empty — use `/api` proxy)* | Leave empty so the browser talks to the API through the frontend's same-origin `/api` proxy (works from phones/other hosts without a rebuild). Set to `http://localhost:8010` to hit the backend directly |
| `BACKEND_URL` | no | `http://backend:8000` | Where the frontend's `/api` proxy forwards requests (runtime, not baked into the build) |
| `APP_PASSWORD` | no | *(empty — no login)* | Set to require a password for every page and API call; webhook endpoints still use `WEBHOOK_SECRET` |
| `SEED_DEMO` | no | `false` | Set `true` to load demo workouts/metrics into an empty database |
| `LOG_LEVEL` | no | `INFO` | Backend log verbosity (`DEBUG`/`INFO`/`WARNING`) |
| `ENABLE_HEVY` | no | `false` | Bootstrap: seed `hevy_enabled` on first run |
| `HEVY_API_KEY` | no | — | Bootstrap: seed `hevy_api_key` on first run |
| `ENABLE_STRAVA` | no | `false` | Bootstrap: seed `strava_enabled` on first run |
| `STRAVA_CLIENT_ID` | no | — | Bootstrap: seed `strava_client_id` on first run |
| `STRAVA_CLIENT_SECRET` | no | — | Bootstrap: seed `strava_client_secret` on first run |
| `STRAVA_REDIRECT_URI` | no | `http://localhost:8010/ingest/strava/callback` | Must match your Strava app's callback URL |
| `FRONTEND_URL` | no | `http://localhost:3010` | Used for post-OAuth redirect back to the UI |
| `ENABLE_COACHING` | no | `false` | Bootstrap: seed `coaching_enabled` on first run |
| `ANTHROPIC_API_KEY` | no | — | Bootstrap: seed `anthropic_api_key` on first run |
| `CLAUDE_MODEL` | no | `claude-opus-4-8` | Bootstrap: seed `claude_model` on first run; leave blank to use the default |
| `WEBHOOK_SECRET` | no | — | Bootstrap: seed `webhook_secret` — if set, Apple Health and Hevy webhook calls must include this value |

> **Bootstrap vs. runtime:** These env vars only take effect the first time the container starts against a fresh database. After that, use the **Settings page** in the app to change anything. To force a re-seed, run `docker compose down -v` to wipe the volume, then `docker compose up --build`.

### In-app Settings

Navigate to **Settings** (gear icon in the nav) to:

- Toggle each integration on or off
- Enter or rotate API keys and OAuth credentials
- Click **Test connection** to verify a key is working before saving
- Upload historical data files for any source

Changes take effect immediately without restarting the container.

---

## Connecting data sources

### Apple Health — live webhook

Streams health metrics and workout envelopes in near-real-time using the [Health Auto Export](https://www.healthautoexport.com/) iOS app.

1. Install Health Auto Export on your iPhone.
2. Open it and go to **Automations → Add Automation**.
3. Set **Destination** → **REST API**, URL → `http://<your-machine-ip>:8010/ingest/apple-health`.
4. Set **Export format** → **JSON** and choose a schedule (e.g. every hour).
5. If you set a webhook secret in Settings, add an `X-Webhook-Secret` header with the same value.

The endpoint always returns `200 OK` regardless of parse errors so Health Auto Export never retries on a bad record.

> Your machine IP: run `ipconfig getifaddr en0` (Mac) or check your network settings. Must be on the same Wi-Fi network as your iPhone, or exposed via a tunnel (e.g. ngrok).

### Apple Health — bulk import

Use this to backfill your full history without the live webhook.

1. On your iPhone: **Health app → profile picture → Export All Health Data**.
2. This produces `export.zip` — AirDrop or share it to your Mac.
3. In the app, go to **Settings → Import data → Apple Health export** and upload the zip.

The import is streamed using `lxml.etree.iterparse` so even large exports (200 MB+) are processed without running out of memory. Progress is shown live; the result summary lists how many workouts and metrics were added.

**What gets imported:**

| Apple Health record | Maps to |
|---|---|
| BodyMass | `weight_kg` (kg) |
| BodyMassIndex | `bmi` |
| RestingHeartRate | `resting_hr` (bpm) |
| HeartRateVariabilitySDNN | `hrv` (ms) |
| StepCount | `steps` (summed per day) |
| ActiveEnergyBurned | `active_energy` (kcal, summed per day) |
| VO2Max | `vo2max` (mL/kg/min) |
| BodyFatPercentage | `body_fat_pct` (%) |
| SleepAnalysis (asleep intervals) | `sleep_hours` (summed per night) |
| Workout records | workouts (envelope — no set/rep detail) |

---

### Hevy — live API sync (requires Pro)

Hevy's API requires an active [Hevy Pro](https://hevy.com/pro) subscription. Get your API key from the Hevy app: **Profile → Settings → API**.

**Option A — Settings UI (recommended):**
1. Go to **Settings → Hevy**, toggle it on, paste your API key, click **Save changes**.
2. The **Sync Hevy** button appears in the nav immediately.

**Option B — `.env` bootstrap:**
```env
ENABLE_HEVY=true
HEVY_API_KEY=your_hevy_api_key
```
Then `docker compose up --build` on a fresh database.

Click **Sync Hevy** in the nav to pull all workouts with full set/rep/weight detail.

**Webhook (optional):** Configure Hevy to push new workouts to `POST /ingest/hevy/webhook`. The receiver re-fetches the full workout by ID so no detail is lost.

### Hevy — CSV import (free)

No Pro subscription needed. Use this to backfill historical data.

1. Hevy app → **Profile → Settings → Export & Import Data**.
2. Export the **workout CSV** (set-by-set rows) and optionally the **measurements CSV**.
3. **Settings → Import data → Hevy CSV** — upload either or both files.

The importer auto-detects which CSV you uploaded by inspecting the header row. Workout data is imported with full `strength_sets` records — the same detail you'd get from the API.

---

### Strava — OAuth sync

Pulls your recent activities (last 30 days by default) from the Strava API.

**Step 1 — Create a Strava API application:**
1. Go to [strava.com/settings/api](https://www.strava.com/settings/api).
2. Create an app. Set **Authorization Callback Domain** to `localhost`.
3. Copy your **Client ID** and **Client Secret**.

**Step 2 — Configure in Settings:**
1. **Settings → Strava**, toggle on, enter Client ID and Client Secret, click **Save changes**.
2. Click **Connect Strava account** — you'll be redirected to Strava to authorise.
3. After authorising, you'll be redirected back. The OAuth tokens (with auto-refresh) are stored in the database.
4. Use **Sync Strava** or the nav button to pull activities.

> Strava records the workout envelope (type, duration, distance, HR, calories). Set/rep detail for strength sessions still comes from Hevy.

### Strava — bulk archive import

Backfills your full Strava history without the API.

1. [strava.com](https://www.strava.com) → **Settings → My Account → Download or Delete Your Account → Get Started → Request your archive**.
2. Strava emails you a download link. The archive is a `.zip` containing `activities.csv`.
3. **Settings → Import data → Strava archive** — upload the zip (or just `activities.csv`).

> Set/rep strength detail is not reliably included in the Strava bulk export. Use Hevy CSV for strength history.

---

## Features

### Dashboard

Shows a weekly snapshot: session count, total calories, avg duration, strength volume, and recent body weight. Includes a monthly trend chart and a list of your last 5 workouts.

### Workouts

Full session log with filtering by type and date range. Drill into any workout to see the complete exercise breakdown — every set, weight, reps, and RPE.

### Trends

Interactive time-series charts for all tracked health metrics. Toggle between different metrics and adjust the date range.

### Goals

Create goals against any tracked metric. Each goal shows a live progress ring calculated from your actual data.

| Goal type | Metric scope | Comparison |
|---|---|---|
| `sessions_per_week` | workout count | ≥ |
| `total_volume_weekly` | strength volume (kg·reps) | ≥ |
| `weight_target` | health metric | ≤ |
| `sleep_avg_hours` | health metric | ≥ |

### Analytics

- **Personal records** — all-time best weight and estimated 1RM (Epley formula) per exercise, with a "recent PR" badge for PRs set in the last 30 days.
- **Volume by muscle group** — total set volume mapped to muscle groups over a configurable window.
- **Recovery & load** — acute:chronic workload ratio (ACWR) and week-over-week volume spike detection.

### AI Coaching

Chat interface powered by Claude. The coach has access to your recent training load, strength trends, health metrics, and goals. Try "Give me my weekly check-in" for a structured summary.

Requires an [Anthropic API key](https://console.anthropic.com/). Enable it in **Settings → AI Coaching**.

---

## API reference

Interactive Swagger docs are available at **http://localhost:8010/docs** while the stack is running.

### Key endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/config` | Feature flags (read by the frontend to show/hide nav items) |
| `GET` | `/settings` | Current config — secrets are masked |
| `PUT` | `/settings` | Update flags or credentials |
| `POST` | `/settings/test/{integration}` | Test a live connection (`hevy`, `strava`, `coaching`, `apple_health`) |
| `POST` | `/ingest/apple-health` | Apple Health webhook receiver |
| `POST` | `/ingest/hevy/sync` | Pull latest workouts from Hevy API |
| `POST` | `/ingest/hevy/webhook` | Hevy webhook receiver |
| `GET` | `/ingest/strava/connect` | Begin Strava OAuth flow |
| `POST` | `/ingest/strava/sync` | Pull recent Strava activities |
| `POST` | `/ingest/apple-health/import` | Bulk import from Apple Health export file |
| `POST` | `/ingest/hevy/import` | Bulk import from Hevy CSV |
| `POST` | `/ingest/strava/import` | Bulk import from Strava archive |
| `GET` | `/ingest/jobs/{id}` | Poll a background import job |
| `GET` | `/workouts` | List workouts |
| `POST` | `/workouts` | Log a workout manually |
| `GET` | `/metrics` | List health metrics |
| `POST` | `/metrics` | Log a metric manually |
| `GET` | `/goals` | List goals with live progress |
| `GET` | `/analytics/summary` | PRs, muscle volume, overtraining flags |
| `POST` | `/coaching/chat` | Send a message to the AI coach |

---

## Project structure

```
pulsecoach/
├── .env                        # Your local config (gitignored)
├── .env.example                # Template — copy to .env
├── docker-compose.yml          # Orchestrates db + backend + frontend
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI app, CORS, lifespan (DB seed)
│   ├── config.py               # Pydantic settings (bootstrap env vars only)
│   ├── database.py             # SQLAlchemy async engine + session
│   ├── models.py               # ORM models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── seed.py                 # Demo data (runs once on fresh DB)
│   ├── alembic/                # Database migrations
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002_oauth_tokens.py
│   │       └── 0003_app_settings.py
│   ├── routers/
│   │   ├── ingest.py           # All data ingestion endpoints
│   │   ├── workouts.py
│   │   ├── strength.py
│   │   ├── metrics.py
│   │   ├── goals.py
│   │   ├── analytics.py
│   │   ├── coaching.py
│   │   └── settings.py
│   └── services/
│       ├── settings_service.py # DB-backed config (read/write app_settings)
│       ├── analytics_service.py
│       ├── claude_service.py
│       ├── goal_service.py
│       └── ingestion/
│           ├── base.py         # NormalizedWorkout / NormalizedMetric models
│           ├── persist.py      # Shared dedup + upsert (all sources use this)
│           ├── apple_health.py     # Live webhook normaliser
│           ├── apple_health_file.py # Bulk XML/ZIP parser (streaming)
│           ├── hevy.py             # Hevy API adapter
│           ├── hevy_csv.py         # Hevy CSV importer
│           ├── strava.py           # Strava OAuth adapter
│           └── strava_csv.py       # Strava bulk archive importer
│
└── frontend/
    ├── Dockerfile
    ├── next.config.ts
    └── src/
        ├── app/
        │   ├── page.tsx            # Dashboard
        │   ├── workouts/
        │   ├── trends/
        │   ├── goals/
        │   ├── analytics/
        │   ├── coach/
        │   └── settings/           # Integration config + bulk import
        ├── components/
        │   ├── Nav.tsx
        │   └── ui/                 # Button, Card, Switch, Modal, etc.
        ├── lib/
        │   ├── api.ts              # Typed fetch wrapper for all endpoints
        │   └── fmt.ts              # Number / date formatters
        └── types/
            └── index.ts            # Shared TypeScript types
```

---

## Using it from your phone

The frontend serves the API through its own origin (`/api`), so any device that
can reach port 3010 gets the full app — no extra config:

1. `docker compose up -d`, then find your computer's LAN IP (`ipconfig getifaddr en0` on macOS).
2. On your phone, open `http://<that-ip>:3010`.
3. iOS Safari: Share → **Add to Home Screen** — PulseCoach installs as a standalone app with its own icon.
4. Import files directly from the phone: Settings → Import data works with
   `export.zip` from the Files app.
5. Optional: set `APP_PASSWORD` in `.env` to require a login — worthwhile on
   any network you don't fully control.

For access away from home (and HTTPS), see [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Exporting & backing up

- **Settings → Your data → Download JSON** exports every workout, strength set,
  health metric and goal (`GET /export/json`).
- Workouts can be deleted individually from their detail page (bad imports, test entries).
- Full backup incl. settings + coaching history:
  `docker compose exec db pg_dump -U pulsecoach pulsecoach > backup.sql`

---

## Development

Backend tests and lint (no database needed — tests cover the parsers and pure logic):

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest        # unit tests
ruff check .  # lint
```

Frontend typecheck/build:

```bash
cd frontend
npm ci
npx tsc --noEmit
npm run build
```

CI runs all four on every push/PR (`.github/workflows/ci.yml`).

---

## Stopping & resetting

```bash
# Stop the stack, keep your data
docker compose down

# Stop and wipe the database (fresh start; demo data only if SEED_DEMO=true)
docker compose down -v

# Rebuild images after code changes
docker compose up --build
```

---

## Security notes

This app is designed for **local, single-user use**. By default there is no login — anyone who can reach the port can access it. Set `APP_PASSWORD` in `.env` to require a password on every page and API call (webhooks still authenticate via `WEBHOOK_SECRET`); do this before exposing the app beyond your machine.

**On storing credentials in the database:**
- API keys and OAuth secrets are stored in the `app_settings` table inside your local Postgres volume.
- They are masked in API responses (never returned in plaintext).
- The Postgres volume (`postgres_data`) stays on your machine and is not included in any backup or sync by default.
- Do not expose port 8010 or 3010 to the public internet without adding authentication in front.
- Keep your `.env` and the Docker volume out of any shared or cloud-synced location.
- `.env` is already in `.gitignore` — never commit it.

**If you want to run this on a server:** put a reverse proxy with authentication (e.g. Caddy with `basic_auth`) in front of the frontend and keep the backend port firewalled — step-by-step instructions in [docs/DEPLOY.md](docs/DEPLOY.md). Note that secrets in `app_settings` are stored in plaintext inside your Postgres volume; protecting the volume and the ports is what protects the secrets.
