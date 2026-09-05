"""Legacy heuristic speed-breaker reclassification.

This is not an ML model and is not permitted to classify collection-v3
windows. It remains only for accepted legacy v1/v2 road events.

The on-device detector cannot tell a speed breaker from a pothole: both are a
vertical jolt. But across journeys they behave differently:

- A speed breaker is *infrastructure*: it sits at a fixed spot, every vehicle
  hits it, and it hits every vehicle about the same (severity is consistent).
- Damage is *avoidable*: drivers swerve around it, hit it at different speeds
  and lines, so severity across journeys varies widely and fewer distinct
  devices report it at the exact same spot.

Algorithm (per ``segment_key`` cell):

1. Cluster BUMP/POTHOLE events by proximity — single-linkage with a
   ~30 m haversine threshold (a cell is only ~100 m, so clusters are small).
2. A cluster is INFRASTRUCTURE when all three hold:
   - events come from >= :data:`MIN_DISTINCT_DEVICES` distinct devices
     (``road_events -> journeys -> devices``),
   - population variance of severity <= :data:`SEVERITY_VARIANCE_MAX`
     (breakers hit consistently; damage severity varies with line/speed),
   - every event is BUMP or POTHOLE (enforced by the candidate filter).
3. Those events are reclassified: ``UPDATE road_events SET type =
   'SPEED_BREAKER'``. MANUAL_REPORT and SWERVE events are never touched —
   they are excluded at the SQL level *and* re-checked in the pure logic.

The clustering / decision functions are pure and unit-tested with synthetic
fixtures (tests/test_classify.py); only :func:`run_classify` touches the DB.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Sequence

# ─── Tunables ────────────────────────────────────────────────────────────────

#: Two events within this haversine distance are considered the same spot.
CLUSTER_RADIUS_M = 30.0

#: Minimum distinct devices that must have reported a cluster before we call
#: it infrastructure. One driver hitting the same pothole on their commute
#: every day must not turn it into a "speed breaker".
MIN_DISTINCT_DEVICES = 3

#: Maximum population variance of severity for an infrastructure cluster
#: (stddev ~0.14 on the 0–1 scale). Breakers are hit consistently; damage
#: severity spreads with speed and line choice.
SEVERITY_VARIANCE_MAX = 0.02

#: Only these detector outputs may be reclassified.
RECLASSIFIABLE_TYPES = frozenset({"BUMP", "POTHOLE"})

#: Never touched, under any circumstances.
PROTECTED_TYPES = frozenset({"MANUAL_REPORT", "SWERVE"})

_EARTH_RADIUS_M = 6_371_000.0


# ─── Data model ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class EventObs:
    """One candidate road event as read from road_events (+ device join)."""

    id: str
    segment_key: str
    type: str
    severity: float
    lat: float
    lon: float
    device_id: int


@dataclass(frozen=True)
class ClusterDecision:
    """Diagnostics for one proximity cluster inside a cell."""

    segment_key: str
    event_ids: tuple[str, ...]
    device_count: int
    severity_variance: float
    is_infrastructure: bool


@dataclass
class ClassificationPlan:
    """Everything ``classify`` intends to do, computed before any write."""

    decisions: list[ClusterDecision] = field(default_factory=list)

    @property
    def event_ids_to_reclassify(self) -> list[str]:
        out: list[str] = []
        for d in self.decisions:
            if d.is_infrastructure:
                out.extend(d.event_ids)
        return out

    @property
    def infrastructure_clusters(self) -> list[ClusterDecision]:
        return [d for d in self.decisions if d.is_infrastructure]


# ─── Pure logic ──────────────────────────────────────────────────────────────


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def cluster_by_proximity(
    events: Sequence[EventObs], radius_m: float = CLUSTER_RADIUS_M
) -> list[list[EventObs]]:
    """Single-linkage proximity clustering via union-find.

    Any two events within ``radius_m`` belong to the same cluster (chains
    merge). O(n²) pairwise distances — fine, because callers pass one ~100 m
    cell at a time, which holds at most a handful of events.
    """
    n = len(events)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(n):
        for j in range(i + 1, n):
            a, b = events[i], events[j]
            if haversine_m(a.lat, a.lon, b.lat, b.lon) <= radius_m:
                union(i, j)

    groups: dict[int, list[EventObs]] = {}
    for i, ev in enumerate(events):
        groups.setdefault(find(i), []).append(ev)
    return list(groups.values())


def severity_variance(events: Sequence[EventObs]) -> float:
    """Population variance of event severities."""
    n = len(events)
    if n == 0:
        return 0.0
    mean = sum(e.severity for e in events) / n
    return sum((e.severity - mean) ** 2 for e in events) / n


def is_infrastructure_cluster(
    events: Sequence[EventObs],
    *,
    min_devices: int = MIN_DISTINCT_DEVICES,
    max_variance: float = SEVERITY_VARIANCE_MAX,
) -> bool:
    """Decide whether one proximity cluster is a speed breaker.

    Raises ``ValueError`` if a protected/non-reclassifiable event type sneaks
    in — the candidate query must have filtered those, and this guard makes
    the invariant unconditional rather than convention.
    """
    for e in events:
        if e.type not in RECLASSIFIABLE_TYPES:
            raise ValueError(
                f"non-reclassifiable event type {e.type!r} (id={e.id}) in cluster"
            )
    devices = {e.device_id for e in events}
    if len(devices) < min_devices:
        return False
    return severity_variance(events) <= max_variance


def plan_reclassification(
    events: Iterable[EventObs],
    *,
    radius_m: float = CLUSTER_RADIUS_M,
    min_devices: int = MIN_DISTINCT_DEVICES,
    max_variance: float = SEVERITY_VARIANCE_MAX,
) -> ClassificationPlan:
    """Pure planning step: group by cell, cluster, decide. No I/O.

    Protected types (MANUAL_REPORT, SWERVE) and already-classified
    SPEED_BREAKER events are silently ignored if present in the input, so the
    plan can never propose touching them.
    """
    by_cell: dict[str, list[EventObs]] = {}
    for e in events:
        if e.type not in RECLASSIFIABLE_TYPES:
            continue  # never plan changes for protected / other types
        by_cell.setdefault(e.segment_key, []).append(e)

    plan = ClassificationPlan()
    for segment_key in sorted(by_cell):  # deterministic output order
        for cluster in cluster_by_proximity(by_cell[segment_key], radius_m):
            cluster_sorted = sorted(cluster, key=lambda e: e.id)
            plan.decisions.append(
                ClusterDecision(
                    segment_key=segment_key,
                    event_ids=tuple(e.id for e in cluster_sorted),
                    device_count=len({e.device_id for e in cluster}),
                    severity_variance=severity_variance(cluster),
                    is_infrastructure=is_infrastructure_cluster(
                        cluster, min_devices=min_devices, max_variance=max_variance
                    ),
                )
            )
    return plan


# ─── DB layer ────────────────────────────────────────────────────────────────

#: Candidate events: only reclassifiable types, joined through journeys to
#: devices so recurrence can be measured per *installation*, not per journey.
CANDIDATE_SQL = """
SELECT e.id, e.segment_key, e.type, e.severity, e.lat, e.lon, d.id AS device_id
FROM road_events e
JOIN journeys j ON j.id = e.journey_id
  AND j.accepted_at IS NOT NULL
  AND j.quality_status IN ('LEGACY_APPROVED', 'APPROVED')
