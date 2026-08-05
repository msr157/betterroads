"""Unit tests for the pure rebuild replay logic (synthetic fixtures, no DB)."""

from datetime import date, datetime, timezone

from betterroads_ai.grid import merge_rqi, segment_key_for
from betterroads_ai.rebuild import (
    EventCounts,
    JourneyObs,
    SegObs,
    parse_raw_segments,
    replay,
)

# Two adjacent cells around (19.055, 72.840). Segment midpoints land squarely
# inside a cell so the expected keys are unambiguous.
SEG_A = SegObs(19.0550, 72.8400, 19.0552, 72.8402, 80.0)  # mid (19.0551, 72.8401)
SEG_A2 = SegObs(19.0553, 72.8403, 19.0557, 72.8407, 60.0)  # mid (19.0555, 72.8405)
SEG_B = SegObs(19.0560, 72.8410, 19.0564, 72.8414, 40.0)  # mid (19.0562, 72.8412)

KEY_A = segment_key_for(19.0551, 72.8401)
KEY_B = segment_key_for(19.0562, 72.8412)

T1 = datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 8, 1, 18, 30, tzinfo=timezone.utc)
T3 = datetime(2026, 8, 2, 9, 15, tzinfo=timezone.utc)


def J(jid: str, ended: datetime, *segs: SegObs) -> JourneyObs:
    return JourneyObs(id=jid, ended_at=ended, segments=tuple(segs))


def test_keys_are_distinct_fixture_sanity():
    assert KEY_A != KEY_B
    assert KEY_A == segment_key_for(
        (SEG_A.start_lat + SEG_A.end_lat) / 2, (SEG_A.start_lon + SEG_A.end_lon) / 2
    )
    # SEG_A2's midpoint shares SEG_A's cell.
    assert KEY_A == segment_key_for(
        (SEG_A2.start_lat + SEG_A2.end_lat) / 2, (SEG_A2.start_lon + SEG_A2.end_lon) / 2
    )


# ─── basic aggregation ───────────────────────────────────────────────────────


def test_single_journey_two_cells():
    result = replay([J("j1", T1, SEG_A, SEG_B)], {})
    assert set(result.segments) == {KEY_A, KEY_B}

    seg_a = result.segments[KEY_A]
    assert seg_a.current_rqi == 80.0
    assert seg_a.sample_count == 1
    assert seg_a.geometry == [[19.0550, 72.8400], [19.0552, 72.8402]]
    assert seg_a.first_seen_at == seg_a.last_updated_at == T1
    assert result.segments[KEY_B].current_rqi == 40.0

    day = date(2026, 8, 1)
    assert set(result.snapshots) == {(KEY_A, day), (KEY_B, day)}
    snap = result.snapshots[(KEY_A, day)]
    assert (snap.rqi, snap.sample_count, snap.damage_event_count) == (80.0, 1, 0)


def test_two_journeys_same_cell_merge_in_ended_at_order():
    j_early = J("j1", T1, SEG_A)  # rqi 80
    j_late = J("j2", T3, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 50.0))
    # Pass reversed: replay must sort by ended_at.
    result = replay([j_late, j_early], {})
    seg = result.segments[KEY_A]
    assert seg.current_rqi == merge_rqi(80.0, 1, 50.0) == 65.0
    assert seg.sample_count == 2
    assert seg.first_seen_at == T1
    assert seg.last_updated_at == T3
    # Geometry stays from the first-observed journey-segment.
    assert seg.geometry == [[19.0550, 72.8400], [19.0552, 72.8402]]


def test_equal_ended_at_ties_broken_by_journey_id():
    ja = J("a", T1, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 90.0))
    jb = J("b", T1, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 30.0))
    r1 = replay([jb, ja], {})
    r2 = replay([ja, jb], {})
    expected = merge_rqi(90.0, 1, 30.0)  # 'a' replays first
    assert r1.segments[KEY_A].current_rqi == expected
    assert r2.segments[KEY_A].current_rqi == expected


def test_replay_is_deterministic():
    journeys = [J("j1", T1, SEG_A, SEG_B), J("j2", T2, SEG_A2)]
    counts = {("j1", KEY_A): EventCounts(damage=1, total=2)}
    r1 = replay(journeys, counts)
    r2 = replay(list(reversed(journeys)), dict(counts))
    assert r1.segments == r2.segments
    assert r1.snapshots == r2.snapshots


def test_first_sample_is_clamped():
    result = replay([J("j1", T1, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 100.0))], {})
    assert result.segments[KEY_A].current_rqi == 100.0


# ─── event counting ──────────────────────────────────────────────────────────


def test_events_counted_once_per_journey_per_cell():
    # Two journey-segments of the SAME journey land in KEY_A. The naive
    # ingestion path would add the journey's 3 events twice; the rebuild
    # credits them once — while still counting both RQI samples.
    counts = {("j1", KEY_A): EventCounts(damage=3, total=4)}
    result = replay([J("j1", T1, SEG_A, SEG_A2)], counts)
    seg = result.segments[KEY_A]
    assert seg.sample_count == 2
    assert seg.current_rqi == merge_rqi(80.0, 1, 60.0)
    assert seg.damage_event_count == 3  # not 6
    assert seg.total_event_count == 4  # not 8
    snap = result.snapshots[(KEY_A, date(2026, 8, 1))]
    assert snap.damage_event_count == 3


