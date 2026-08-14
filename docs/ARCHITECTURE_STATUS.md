# Architecture and milestone status

BetterRoads has four deployable applications: the public Vite website/map, the
Hono/PostgreSQL API, the Vite administrator dashboard, and the Expo Android
app. The Python AI pipeline runs separately on a schedule and consumes stored
road data.

## Identity and ingestion

Android signs in through Google OAuth. The API verifies the Google ID token
against configured audiences, stores immutable Google subject/email fields,
and returns a random bearer credential. Only an HMAC-SHA-256 digest is stored.
The Expo app keeps the credential and cached profile in Secure Store, allowing
journeys to be recorded offline. Upload always revalidates the session.

Authenticated ingestion is transactional. It records device/journey ownership,
raw paths, events, RQI segment aggregates, and snapshots. Only after the whole
transaction succeeds is `accepted_at` set, which makes the journey eligible for
the opted-in public leaderboard. Legacy anonymous rows remain anonymous.

## Public and administrator surfaces

The public map reads real RQI, events, contributor rankings, and explicitly
published contract records. Private profile fields never enter public queries.
The administrator dashboard uses database-backed administrators and revocable
sessions, and provides operational screens, search, derived alerts, account
security/preferences, contract CRUD/CSV import, map layers, replay, and export.

## Deployment

Dokploy builds three Dockerfiles independently and rolls services through
Docker Swarm. Traefik handles internal HTTP routing and Cloudflare Tunnel is the
only public ingress. The API exits when migrations or administrator bootstrap
fail, so an unhealthy schema cannot pass the container health check.

## Remaining external release gates

- Commit and push the coherent working tree, then allow Dokploy to deploy it.
- Create the pending `admin.betterroads.org` DNS CNAME.
- Build and install the signed Android release with Docker.
- Verify Google login, profile/account deletion, journey upload/attribution,
  leaderboard opt-in, and layouts on real Android and desktop/mobile browsers.
- Publish `BetterRoads.apk` as an asset on the latest GitHub Release.