JOIN devices  d ON d.id = j.device_id
WHERE e.type IN ('BUMP', 'POTHOLE')
"""

#: The type guard in the WHERE clause is belt-and-braces: even if a plan were
#: somehow corrupted, protected rows cannot be rewritten.
RECLASSIFY_SQL = """
UPDATE road_events
SET type = 'SPEED_BREAKER'
WHERE id = ANY(%s)
  AND type IN ('BUMP', 'POTHOLE')
"""


def fetch_candidate_events(conn) -> list[EventObs]:
    with conn.cursor() as cur:
        cur.execute(CANDIDATE_SQL)
        rows = cur.fetchall()
    return [
        EventObs(
            id=r[0], segment_key=r[1], type=r[2], severity=r[3],
            lat=r[4], lon=r[5], device_id=r[6],
        )
        for r in rows
    ]


def run_classify(conn, *, dry_run: bool = False) -> ClassificationPlan:
    """Fetch candidates, plan, and (unless dry_run) apply the reclassification."""
    events = fetch_candidate_events(conn)
    plan = plan_reclassification(events)

    infra = plan.infrastructure_clusters
    ids = plan.event_ids_to_reclassify
    print(
        f"[classify] {len(events)} candidate events, "
        f"{len(plan.decisions)} clusters, "
        f"{len(infra)} infrastructure clusters, "
        f"{len(ids)} events to reclassify -> SPEED_BREAKER"
    )
    for d in infra:
        print(
            f"[classify]   cell {d.segment_key}: {len(d.event_ids)} events, "
            f"{d.device_count} devices, severity_var={d.severity_variance:.4f}"
        )

    if dry_run:
        print("[classify] dry run — no rows updated")
        return plan

    if ids:
        with conn.cursor() as cur:
            cur.execute(RECLASSIFY_SQL, (ids,))
            print(f"[classify] updated {cur.rowcount} road_events rows")
        conn.commit()
    else:
        print("[classify] nothing to update")
    return plan
