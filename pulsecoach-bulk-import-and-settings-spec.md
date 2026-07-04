# PulseCoach — Enhancement Spec: Bulk File Import + In-App Settings

> This is an **enhancement** to the existing repo (aryan12singh/pulsecoach), not a
> rebuild. Build on the current adapter layer, tables (`workouts`, `strength_sets`,
> `health_metrics`, `goals`), and feature-flag system.
>
> **Step 0 — inspect first.** Before writing anything, read the existing code:
> `backend/services/ingestion/*`, the SQLAlchemy models, the existing
> `/ingest/*` routes, the config/feature-flag module, the frontend nav + settings
> area, and `docker-compose.yml`. Match existing naming, the adapter interface,
> and the shared dedup/upsert helper. Reuse, don't duplicate.

This adds three things:
1. **Bulk file-import ingestion** for Apple Health, Hevy, and Strava — full historical
   backfill from each platform's "export my data" file, no API/Pro/OAuth required.
2. **An in-app Settings page** to enable/disable each integration and enter credentials,
   so users don't have to hand-edit `.env`.
3. **Single-`.env` consolidation** so there's one file to manage.

All imported data must flow through the **same normalisation → dedup → upsert path**
as the live API ingestion, so the dashboard, trends, goals, analytics, and coaching
all populate identically regardless of whether data arrived by file or by API.

---

## Part A — Bulk file importers

### Shared design

- Add new adapters under `services/ingestion/` implementing the existing
  `SourceAdapter.normalize()` contract. They parse a **file**, not a webhook/API
  payload, but produce the same normalised result objects.
- Reuse the existing shared `persist.py` dedup+upsert. Dedup on `(source, external_id)`
  using each platform's stable IDs so re-uploading the same file is idempotent.
- New endpoints accept `multipart/form-data` file uploads:
  - `POST /ingest/apple-health/import` — accepts `export.zip` or `export.xml`
  - `POST /ingest/hevy/import` — accepts the Hevy workout CSV and/or measurements CSV
  - `POST /ingest/strava/import` — accepts the Strava bulk export `.zip`
- Each returns a summary: `{ workouts_added, workouts_skipped_dupe, sets_added,
  metrics_added, errors: [...] }`. Never 500 on a malformed row — skip it, count it,
  return the summary.
- Process large uploads as a background task (FastAPI `BackgroundTasks` is enough for
  single-user) and expose `GET /ingest/jobs/{id}` for progress so the UI can show a
  spinner + result. Apple exports can be hundreds of MB.
- Store uploaded files in a temp dir and delete after processing; never commit them.

### A1 — Apple Health full export (`export.xml`)

Source button: Health app → profile picture → **Export All Health Data** → produces
`export.zip` containing `export.xml` (+ `export_cda.xml`, ignore the CDA file).

- Accept either the `.zip` (unzip in memory/temp, find `export.xml`) or a raw `.xml`.
- **Stream-parse** with `lxml.etree.iterparse` and clear elements after each — do NOT
  `read()` the whole file or `parse()` into a tree; it will OOM.
- Map elements:
  - `<Record type="HKQuantityTypeIdentifier...">` → `health_metrics`. Map at least:
    - `BodyMass` → `weight_kg`
    - `BodyMassIndex` → `bmi`
    - `RestingHeartRate` → `resting_hr`
    - `HeartRateVariabilitySDNN` → `hrv`
    - `StepCount` → `steps` (sum per day)
    - `ActiveEnergyBurned` → `active_energy` (sum per day)
    - `VO2Max` → `vo2max`
    - `BodyFatPercentage` → `body_fat_pct`
    - `<Record type="HKCategoryTypeIdentifierSleepAnalysis">` → derive `sleep_hours`
      per night (sum the asleep intervals between `startDate`/`endDate`, grouped by
      the night they belong to).
  - `<Workout>` → `workouts` (envelope only — Apple has no set/rep detail). Map
    `workoutActivityType`, `startDate`, `endDate`, `duration`, `totalEnergyBurned`,
    `totalDistance`. Normalise the activity type into your `workout_type` enum.
- Dedup: Apple records don't all carry a UUID; build a stable `external_id` from
  `type + startDate + value` (metrics) and `workoutActivityType + startDate + duration`
  (workouts). Note timestamps include a timezone offset (e.g. `+0800`) — parse it.
