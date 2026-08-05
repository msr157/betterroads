"""CLI entry point: ``python -m betterroads_ai <command> [--dry-run]``.

Commands:
    classify   Reclassify recurrent consistent BUMP/POTHOLE clusters to
               SPEED_BREAKER in road_events.
    rebuild    Deterministically rebuild road_segments + segment_snapshots
               from journeys + journey_raw.
    run-all    classify, then rebuild (so the rebuild sees the fresh
               classifications).

``--dry-run`` computes and prints every planned change without writing.
Requires DATABASE_URL in the environment.
"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="betterroads_ai",
        description="BetterRoads AI Core Engine v1 - batch classification and rebuild.",
    )
    parser.add_argument(
        "command",
        choices=["classify", "rebuild", "run-all"],
        help="which stage to run (run-all = classify then rebuild)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print planned changes without writing to the database",
    )
    args = parser.parse_args(argv)

    from . import classify, db, rebuild

    try:
        conn = db.connect()
    except RuntimeError as exc:  # e.g. DATABASE_URL missing
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        if args.command in ("classify", "run-all"):
            classify.run_classify(conn, dry_run=args.dry_run)
        if args.command in ("rebuild", "run-all"):
            rebuild.run_rebuild(conn, dry_run=args.dry_run)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
