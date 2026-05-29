# PulseCoach

A self-hosted, single-user personal health dashboard. Ingests data from Apple Health (via Health Auto Export), Hevy (optional), and manual entry. Tracks goals, shows trends, and optionally offers AI coaching powered by Claude.

**Single-user by design.** Clone it, run it, own your data.

---

## Quickstart (no API keys needed)

```bash
git clone <your-repo>
cd pulsecoach
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

The app seeds itself with 30 days of realistic health data and 12 workouts so the dashboard is immediately useful.

---

## Connect Apple Health (Health Auto Export)

1. Install [Health Auto Export](https://www.healthautoexport.com/) on your iPhone.
2. In the app, create an **Automation** with destination **REST API**.
3. Set the URL to `http://<your-server-ip>:8000/ingest/apple-health`.
4. Choose your export format as **JSON** and schedule it (e.g. every hour).
5. If you set `WEBHOOK_SECRET` in your `.env`, add it as the `X-Webhook-Secret` header.

The endpoint always returns `200 OK` so the app never causes retries on partial failures.

---

## Enable Hevy (optional — requires Hevy Pro)

Hevy's API requires a **Pro subscription**. Get your API key from the Hevy app settings.

In your `.env`:

```env
ENABLE_HEVY=true
HEVY_API_KEY=your_hevy_api_key_here
```

Restart the stack. A **Sync Hevy** button appears in the nav. Click it to pull your latest workouts with full set/rep/weight detail.

---

## Enable AI Coaching (optional)

Requires an [Anthropic API key](https://console.anthropic.com/).

In your `.env`:

```env
ENABLE_COACHING=true
ANTHROPIC_API_KEY=sk-ant-...
# Check https://docs.anthropic.com/en/docs/models-overview for the current model name
CLAUDE_MODEL=<current-model-name>
```

Restart the stack. A **Coach** tab appears. On first visit it sends an automatic weekly check-in summarising your last 14 days.

---

## Add Goals

Go to **Goals** in the nav and click **+ Add Goal**.

| Goal type | Scope | Comparison | Example |
|---|---|---|---|
| `sessions_per_week` | workout | ≥ | 3 sessions/week |
| `total_volume_weekly` | strength | ≥ | 10 000 kg·reps |
| `weight_target` | health_metric | ≤ | 70 kg |
| `sleep_avg_hours` | health_metric | ≥ | 7 hours |

---

## Manual entry

- **POST /workouts** — log a workout (optionally with sets)
- **POST /metrics** — log a health metric reading

See the interactive API docs at http://localhost:8000/docs.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Set automatically by Docker Compose |
| `WEBHOOK_SECRET` | no | Validates HAE webhook calls |
| `ENABLE_HEVY` | no | `true` to enable Hevy sync |
| `HEVY_API_KEY` | if Hevy enabled | Hevy Pro API key |
| `ENABLE_COACHING` | no | `true` to enable AI coaching |
| `ANTHROPIC_API_KEY` | if coaching enabled | Anthropic API key |
| `CLAUDE_MODEL` | if coaching enabled | Model name — check docs.anthropic.com |

Copy `.env.example` to `.env` and fill in what you need.