- Units: Apple may export lb/mi depending on the user's locale — read the `unit`
  attribute on each record and convert to your canonical units (kg, km).

### A2 — Hevy CSV export (no Pro required)

Source: Hevy app → Profile → Settings → **Export & Import Data** → exports a **workout
CSV** (set-by-set) and a separate **measurements CSV**.

- **Workout CSV** → `workouts` + `strength_sets`. Group rows into workouts by
  `(title, start_time)`; each row is one set. Expected headers (VERIFY against the
  user's actual file — Hevy tweaks these; map case-insensitively and tolerate
  missing optional columns):
  `title, start_time, end_time, description, exercise_title, superset_id,
   exercise_notes, set_index, set_type, weight_kg, reps, distance_km,
   duration_seconds, rpe`
  - One `workouts` row per `(title, start_time)`; `workout_type = strength`,
    `has_strength_detail = true`, `external_id = "hevy_csv:" + start_time + ":" + title`.
  - One `strength_sets` row per CSV row: `exercise_name=exercise_title`,
    `set_number=set_index`, `reps`, `weight=weight_kg`, `weight_unit=kg`, `rpe`,
    `duration_seconds`, `is_warmup = (set_type == "warmup")`.
  - Hevy weights are kg in the export; if a future file shows lb, honour it.
- **Measurements CSV** → `health_metrics`. Headers like `date, weight_kg, fat_percent`
  plus optional body-part columns (`neck_cm`, `chest_cm`, ...). Map `weight_kg` →
  `weight_kg`, `fat_percent` → `body_fat_pct`; ignore unmapped columns gracefully.
  Date format is `DD MMM YYYY, HH:mm`.
- Detect which CSV is which by inspecting the header row, so the single endpoint
  accepts either file (or both, if the user uploads two).
- This is the recommended strength path for users without Hevy Pro.

### A3 — Strava bulk export

Source: strava.com → Settings → **My Account → Download or Delete Your Account →
Get Started → Request your archive**. Strava emails a `.zip` containing `activities.csv`
plus per-activity files (`.gpx`/`.tcx`/`.fit`, often gzipped) under `activities/`.

- Parse `activities.csv` only for v1 of this importer (don't parse the per-activity
  GPS files). Map each row → `workouts`: `Activity Type` → `workout_type`,
  `Activity Date` → `start_at`, `Elapsed Time`/`Moving Time` → `duration_mins`,
  `Distance` → `distance_km`, `Calories` → `active_calories`, plus avg/max HR columns
  when present. `external_id = "strava_csv:" + Activity ID`.
- **Set/rep strength detail is NOT reliably in the bulk export** — Strava's strength
  set data is imported from partner apps and the archive format may not surface it.
  So Strava import backfills the cardio/workout envelope; strength detail still comes
  from Hevy. State this in the UI import help text.
- Strava CSV headers and date formats vary by account locale — map case-insensitively
  and verify against the user's file.

### Frontend for imports

- On the **Settings** page (Part B) and/or dashboard empty-state, add an **Import data**
  section with three labelled drop-zones / file pickers: "Apple Health export",
  "Hevy CSV", "Strava archive".
- Show the per-source instructions inline (where to find the export button in each app).
- On upload: show progress (poll the job endpoint), then the result summary
  ("Added 412 workouts, 3,180 sets, 1,290 metrics; skipped 14 duplicates").
- After a successful import, the dashboard/trends/goals/analytics should reflect the
  data immediately on next load (same tables, no special-casing).

---

## Part B — In-app Settings (DB-backed config, not just `.env`)

Goal: the user can enable/disable each API integration and enter credentials from a
**Settings page in the UI**, with changes taking effect **without a container restart**.
`.env` becomes the *bootstrap default*, not the only way to configure.

### Config precedence

1. On startup, seed config from env vars **only if** the DB has no value yet.
2. After that, **DB is the source of truth**. The UI writes to the DB; services read
   from the DB at request time (or via a small cached settings provider that
   invalidates on write) so toggling takes effect live.

### New table: `integration_settings` (single-row or key-value)

Store per-integration: `enabled` (bool) and the relevant credentials/fields:
- Hevy: `hevy_enabled`, `hevy_api_key`
- Strava: `strava_enabled`, `strava_client_id`, `strava_client_secret`,
  `strava_redirect_uri`, plus the existing stored OAuth tokens
