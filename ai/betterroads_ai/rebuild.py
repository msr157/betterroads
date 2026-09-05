"""Deterministic rebuild of road_segments and segment_snapshots.

The ingestion endpoint (backend/src/routes/traveldata.ts) aggregates inline as
journeys arrive. This module replays the retained history — ``journeys`` +
the verbatim ``journey_raw`` payloads — through the exact same math
(:func:`betterroads_ai.grid.merge_rqi`) in ``ended_at`` order, producing the
state the inline path *should* have produced.

What v1 recomputes (and what it does not) — kept simple and honest:

- RQI **re-aggregates** the app-computed per-segment ``rqiScore`` values from
  each raw payload, merged in ``ended_at`` order (ties broken by journey id
  for determinism). It does NOT re-derive RQI from raw sensor windows and it
  applies no additional event penalty — the stored per-segment scores come
  from the app, so the rebuilt ``current_rqi`` matches what the ingestion
  path computes, minus its bugs (below). Event-penalty-aware rescoring needs
  the raw-sensor pipeline and belongs to a later version (see README roadmap).
- Event counts are recounted from ``road_events`` *after* classification, so
  the ``event_count`` columns store **damage events only** (type not in
  SPEED_BREAKER / SWERVE). That is the payoff of classification: a road with
  five speed breakers is not "damaged". The total (all-type) count is still
  computed and reported in the run summary, but the schema has a single
  ``event_count`` column, so only the damage count is stored; totals remain
  derivable from ``road_events`` at query time.
- Fixes the ingestion double-count: when several ~300 m journey-segments of
  one journey land in the same cell, the inline path adds that journey's
  event tally to the cell once per journey-segment. The rebuild counts each
  journey's events once per cell.
- ``geometry`` is the first journey-segment observed in the cell in replay
  order (same rule as ingestion, now deterministic). ``first_seen_at`` /
  ``last_updated_at`` are derived from contributing journeys' ``ended_at``
  instead of wall-clock ``now()``.
- Events in cells never crossed by any journey-segment midpoint do not create
  segment rows (same as ingestion); they stay queryable via ``road_events``.
- Snapshots: one row per (cell, UTC day of ``ended_at``) holding the
  cumulative RQI/sample state after that day's last journey, and the damage
  events recorded that day — the same shape the timeline API expects.

The replay itself is pure (:func:`replay`) and unit-tested with synthetic
fixtures; only :func:`run_rebuild` touches the database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Mapping, Sequence

from .grid import cell_center, merge_rqi, segment_key_for

# Event types that do NOT count as road damage.
NON_DAMAGE_TYPES = frozenset({"SPEED_BREAKER", "SWERVE"})


# ─── Data model ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SegObs:
    """One ~300 m journey segment from a raw payload."""

    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    rqi_score: float


@dataclass(frozen=True)
class JourneyObs:
    """One journey with its raw segments, ready for replay."""

    id: str
    ended_at: datetime
    segments: tuple[SegObs, ...]


@dataclass(frozen=True)
class EventCounts:
    """Per (journey, cell) event tallies, counted from road_events."""

    damage: int  # type NOT IN ('SPEED_BREAKER', 'SWERVE')
    total: int  # all types


@dataclass
class SegmentState:
    """Rebuilt row for road_segments."""

    segment_key: str
    center_lat: float
    center_lon: float
    geometry: list[list[float]]
    current_rqi: float
    sample_count: int
    damage_event_count: int
    total_event_count: int
    first_seen_at: datetime
    last_updated_at: datetime


@dataclass
class SnapshotState:
    """Rebuilt row for segment_snapshots."""

    segment_key: str
    day: date
    rqi: float
    sample_count: int
    damage_event_count: int


@dataclass
class RebuildResult:
    segments: dict[str, SegmentState] = field(default_factory=dict)
    snapshots: dict[tuple[str, date], SnapshotState] = field(default_factory=dict)
    journeys_replayed: int = 0
    journey_segments_replayed: int = 0
    malformed_segments_skipped: int = 0


# ─── Pure replay ─────────────────────────────────────────────────────────────


def _utc_day(dt: datetime) -> date:
    """UTC calendar day, matching the ingestion's toISOString().slice(0, 10)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date()


