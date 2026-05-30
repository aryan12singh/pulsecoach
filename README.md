# PulseCoach

A self-hosted, single-user personal health dashboard. Ingests data from Apple Health (via Health Auto Export), Hevy, and Strava. Tracks goals, shows trends, and optionally offers AI coaching powered by Claude.

**Single-user by design.** Clone it, run it, own your data.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac / Windows / Linux)

That's it. No local Python or Node installation needed.

---

## Quickstart

```bash
git clone https://github.com/aryan12singh/pulsecoach
cd pulsecoach
cp .env.example .env
docker compose up --build
```

- **Dashboard** → http://localhost:3010
- **API docs** → http://localhost:8010/docs

The app seeds itself with 30 days of realistic health data and 12 workouts so the dashboard is immediately useful on first run.

---

## Stopping & resetting

```bash
# Stop the stack (keeps your data)
docker compose down

# Stop and wipe the database (start fresh)
docker compose down -v
```

---

## Connect Apple Health (Health Auto Export)

1. Install [Health Auto Export](https://www.healthautoexport.com/) on your iPhone.
2. In the app, create an **Automation** with destination **REST API**.
3. Set the URL to `http://<your-machine-ip>:8010/ingest/apple-health`.
4. Choose export format **JSON** and set a schedule (e.g. every hour).
5. If you set `WEBHOOK_SECRET` in `.env`, add it as the `X-Webhook-Secret` header.

The endpoint always returns `200 OK` so the app never causes Health Auto Export to retry on partial failures.

---

## Enable Hevy (optional — requires Hevy Pro)

Hevy's API requires a **Pro subscription**. Get your API key from the Hevy app settings.

In your `.env`:

```env
ENABLE_HEVY=true
HEVY_API_KEY=your_hevy_api_key_here
```

Restart the stack (`docker compose up --build`). A **Sync Hevy** button appears in the nav. Click it to pull your latest workouts with full set/rep/weight detail.

Hevy can also push workouts to `POST /ingest/hevy/webhook` — the receiver re-fetches the full workout by ID so set detail is captured, and honours `WEBHOOK_SECRET` if set.

---

## Enable Strava (optional)

Register an API application at [strava.com/settings/api](https://www.strava.com/settings/api) to get a Client ID and Secret. Set the **Authorization Callback Domain** to your host (e.g. `localhost`).

In your `.env`:

```env
ENABLE_STRAVA=true
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:8010/ingest/strava/callback
FRONTEND_URL=http://localhost:3010
```

Restart the stack, then click **Connect Strava** in the nav to authorise. Tokens (with auto-refresh) are stored locally. Strava carries the workout envelope — in-gym set/rep detail still comes from Hevy.

---

## Analytics

The **Analytics** tab surfaces:
- **Personal records** — top weight and estimated 1RM (Epley formula) per exercise, with a "recent PR" badge.
- **Volume by muscle group** — set volume mapped to muscle groups over a selectable window.
- **Recovery & load** — acute:chronic workload ratio and week-over-week volume spike flags.

No keys required — it runs on whatever strength data you've logged.

---

## Enable AI Coaching (optional)

Requires an [Anthropic API key](https://console.anthropic.com/).

In your `.env`:

```env
ENABLE_COACHING=true
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
```

Restart the stack. A **Coach** tab appears. Use the quick-start prompts or ask anything — try "Give me my weekly check-in" for an AI summary of your last 14 days of training and health data.

> Check [docs.anthropic.com/en/docs/models-overview](https://docs.anthropic.com/en/docs/models-overview) for the latest model names.

---

## Goals

Go to **Goals** in the nav and click **+ Add Goal**.

| Goal type | Scope | Comparison | Example |
|---|---|---|---|
| `sessions_per_week` | workout | ≥ | 3 sessions/week |
| `total_volume_weekly` | strength | ≥ | 10 000 kg·reps |
| `weight_target` | health_metric | ≤ | 70 kg |
| `sleep_avg_hours` | health_metric | ≥ | 7 hours |

---

## Manual entry

Log workouts and health readings directly from the UI, or via the API:

- `POST /workouts` — log a workout (optionally with strength sets)
- `POST /metrics` — log a health metric reading

See the interactive API docs at http://localhost:8010/docs.

---

## Environment variables

Copy `.env.example` to `.env` and fill in what you need. All optional features default to disabled.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Set automatically by Docker Compose |
| `WEBHOOK_SECRET` | no | Validates Apple Health webhook calls |
| `ENABLE_HEVY` | no | `true` to enable Hevy sync |
| `HEVY_API_KEY` | if Hevy enabled | Hevy Pro API key |
| `ENABLE_STRAVA` | no | `true` to enable Strava OAuth |
| `STRAVA_CLIENT_ID` | if Strava enabled | From strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | if Strava enabled | From strava.com/settings/api |
| `STRAVA_REDIRECT_URI` | if Strava enabled | Must match your Strava app settings |
| `FRONTEND_URL` | if Strava enabled | Used for post-OAuth redirect |
| `ENABLE_COACHING` | no | `true` to enable AI coaching |
| `ANTHROPIC_API_KEY` | if coaching enabled | Anthropic API key |
| `CLAUDE_MODEL` | if coaching enabled | Model name — see docs.anthropic.com |
