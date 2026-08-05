"""BetterRoads AI Core Engine v1.

The batch layer behind the naive inline aggregation done by the ingestion
endpoint (backend/src/routes/traveldata.ts). Runs periodically and:

- ``classify`` — distinguishes infrastructure (speed breakers) from damage
  (potholes/bumps) via cross-journey recurrence, reclassifying events in
  ``road_events``.
- ``rebuild`` — deterministically rebuilds ``road_segments`` and
  ``segment_snapshots`` from ``journeys`` + ``journey_raw`` history.

See ai/README.md for usage and roadmap.
"""

__version__ = "0.1.0"
