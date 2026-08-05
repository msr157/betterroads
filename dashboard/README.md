# BetterRoads Admin Dashboard

Internal admin console for BetterRoads: live counts, a 14-day journey
sparkline, and paginated tables for journeys, devices, and waitlist signups.
Standalone npm + Vite + React 19 + Tailwind 4 app (dark UI); talks to the
backend's bearer-token-protected `/api/admin` routes.

## Run locally

1. **Backend** — in `backend/`, set `ADMIN_TOKEN` in `.env` (e.g.
   `openssl rand -hex 32`; the admin API returns 503 while it is unset), then:

   ```sh
   cd backend && npm run dev   # listens on http://localhost:3000
   ```

2. **Dashboard** — point it at the local API and start Vite:

   ```sh
   cd dashboard
   npm install
   VITE_API_URL=http://localhost:3000 npm run dev   # http://localhost:5173
   ```

   (Or put `VITE_API_URL=http://localhost:3000` in `dashboard/.env.local`.)
   `http://localhost:5173` is already in the backend's default CORS allowlist.

3. Open the app and paste the `ADMIN_TOKEN` value into the login gate. The
   token is validated against `GET /api/admin/overview` and kept in
   `localStorage` until you disconnect.

## Build

```sh
npm run build     # tsc -b && vite build → dist/
npm run preview   # serve the production build locally
```

## Deployment

Deployed as its own Dokploy application: **build path `dashboard/`, Dockerfile
`dashboard/Dockerfile`** (2-stage npm build → nginx:alpine serving `dist/` on
port 80, `/health` endpoint for the Swarm healthcheck). `VITE_API_URL` is a
**build-time** arg: leave it empty when the dashboard's hostname routes `/api`
to the backend via Traefik, or set it (e.g. `https://api.betterroads.org`) as a
Docker build arg in Dokploy — remember the target origin must also be in the
backend's `CORS_ORIGINS`, and the backend service needs `ADMIN_TOKEN` set.

**Deploy checklist** (conventions from `docs/DEPLOYMENT_KB.md`): create the
Dokploy app on a dedicated hostname (e.g. `admin.betterroads.org`) with
`https: false` and `certificateType: none` — Cloudflare terminates TLS — and
the domain port matching the Dockerfile's `EXPOSE 80`; keep the Dockerfile
healthcheck on `127.0.0.1` (Alpine's `localhost` may resolve to IPv6); in
Cloudflare, add ONLY a proxied `CNAME` for the hostname pointing at the tunnel
UUID (`<tunnel-uuid>.cfargotunnel.com`, delete stray `A` records) and a tunnel
ingress rule routing it to `http://172.17.0.1:80` so it reaches Traefik across
isolated Docker networks; finally set `ADMIN_TOKEN` on the backend app and
confirm `https://<hostname>/health` returns ok before logging in.
