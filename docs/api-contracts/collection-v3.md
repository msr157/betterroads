# Collection v3 API contract

Collection v3 is a research-data path. It is separate from legacy
`/traveldata`: completing a v3 session never creates `journeys`,
`road_events`, `road_segments`, `segment_snapshots`, leaderboard credit, or a
public-map change.

## Modes

- `STANDARD` uploads accepted GPS samples, diagnostics, neutral candidate
  feature windows, and randomly sampled normal feature windows. It must have
  zero raw objects and zero research markers.
- `CONTROLLED_RESEARCH` additionally uploads private gzip sensor objects and
  passenger/research-operator timestamp markers. The installation must be
  authorized for the exact vehicle class by an administrator.

Each session has exactly one vehicle class, subtype, mount, profile version,
feature version, and trigger version. CAR, BIKE, and AUTO_RICKSHAW datasets
are never mixed. BUS and TRUCK remain experimental collection-only classes;
OTHER is collection-ineligible.

## Protocol

All routes require the normal mobile bearer token and are available below
both `/api/user/mobile/collection` and `/user/mobile/collection`.

1. `GET /config?vehicleClass=CAR&deviceUuid=<uuid>` returns the authoritative
   immutable profile, supported modes, consent version, and limits.
2. `POST /sessions/init` reserves the client UUID and immutable identity.
   Repeating the same identity is idempotent; ownership or identity conflicts
   return `409`.
3. Controlled sessions call `POST /sessions/:id/raw-uploads` with manifests,
   then PUT gzip bytes to the returned private presigned URLs.
4. `POST /sessions/:id/complete` submits the strict v3 manifest. The server
   verifies quality and controlled-object metadata before transactionally
   storing feature windows and markers.
5. `POST /sessions/:id/cancel` marks incomplete objects for deletion.

Completion status is `received`, `quarantined`, or `duplicate`. Malformed,
unauthorized, cross-account, impossible, oversized, and identity-conflicting
requests are terminal and are not retried indefinitely. Quarantine is also
terminal but retains diagnostics; it is excluded from exports.

## Raw object format 1

Each window is deterministic gzip JSON, at most 1 MiB, containing:

- `formatVersion`, `windowId`, and a monotonic `timeBaseUs`;
- delta-microsecond accelerometer rows with full device axes plus
  gravity-aligned values and mount stability;
- delta-microsecond three-axis gyroscope rows.

Raw objects contain no user/account ID, installation UUID, route ID, session
ID, city, latitude, or longitude. Location remains in the access-controlled
session manifest. Objects are server-keyed under a vehicle/profile prefix,
private, checksummed, and governed by `COLLECTION_RAW_RETENTION_DAYS`.

## Local services

```sh
docker compose up -d collection-db collection-storage collection-storage-init
export DATABASE_URL=postgres://betterroads:betterroads-local-development-secret@127.0.0.1:55432/betterroads
cd backend
npm run db:migrate
```

Set the collection S3 variables from `backend/.env.example`, using
`http://127.0.0.1:9000` when the backend runs on the host. MinIO’s console is
at `http://127.0.0.1:9001`; the bucket is deliberately non-public.
