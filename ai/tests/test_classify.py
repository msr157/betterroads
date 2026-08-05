"""Unit tests for the pure speed-breaker classification logic.

All fixtures are synthetic. Coordinates are placed around a cell near
Mumbai (19.055, 72.840); 0.0001 degrees of latitude is ~11.1 m, which the
fixtures use to control pairwise distances precisely.
"""

import pytest

from betterroads_ai.classify import (
    CLUSTER_RADIUS_M,
    MIN_DISTINCT_DEVICES,
    SEVERITY_VARIANCE_MAX,
    EventObs,
    cluster_by_proximity,
    haversine_m,
    is_infrastructure_cluster,
    plan_reclassification,
    severity_variance,
)

BASE_LAT = 19.0555
BASE_LON = 72.8405
KEY = "19.055:72.840"

#: ~1 m of latitude in degrees.
M = 1.0 / 111_195.0


def ev(
    id: str,
    *,
    dlat_m: float = 0.0,
    severity: float = 0.5,
    device: int = 1,
    type: str = "BUMP",
    key: str = KEY,
) -> EventObs:
    """Synthetic event offset north of the base point by dlat_m meters."""
    return EventObs(
        id=id,
        segment_key=key,
        type=type,
        severity=severity,
        lat=BASE_LAT + dlat_m * M,
        lon=BASE_LON,
        device_id=device,
    )


# ─── haversine ───────────────────────────────────────────────────────────────


def test_haversine_zero_distance():
    assert haversine_m(19.0, 72.0, 19.0, 72.0) == 0.0


def test_haversine_one_millidegree_lat_is_about_111m():
    d = haversine_m(19.0, 72.0, 19.001, 72.0)
    assert 110.0 < d < 112.5


def test_haversine_meter_helper_calibration():
    # The fixture's M constant should place points at the requested distance.
    a, b = ev("a"), ev("b", dlat_m=25.0)
    assert haversine_m(a.lat, a.lon, b.lat, b.lon) == pytest.approx(25.0, abs=0.1)


# ─── clustering ──────────────────────────────────────────────────────────────


def test_tight_events_form_one_cluster():
    events = [ev("a"), ev("b", dlat_m=5), ev("c", dlat_m=10)]
    clusters = cluster_by_proximity(events)
    assert len(clusters) == 1
    assert len(clusters[0]) == 3


def test_far_events_split_into_clusters():
    events = [ev("a"), ev("b", dlat_m=5), ev("far", dlat_m=80)]
    clusters = cluster_by_proximity(events)
    sizes = sorted(len(c) for c in clusters)
    assert sizes == [1, 2]


def test_chain_linkage_merges_transitively():
    # a-b = 25 m, b-c = 25 m, a-c = 50 m > radius: single-linkage chains them.
    events = [ev("a"), ev("b", dlat_m=25), ev("c", dlat_m=50)]
    clusters = cluster_by_proximity(events, radius_m=CLUSTER_RADIUS_M)
    assert len(clusters) == 1


def test_radius_boundary_is_inclusive():
    events = [ev("a"), ev("b", dlat_m=29.9)]
    assert len(cluster_by_proximity(events, radius_m=30.0)) == 1
    events = [ev("a"), ev("b", dlat_m=31.0)]
    assert len(cluster_by_proximity(events, radius_m=30.0)) == 2


def test_empty_input():
    assert cluster_by_proximity([]) == []


# ─── decision ────────────────────────────────────────────────────────────────


def _tight_cluster(n_devices: int, severities=None):
    severities = severities or [0.5, 0.51, 0.49, 0.5][: max(n_devices, 3)]
    return [
        ev(f"e{i}", dlat_m=i * 2, severity=s, device=(i % n_devices) + 1)
        for i, s in enumerate(severities)
    ]


def test_severity_variance_math():
    cluster = [ev("a", severity=0.1), ev("b", severity=0.9), ev("c", severity=0.5)]
    assert severity_variance(cluster) == pytest.approx(0.10666666, abs=1e-6)
    assert severity_variance([]) == 0.0


def test_recurrent_consistent_cluster_is_infrastructure():
    cluster = [
        ev("a", severity=0.50, device=1),
        ev("b", dlat_m=3, severity=0.52, device=2),
        ev("c", dlat_m=6, severity=0.48, device=3),
        ev("d", dlat_m=2, severity=0.51, device=1, type="POTHOLE"),
    ]
    assert is_infrastructure_cluster(cluster) is True


def test_too_few_devices_is_not_infrastructure():
    # Same driver hitting the same pothole daily must not become a breaker.
    cluster = [
        ev("a", severity=0.50, device=1),
        ev("b", dlat_m=3, severity=0.51, device=1),
        ev("c", dlat_m=6, severity=0.49, device=2),
    ]
    assert is_infrastructure_cluster(cluster) is False