def replay(
    journeys: Sequence[JourneyObs],
    event_counts: Mapping[tuple[str, str], EventCounts],
) -> RebuildResult:
    """Replay journeys in ended_at order and return the rebuilt state.

    ``event_counts`` maps ``(journey_id, segment_key)`` to per-journey event
    tallies for that cell (from road_events, post-classification).
    """
    result = RebuildResult()
    ordered = sorted(journeys, key=lambda j: (j.ended_at, j.id))

    for journey in ordered:
        result.journeys_replayed += 1
        day = _utc_day(journey.ended_at)
        cells_credited: set[str] = set()  # events added once per journey per cell

        for seg in journey.segments:
            mid_lat = (seg.start_lat + seg.end_lat) / 2
            mid_lon = (seg.start_lon + seg.end_lon) / 2
            key = segment_key_for(mid_lat, mid_lon)
            result.journey_segments_replayed += 1

            state = result.segments.get(key)
            if state is None:
                lat, lon = cell_center(key)
                state = SegmentState(
                    segment_key=key,
                    center_lat=lat,
                    center_lon=lon,
                    geometry=[
                        [seg.start_lat, seg.start_lon],
                        [seg.end_lat, seg.end_lon],
                    ],
                    current_rqi=merge_rqi(0.0, 0, seg.rqi_score),
                    sample_count=1,
                    damage_event_count=0,
                    total_event_count=0,
                    first_seen_at=journey.ended_at,
                    last_updated_at=journey.ended_at,
                )
                result.segments[key] = state
            else:
                state.current_rqi = merge_rqi(
                    state.current_rqi, state.sample_count, seg.rqi_score
                )
                state.sample_count += 1
                state.last_updated_at = journey.ended_at

            day_events = 0
            if key not in cells_credited:
                cells_credited.add(key)
                counts = event_counts.get((journey.id, key))
                if counts is not None:
                    state.damage_event_count += counts.damage
                    state.total_event_count += counts.total
                    day_events = counts.damage

            snap = result.snapshots.get((key, day))
            if snap is None:
                result.snapshots[(key, day)] = SnapshotState(
                    segment_key=key,
                    day=day,
                    rqi=state.current_rqi,
                    sample_count=state.sample_count,
                    damage_event_count=day_events,
                )
            else:
                snap.rqi = state.current_rqi
                snap.sample_count = state.sample_count
                snap.damage_event_count += day_events

    return result


def parse_raw_segments(payload: object) -> tuple[list[SegObs], int]:
    """Extract SegObs list from a journey_raw payload; count malformed entries."""
    skipped = 0
    out: list[SegObs] = []
    if not isinstance(payload, dict):
        return out, 1
    raw_segments = payload.get("segments")
    if not isinstance(raw_segments, list):
        return out, 1
    for raw in raw_segments:
        try:
            out.append(
                SegObs(
                    start_lat=float(raw["startLat"]),
                    start_lon=float(raw["startLon"]),
                    end_lat=float(raw["endLat"]),
                    end_lon=float(raw["endLon"]),
                    rqi_score=float(raw["rqiScore"]),
                )
            )
        except (TypeError, KeyError, ValueError):
            skipped += 1
    return out, skipped


# ─── DB layer ────────────────────────────────────────────────────────────────

JOURNEYS_SQL = """
SELECT j.id, j.ended_at, r.payload
FROM journeys j
JOIN journey_raw r ON r.journey_id = j.id
WHERE j.accepted_at IS NOT NULL
  AND j.quality_status IN ('LEGACY_APPROVED', 'APPROVED')
ORDER BY j.ended_at, j.id
"""

EVENT_COUNTS_SQL = """
SELECT journey_id,
       segment_key,
       COUNT(*) FILTER (WHERE type NOT IN ('SPEED_BREAKER', 'SWERVE')) AS damage,
       COUNT(*) AS total
FROM road_events
GROUP BY journey_id, segment_key
"""

CURRENT_SEGMENTS_SQL = """
SELECT segment_key, current_rqi, sample_count, event_count
FROM road_segments
"""

