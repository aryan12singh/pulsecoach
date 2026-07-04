# Deploying PulseCoach

PulseCoach is a single-user app. By default there is **no login** — anyone who
can reach the ports can read your data and your stored API keys. The moment you
expose it beyond your machine, set `APP_PASSWORD` in `.env`: every page and API
call then requires signing in (webhook endpoints keep working via
`WEBHOOK_SECRET`). Pick the scenario that matches how far you want to expose it.

## 1. Laptop only (default)

```bash
cp .env.example .env
docker compose up -d
# open http://localhost:3010
```

Nothing is reachable from outside your machine unless your firewall says so.

## 2. Phone on the same Wi-Fi (LAN)

The frontend proxies all API calls through its own origin (`/api`), so your
phone only needs to reach port 3010:

1. Find your computer's LAN IP: `ipconfig getifaddr en0` (macOS).
2. Start the stack: `docker compose up -d`.
3. On your phone, open `http://<that-ip>:3010`.
4. iOS Safari: Share → **Add to Home Screen** to install it as an app.

You can upload your Apple Health `export.zip` straight from the Files app on
the phone — Settings → Import data.

Notes:
- Your computer must be awake and on the same network.
- Live Apple Health webhooks (Health Auto Export) can also target
  `http://<that-ip>:3010/api/ingest/apple-health` while on Wi-Fi.
- Sharing the network with people you don't fully trust? Set `APP_PASSWORD`
  in `.env` and restart — the app then requires a login. Also remove the
  backend's `8010:8000` port mapping in `docker-compose.yml` so the
  authenticated proxy is the only way in.

## 3. Small VPS with HTTPS (share with yourself anywhere)

**Set `APP_PASSWORD` before doing this** — it gates every page and API call
behind the built-in login. Remove the backend's `8010:8000` port mapping so
only the authenticated frontend is reachable. Caddy then just provides HTTPS
(you can add `basic_auth` on top for a second layer if you like):

```bash
# on the server
git clone https://github.com/aryan12singh/pulsecoach && cd pulsecoach
cp .env.example .env   # set FRONTEND_URL=https://pulse.example.com
docker compose up -d
```

`Caddyfile` (Caddy handles HTTPS certificates automatically):

```
pulse.example.com {
    reverse_proxy localhost:3010
}
```

Only expose port 443 (Caddy). Ports 3010/8010 should stay firewalled
(`ufw allow 443; ufw deny 3010; ufw deny 8010`). The frontend's `/api` proxy
reaches the backend over the internal Docker network, so the backend never
needs to be public.

With a public URL you also unlock:
- **Strava OAuth from anywhere**: set the redirect URI (Settings → Strava) to
  `https://pulse.example.com/api/ingest/strava/callback` and register the same
  URL in your Strava app settings.
- **Apple Health live webhook from cellular**: point Health Auto Export at
  `https://pulse.example.com/api/ingest/apple-health?secret=<your-webhook-secret>`.
  The webhook path bypasses the login (it can't hold a session cookie), so set
  `WEBHOOK_SECRET` — that's what authenticates automated pushes.

## 4. Managed platforms (Fly.io / Railway / Render)

The pieces map cleanly:
- **Postgres**: the platform's managed Postgres → set `DATABASE_URL`.
- **Backend**: deploy `backend/` (Dockerfile included), internal port 8000.
- **Frontend**: deploy `frontend/` with env `BACKEND_URL=<internal backend URL>`.
  Leave `NEXT_PUBLIC_API_URL` unset so the browser uses the `/api` proxy.
- Give only the frontend a public hostname; keep backend internal.

## Backups

Your data is one Postgres volume:

```bash
# dump
docker compose exec db pg_dump -U pulsecoach pulsecoach > pulsecoach-backup.sql
# restore into a fresh stack
cat pulsecoach-backup.sql | docker compose exec -T db psql -U pulsecoach pulsecoach
```

There's also a one-click JSON export of workouts/metrics/goals in
Settings → Your data.

## Environment reference

| Variable | Where | Meaning |
|---|---|---|
| `BACKEND_URL` | frontend (runtime) | Where the `/api` proxy forwards to. Compose default: `http://backend:8000`. |
| `NEXT_PUBLIC_API_URL` | frontend (build arg) | Optional. Set to make the browser call the backend directly instead of the proxy. |
| `FRONTEND_URL` | backend | Used for Strava OAuth return redirects and CORS. |
| `APP_PASSWORD` | frontend (runtime) | Optional login password. Empty = no login. Set it whenever the app is reachable by anyone but you. |
| `SEED_DEMO` | backend | `true` loads demo data into an empty database. Default `false`. |
| `LOG_LEVEL` | backend | `DEBUG` / `INFO` / `WARNING`. Default `INFO`. |