def test_exactly_min_devices_passes():
    cluster = [
        ev("a", severity=0.5, device=1),
        ev("b", dlat_m=2, severity=0.5, device=2),
        ev("c", dlat_m=4, severity=0.5, device=3),
    ]
    assert len({e.device_id for e in cluster}) == MIN_DISTINCT_DEVICES
    assert is_infrastructure_cluster(cluster) is True


def test_high_severity_variance_is_damage():
    cluster = [
        ev("a", severity=0.1, device=1),
        ev("b", dlat_m=3, severity=0.9, device=2),
        ev("c", dlat_m=6, severity=0.5, device=3),
    ]
    assert is_infrastructure_cluster(cluster) is False


def test_variance_threshold_is_inclusive():
    # Craft severities with population variance exactly at the threshold.
    import math

    spread = math.sqrt(SEVERITY_VARIANCE_MAX)
    cluster = [
        ev("a", severity=0.5 - spread, device=1),
        ev("b", dlat_m=2, severity=0.5 + spread, device=2),
    ]
    assert severity_variance(cluster) == pytest.approx(SEVERITY_VARIANCE_MAX)
    assert is_infrastructure_cluster(cluster, min_devices=2) is True


def test_protected_type_in_cluster_raises():
    cluster = [ev("a", device=1), ev("b", device=2), ev("m", device=3, type="MANUAL_REPORT")]
    with pytest.raises(ValueError):
        is_infrastructure_cluster(cluster)
    cluster = [ev("a", device=1), ev("s", device=2, type="SWERVE"), ev("c", device=3)]
    with pytest.raises(ValueError):
        is_infrastructure_cluster(cluster)


# ─── planning ────────────────────────────────────────────────────────────────


def test_plan_reclassifies_breaker_and_spares_damage():
    breaker = [
        ev("b1", severity=0.60, device=1),
        ev("b2", dlat_m=4, severity=0.62, device=2),
        ev("b3", dlat_m=8, severity=0.58, device=3),
    ]
    # Damage 80 m away in the same cell: same 3 devices but wild severities.
    damage = [
        ev("d1", dlat_m=80, severity=0.15, device=1),
        ev("d2", dlat_m=84, severity=0.95, device=2),
        ev("d3", dlat_m=88, severity=0.55, device=3),
    ]
    plan = plan_reclassification(breaker + damage)
    assert sorted(plan.event_ids_to_reclassify) == ["b1", "b2", "b3"]
    assert len(plan.decisions) == 2
    infra = plan.infrastructure_clusters
    assert len(infra) == 1
    assert infra[0].device_count == 3


def test_plan_never_touches_protected_or_foreign_types():
    events = [
        ev("b1", severity=0.5, device=1),
        ev("b2", dlat_m=3, severity=0.5, device=2),
        ev("b3", dlat_m=6, severity=0.5, device=3),
        ev("m1", dlat_m=1, severity=0.5, device=4, type="MANUAL_REPORT"),
        ev("s1", dlat_m=2, severity=0.5, device=5, type="SWERVE"),
        ev("k1", dlat_m=2, severity=0.5, device=6, type="SPEED_BREAKER"),
    ]
    plan = plan_reclassification(events)
    planned = set(plan.event_ids_to_reclassify)
    assert planned == {"b1", "b2", "b3"}
    all_considered = {eid for d in plan.decisions for eid in d.event_ids}
    assert not all_considered & {"m1", "s1", "k1"}


def test_plan_partitions_by_cell_before_clustering():
    # Two events physically ~11 m apart but recorded under different cells
    # (cell-boundary case) must not cluster together in v1.
    a = ev("a", device=1)
    b = EventObs(
        id="b", segment_key="19.056:72.840", type="BUMP", severity=0.5,
        lat=BASE_LAT + 10 * M, lon=BASE_LON, device_id=2,
    )
    c = ev("c", dlat_m=5, device=3)
    plan = plan_reclassification([a, b, c])
    keys = {d.segment_key for d in plan.decisions}
    assert keys == {KEY, "19.056:72.840"}
    assert plan.event_ids_to_reclassify == []  # 2 + 1 devices: neither qualifies


def test_plan_is_deterministic():
    events = [
        ev("b1", severity=0.5, device=1),
        ev("b2", dlat_m=3, severity=0.5, device=2),
        ev("b3", dlat_m=6, severity=0.5, device=3),
    ]
    p1 = plan_reclassification(list(events))
    p2 = plan_reclassification(list(reversed(events)))
    assert p1.event_ids_to_reclassify == p2.event_ids_to_reclassify
    assert [d.segment_key for d in p1.decisions] == [d.segment_key for d in p2.decisions]


def test_plan_empty_input():
    plan = plan_reclassification([])
    assert plan.decisions == []
    assert plan.event_ids_to_reclassify == []
