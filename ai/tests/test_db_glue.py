"""Tests for the DB orchestration layer using a fake connection.

No real database: a FakeConn records every statement and serves canned rows
keyed on the query text, so these tests verify row mapping, dry-run
no-write guarantees, and write ordering (children deleted before parents).
"""

from datetime import datetime, timezone

from betterroads_ai import classify, rebuild

T1 = datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)


class FakeCursor:
    def __init__(self, conn):
        self._conn = conn
        self._rows = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self._conn.executed.append((sql, params))
        self._rows = self._conn.rows_for(sql)

    def executemany(self, sql, rows):
        self._conn.executed.append((sql, list(rows)))
        self._rows = []

    def fetchall(self):
        return list(self._rows)

    def __iter__(self):
        return iter(list(self._rows))

    @property
    def rowcount(self):
        return len(self._rows)


class FakeTransaction:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeConn:
    """Serves canned result sets keyed on a distinctive substring of the SQL."""

    def __init__(self, results=None):
        self.results = results or {}
        self.executed = []
        self.commits = 0

    def rows_for(self, sql):
        for needle, rows in self.results.items():
            if needle in sql:
                return rows
        return []

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def transaction(self):
        return FakeTransaction()

    # helpers ---------------------------------------------------------------

    def statements(self, needle):
        return [(sql, p) for sql, p in self.executed if needle in sql]


# ─── classify ────────────────────────────────────────────────────────────────

#: (id, segment_key, type, severity, lat, lon, device_id) — a tight
#: three-device, low-variance cluster: a clear speed breaker.
BREAKER_ROWS = [
    ("e1", "19.055:72.840", "BUMP", 0.50, 19.0555, 72.8405, 1),
    ("e2", "19.055:72.840", "BUMP", 0.52, 19.05552, 72.8405, 2),
    ("e3", "19.055:72.840", "POTHOLE", 0.48, 19.05554, 72.8405, 3),
]


def test_run_classify_dry_run_writes_nothing():
    conn = FakeConn({"FROM road_events e": BREAKER_ROWS})
    plan = classify.run_classify(conn, dry_run=True)
    assert sorted(plan.event_ids_to_reclassify) == ["e1", "e2", "e3"]
    assert conn.statements("UPDATE road_events") == []
    assert conn.commits == 0


def test_run_classify_applies_update_with_planned_ids():
    conn = FakeConn({"FROM road_events e": BREAKER_ROWS})
    classify.run_classify(conn, dry_run=False)
    updates = conn.statements("UPDATE road_events")
    assert len(updates) == 1
    (sql, params) = updates[0]
    assert "SET type = 'SPEED_BREAKER'" in sql
    assert "type IN ('BUMP', 'POTHOLE')" in sql  # belt-and-braces guard
    assert sorted(params[0]) == ["e1", "e2", "e3"]
    assert conn.commits == 1


def test_run_classify_no_candidates_no_update():
    conn = FakeConn({"FROM road_events e": []})
    plan = classify.run_classify(conn, dry_run=False)
    assert plan.event_ids_to_reclassify == []
    assert conn.statements("UPDATE road_events") == []


# ─── rebuild ─────────────────────────────────────────────────────────────────

PAYLOAD = {
    "segments": [
        {
            "startLat": 19.0550, "startLon": 72.8400,
            "endLat": 19.0552, "endLon": 72.8402,
            "rqiScore": 80.0,
        }
    ]
}

REBUILD_RESULTS = {
    "JOIN journey_raw": [("j1", T1, PAYLOAD)],
    "GROUP BY journey_id": [("j1", "19.055:72.840", 2, 3)],
    "FROM road_segments": [("19.055:72.840", 74.0, 5, 9)],
}


def test_run_rebuild_dry_run_reads_but_never_writes(capsys):
    conn = FakeConn(REBUILD_RESULTS)
    result = rebuild.run_rebuild(conn, dry_run=True)
    assert result.segments["19.055:72.840"].current_rqi == 80.0
    assert result.segments["19.055:72.840"].damage_event_count == 2
    assert result.segments["19.055:72.840"].total_event_count == 3
    assert conn.statements("DELETE") == []
    assert conn.statements("INSERT") == []
    out = capsys.readouterr().out
    assert "dry run" in out
    assert "1 changed" in out  # diff against the canned current row


def test_run_rebuild_replaces_tables_children_first():
    conn = FakeConn(REBUILD_RESULTS)
    rebuild.run_rebuild(conn, dry_run=False)
    order = [sql for sql, _ in conn.executed if "DELETE" in sql or "INSERT" in sql]
    assert order[0].strip() == "DELETE FROM segment_snapshots"
    assert order[1].strip() == "DELETE FROM road_segments"
    assert any("INSERT INTO road_segments" in sql for sql in order[2:])
    assert any("INSERT INTO segment_snapshots" in sql for sql in order[2:])

    seg_inserts = conn.statements("INSERT INTO road_segments")
    assert len(seg_inserts) == 1
    rows = seg_inserts[0][1]
    assert len(rows) == 1
    # (key, clat, clon, geometry, rqi, samples, event_count, first, last)
    row = rows[0]
    assert row[0] == "19.055:72.840"
    assert row[4] == 80.0
    assert row[5] == 1
    assert row[6] == 2  # damage count stored, not total

    snap_inserts = conn.statements("INSERT INTO segment_snapshots")
    assert len(snap_inserts) == 1
    (snap_row,) = snap_inserts[0][1]
    assert snap_row[0] == "19.055:72.840"
    assert snap_row[2] == 80.0
    assert snap_row[4] == 2