- Coaching: `coaching_enabled`, `anthropic_api_key`, `claude_model`
- Apple Health webhook: `webhook_secret`

Use a key-value `settings(key, value, is_secret, updated_at)` table or a single typed
row — pick whichever matches the existing code style.

### Endpoints

- `GET /settings` — returns current config. **Mask secrets** (return
  `"sk-ant-…last4"` or a boolean `has_key`, never the raw secret).
- `PUT /settings` — update flags/credentials. Accept a new secret to overwrite;
  ignore the masked placeholder so re-saving the form doesn't wipe a key.
- `POST /settings/test/{integration}` — "Test connection" (ping Hevy `/v1/workouts?page=1`,
  validate Strava token, do a tiny Anthropic call) and return ok/fail + message.
- Existing `GET /config` (the `{coaching_enabled, hevy_enabled, ...}` the frontend
  already reads to show/hide nav) should now be **derived from the DB settings**.

### Frontend Settings page (`/settings`)

- One card per integration: a toggle + credential fields + **Test connection** button
  + status indicator (Connected / Not configured / Error).
- Strava card keeps the existing **Connect Strava** OAuth button (OAuth still needs the
  client id/secret entered first).
- The import drop-zones from Part A live here too (or on their own `/import` route).
- Nav items (Coach, Sync Hevy, Connect Strava) show/hide reactively from `GET /config`.

### Security note (important — document in README)

Storing API keys in the database is acceptable for a **single-user, self-hosted, local**
app, but call it out honestly:
- Encrypt secret columns at rest using a key from an env var (`SETTINGS_ENCRYPTION_KEY`),
  or at minimum document that the Postgres volume holds plaintext secrets and must stay
  local / not be committed or backed up to a shared location.
- Never log secrets. Always mask in API responses. Keep `.env`, the DB volume, and any
  uploaded export files in `.gitignore`.
- This is the one place to be deliberate — it's a health app holding personal data and
  third-party credentials.

---

## Part C — Single `.env` consolidation (answers "is main .env the only one?")

Today a Compose stack with a separate Next.js frontend often needs **two** env contexts:
the root `.env` that Docker Compose reads for variable substitution + the backend
container, and the frontend's build-time `NEXT_PUBLIC_*` vars (Next.js inlines those at
build, so they can't just be read at runtime from the backend's env).

Consolidate to **one root `.env`**:
- Keep a single `/.env` at repo root. Compose loads it for substitution.
- Backend container: pass vars via `env_file: .env` (or `environment:` mapping).
- Frontend container: pass the public vars (e.g. `NEXT_PUBLIC_API_URL`) as **build args**
  in `docker-compose.yml`, sourced from the same root `.env`, e.g.:
  ```yaml
  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
  ```
  and in the frontend Dockerfile: `ARG NEXT_PUBLIC_API_URL` then
  `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL` before `npm run build`.
- Remove any separate `frontend/.env*` from the committed tree (keep `.env.example`
  documenting every var). Result: the user edits exactly one file, `/.env`.
- Because most config now lives in the Settings UI/DB, `.env` shrinks to just:
  `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, and optional bootstrap defaults +
  `SETTINGS_ENCRYPTION_KEY`. Update `.env.example` and the README env table accordingly.

---

## Definition of done

- Three working file-import endpoints + UI drop-zones; each returns a summary and is
  idempotent on re-upload (dedup holds).
- Apple export parses via streaming (no OOM on a large file); sleep/weight/BMI/HR/steps
  land in `health_metrics`; workouts land in `workouts`.
- Hevy CSV import creates workouts **with** `strength_sets`, no Pro/API key needed.
- Strava archive import backfills the cardio envelope from `activities.csv`.
- Imported data shows up across dashboard, trends, goals, and analytics with no special
  casing — same tables/path as API ingestion.
- Settings page: toggle each integration, enter+test credentials, changes take effect
  without restart; secrets masked in responses and encrypted (or documented) at rest.
- `GET /config` derives from DB settings; nav reacts correctly.
- One root `.env`; `docker compose up --build` works; `.env.example` + README updated,
  including where to find each platform's export button and the security note.

## Out of scope (leave alone)
- Parsing Strava per-activity GPS/FIT files (only `activities.csv` for now).
- Multi-user/auth. Still single-user.
