# BetterRoads AI Core Engine (v1)

The batch intelligence layer behind the road-sensing pipeline. The ingestion
endpoint (`backend/src/routes/traveldata.ts`) does naive inline aggregation so
uploads stay fast; this engine runs periodically over the retained history and
does the smarter work:

1. **`classify`** — tells *infrastructure* apart from *damage*. A speed
   breaker and a pothole look identical to the on-device detector (one
   vertical jolt), but across journeys they behave differently: a breaker is
   hit by everyone, at the same spot, with consistent severity; damage is hit
   by fewer devices with severity that varies with speed and line. Within each
   `segment_key` cell, BUMP/POTHOLE events are clustered by proximity
   (single-linkage haversine, ≤ 30 m). A cluster is reclassified to
   `SPEED_BREAKER` when it has **≥ 3 distinct devices**
   (`road_events → journeys → devices`) **and** low severity variance
   (population variance ≤ 0.02, stddev ≈ 0.14). `MANUAL_REPORT` and `SWERVE`
   events are never touched — excluded in SQL and re-checked in code.

2. **`rebuild`** — deterministically rebuilds `road_segments` and
   `segment_snapshots` from `journeys` + the verbatim `journey_raw` payloads,
   replaying every journey in `ended_at` order (ties broken by journey id)
   through the **exact same math** as ingestion: `segment_key_for` /
   `merge_rqi` in `betterroads_ai/grid.py` are bit-for-bit ports of
   `backend/src/lib/roadSegments.ts` (verified against Node-generated vectors
   in the tests).

Run `classify` before `rebuild` (`run-all` does this) so the rebuilt counts
reflect fresh classifications.

## What v1 recomputes — and what it doesn't

Honest scope, so nobody mistakes this for magic:

- **RQI**: re-aggregates the app-computed per-segment `rqiScore` values from
  the raw payloads via the recency-weighted running average (`merge_rqi`,
  alpha floored at 0.15). It does **not** re-derive RQI from raw sensor
  windows and applies **no extra event penalty** — the per-segment scores come
  from the app, so the rebuild reproduces the ingestion path's RQI, minus its
  bugs.
- **Event counts**: recounted from `road_events` *post-classification*. The
  `event_count` columns store **damage events only** (type not in
  `SPEED_BREAKER`/`SWERVE`) — the payoff of classification: a road with five
  speed breakers is not "damaged". The schema has a single `event_count`
  column, so the all-type total is computed and printed in the run summary but
  not stored; it stays derivable from `road_events`.
- **Double-count fix**: the inline path adds a journey's per-cell event tally
  once per journey-*segment* that lands in the cell; the rebuild credits each
  journey's events once per cell.
- **Geometry / timestamps**: `geometry` is the first journey-segment observed
  in the cell in replay order; `first_seen_at`/`last_updated_at` derive from
  contributing journeys' `ended_at` (deterministic) instead of wall-clock
  `now()`.
- **Snapshots**: one row per (cell, UTC day of `ended_at`) with the cumulative
  RQI/sample state as of that day's last journey and that day's damage-event
  count — the shape the public timeline API expects.
- Events in cells never crossed by a journey-segment midpoint don't create
  segment rows (same as ingestion); they remain queryable via `road_events`.
- Cell identity is still the quantized ~100 m grid, with its known collisions
  (two roads through one cell). Map-matching is roadmap, not v1.

The rebuild replaces both tables in a single transaction (`DELETE` +
re-insert), so readers never see a half-rebuilt state.

## Running

Python 3.11+. Only runtime dependency: `psycopg[binary]`.

```sh
cd ai
python -m venv .venv
.venv/Scripts/pip install -e .[test]        # Windows (POSIX: .venv/bin/pip)

export DATABASE_URL=postgresql://user:pass@host:5432/betterroads

python -m betterroads_ai classify --dry-run   # print planned reclassifications
python -m betterroads_ai classify             # apply them
python -m betterroads_ai rebuild --dry-run    # print rebuild + diff vs current DB
python -m betterroads_ai rebuild              # replace aggregates
python -m betterroads_ai run-all              # classify, then rebuild
```

`--dry-run` computes everything and prints planned changes (reclassification
clusters with device counts and severity variance; rebuild summary plus a diff
against the current `road_segments` rows) without writing.

### Docker

```sh
docker build -t betterroads-ai ./ai
docker run --rm -e DATABASE_URL=postgresql://... betterroads-ai run-all
docker run --rm -e DATABASE_URL=postgresql://... betterroads-ai rebuild --dry-run
```

### Scheduling

The engine is a run-to-completion batch job (process, print summary, exit) —
schedule it rather than daemonize it:

- **Dokploy**: create a scheduled job (cron-style) on the app image running
  `run-all`, e.g. nightly at `30 2 * * *`, with `DATABASE_URL` set in the job
  environment. (Remember: this stack deploys via a registry image — a green
  deploy without a pushed image runs stale code.)
- **Plain cron**:
  `30 2 * * * docker run --rm -e DATABASE_URL=... betterroads-ai run-all`

Nightly is plenty for v1: classification needs cross-journey recurrence, which
accumulates over days, and the rebuild is idempotent — running it twice
produces byte-identical rows.

## Tests

```sh
cd ai
.venv/Scripts/python -m pytest      # POSIX: .venv/bin/python -m pytest
```

Tests are pure — no database. Grid tests pin vectors generated from the actual
JS math in Node; classify/rebuild tests use synthetic fixtures.

## Roadmap

- **Map-matching to OSM ways** — replace the quantized-cell road identity with
  proper way/segment matching (fixes two-roads-one-cell collisions and
  cell-boundary splits). `journey_raw` keeps every GPS path verbatim so all
  history can be re-keyed when this lands.
- **FFT frequency analysis on raw `sensorWindows`** — classify surface texture
  (washboard, cobble, joint spacing) and separate suspension resonance from
  road input, instead of relying on the app's time-domain RMS/jolt scores.
- **Vehicle normalization learning** — learn per vehicle-type (and eventually
  per-device) response curves so a bus and a bike report comparable RQI for
  the same road, replacing the app's static `baseFloorRms` subtraction.
- **Event-penalty RQI** — once scores are re-derived server-side, fold the
  damage-event density into the segment score explicitly (excluding
  infrastructure, which classification already separates).