INSERT_SEGMENT_SQL = """
INSERT INTO road_segments
  (segment_key, center_lat, center_lon, geometry, current_rqi,
   sample_count, event_count, first_seen_at, last_updated_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

INSERT_SNAPSHOT_SQL = """
INSERT INTO segment_snapshots (segment_key, day, rqi, sample_count, event_count)
VALUES (%s, %s, %s, %s, %s)
"""


def fetch_replay_inputs(conn) -> tuple[list[JourneyObs], dict[tuple[str, str], EventCounts], int]:
    """Load journeys (+ raw segments) and per-(journey, cell) event counts."""
    journeys: list[JourneyObs] = []
    malformed = 0
    with conn.cursor() as cur:
        cur.execute(JOURNEYS_SQL)
        for journey_id, ended_at, payload in cur:
            segments, skipped = parse_raw_segments(payload)
            malformed += skipped
            journeys.append(
                JourneyObs(id=journey_id, ended_at=ended_at, segments=tuple(segments))
            )
        cur.execute(EVENT_COUNTS_SQL)
        counts = {
            (jid, key): EventCounts(damage=damage, total=total)
            for jid, key, damage, total in cur.fetchall()
        }
    return journeys, counts, malformed


def _print_summary(result: RebuildResult) -> None:
    total_damage = sum(s.damage_event_count for s in result.segments.values())
    total_all = sum(s.total_event_count for s in result.segments.values())
    print(
        f"[rebuild] replayed {result.journeys_replayed} journeys "
        f"({result.journey_segments_replayed} journey-segments, "
        f"{result.malformed_segments_skipped} malformed skipped) -> "
        f"{len(result.segments)} segments, {len(result.snapshots)} snapshots"
    )
    print(
        f"[rebuild] event counts: {total_damage} damage (stored), "
        f"{total_all} total incl. infrastructure/swerve (reported only)"
    )


def _print_diff(conn, result: RebuildResult, limit: int = 20) -> None:
    """Dry-run detail: compare rebuilt segments against current DB rows."""
    with conn.cursor() as cur:
        cur.execute(CURRENT_SEGMENTS_SQL)
        current = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    new_keys = sorted(set(result.segments) - set(current))
    stale_keys = sorted(set(current) - set(result.segments))
    changed: list[str] = []
    for key, seg in result.segments.items():
        cur_row = current.get(key)
        if cur_row is None:
            continue
        rqi, samples, events = cur_row
        if (
            abs(rqi - seg.current_rqi) > 1e-9
            or samples != seg.sample_count
            or events != seg.damage_event_count
        ):
            changed.append(key)
    changed.sort()

    print(
        f"[rebuild] diff vs current DB: {len(new_keys)} new, "
        f"{len(changed)} changed, {len(stale_keys)} stale (would be removed)"
    )
    for key in changed[:limit]:
        rqi, samples, events = current[key]
        seg = result.segments[key]
        print(
            f"[rebuild]   {key}: rqi {rqi:.2f} -> {seg.current_rqi:.2f}, "
            f"samples {samples} -> {seg.sample_count}, "
            f"events {events} -> {seg.damage_event_count}"
        )
    if len(changed) > limit:
        print(f"[rebuild]   ... and {len(changed) - limit} more changed segments")


def run_rebuild(conn, *, dry_run: bool = False) -> RebuildResult:
    """Fetch history, replay it, and (unless dry_run) replace the aggregates."""
    from psycopg.types.json import Jsonb  # local: keep module import-clean

    journeys, counts, malformed = fetch_replay_inputs(conn)
    result = replay(journeys, counts)
    result.malformed_segments_skipped += malformed
    _print_summary(result)

    if dry_run:
        _print_diff(conn, result)
        print("[rebuild] dry run — no rows written")
        return result

    segment_rows = [
        (
            s.segment_key, s.center_lat, s.center_lon, Jsonb(s.geometry),
            s.current_rqi, s.sample_count, s.damage_event_count,
            s.first_seen_at, s.last_updated_at,
        )
        for s in result.segments.values()
    ]
    snapshot_rows = [
        (s.segment_key, s.day, s.rqi, s.sample_count, s.damage_event_count)
        for s in result.snapshots.values()
    ]

    with conn.transaction():
        with conn.cursor() as cur:
            # snapshots reference road_segments — delete children first.
            cur.execute("DELETE FROM segment_snapshots")
            cur.execute("DELETE FROM road_segments")
            if segment_rows:
                cur.executemany(INSERT_SEGMENT_SQL, segment_rows)
            if snapshot_rows:
                cur.executemany(INSERT_SNAPSHOT_SQL, snapshot_rows)
    print(
        f"[rebuild] wrote {len(segment_rows)} road_segments and "
        f"{len(snapshot_rows)} segment_snapshots rows"
    )
    return result