def test_damage_and_total_tracked_separately():
    # 1 pothole + 4 speed-breaker hits: only damage lands in the stored count.
    counts = {("j1", KEY_A): EventCounts(damage=1, total=5)}
    result = replay([J("j1", T1, SEG_A)], counts)
    seg = result.segments[KEY_A]
    assert seg.damage_event_count == 1
    assert seg.total_event_count == 5


def test_events_in_unvisited_cells_create_no_segments():
    counts = {("j1", "10.000:70.000"): EventCounts(damage=2, total=2)}
    result = replay([J("j1", T1, SEG_A)], counts)
    assert "10.000:70.000" not in result.segments


def test_event_counts_accumulate_across_journeys():
    counts = {
        ("j1", KEY_A): EventCounts(damage=2, total=3),
        ("j2", KEY_A): EventCounts(damage=1, total=1),
    }
    result = replay([J("j1", T1, SEG_A), J("j2", T3, SEG_A2)], counts)
    seg = result.segments[KEY_A]
    assert seg.damage_event_count == 3
    assert seg.total_event_count == 4


# ─── snapshots ───────────────────────────────────────────────────────────────


def test_same_day_journeys_collapse_into_one_snapshot():
    counts = {
        ("j1", KEY_A): EventCounts(damage=1, total=1),
        ("j2", KEY_A): EventCounts(damage=2, total=2),
    }
    result = replay(
        [J("j1", T1, SEG_A), J("j2", T2, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 50.0))],
        counts,
    )
    day = date(2026, 8, 1)
    assert list(result.snapshots) == [(KEY_A, day)]
    snap = result.snapshots[(KEY_A, day)]
    assert snap.rqi == merge_rqi(80.0, 1, 50.0)  # cumulative after day's last journey
    assert snap.sample_count == 2
    assert snap.damage_event_count == 3  # that day's events summed


def test_snapshots_across_days_are_cumulative_state_per_day():
    result = replay(
        [
            J("j1", T1, SEG_A),  # day 1: rqi 80, 1 sample
            J("j2", T3, SegObs(19.0550, 72.8400, 19.0552, 72.8402, 50.0)),  # day 2
        ],
        {("j2", KEY_A): EventCounts(damage=1, total=1)},
    )
    d1, d2 = date(2026, 8, 1), date(2026, 8, 2)
    assert set(result.snapshots) == {(KEY_A, d1), (KEY_A, d2)}
    s1 = result.snapshots[(KEY_A, d1)]
    assert (s1.rqi, s1.sample_count, s1.damage_event_count) == (80.0, 1, 0)
    s2 = result.snapshots[(KEY_A, d2)]
    assert s2.rqi == merge_rqi(80.0, 1, 50.0)
    assert s2.sample_count == 2
    assert s2.damage_event_count == 1


def test_day_uses_utc_calendar_date():
    # 2026-08-01 23:30 -05:00 is 2026-08-02 04:30 UTC.
    from datetime import timedelta, timezone as tz

    ended = datetime(2026, 8, 1, 23, 30, tzinfo=tz(timedelta(hours=-5)))
    result = replay([J("j1", ended, SEG_A)], {})
    assert (KEY_A, date(2026, 8, 2)) in result.snapshots


# ─── payload parsing ─────────────────────────────────────────────────────────


def test_parse_raw_segments_happy_path():
    payload = {
        "segments": [
            {
                "segmentIndex": 0,
                "startLat": 19.0550, "startLon": 72.8400,
                "endLat": 19.0552, "endLon": 72.8402,
                "lengthM": 305.0, "rqiScore": 78.0, "eventCount": 1, "avgRms": 0.82,
            }
        ]
    }
    segs, skipped = parse_raw_segments(payload)
    assert skipped == 0
    assert segs == [SegObs(19.0550, 72.8400, 19.0552, 72.8402, 78.0)]


def test_parse_raw_segments_skips_malformed_entries():
    payload = {
        "segments": [
            {"startLat": 1.0, "startLon": 2.0, "endLat": 3.0, "endLon": 4.0, "rqiScore": 50.0},
            {"startLat": 1.0},  # missing fields
            "not-a-dict",
            {"startLat": 1.0, "startLon": 2.0, "endLat": 3.0, "endLon": 4.0, "rqiScore": "x"},
        ]
    }
    segs, skipped = parse_raw_segments(payload)
    assert len(segs) == 1
    assert skipped == 3


def test_parse_raw_segments_rejects_bad_payloads():
    assert parse_raw_segments(None) == ([], 1)
    assert parse_raw_segments([1, 2]) == ([], 1)
    assert parse_raw_segments({"noSegments": True}) == ([], 1)


def test_journey_with_no_segments_is_counted_but_harmless():
    result = replay([J("j1", T1)], {})
    assert result.journeys_replayed == 1
    assert result.segments == {}
    assert result.snapshots == {}
