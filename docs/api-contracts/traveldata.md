# Travel Data Contract — schemaVersion 1 and 2

The mobile app fires **one** API call per completed journey (Point A → Point B),
sending the full collected dataset in a single batch (~10 MB typical, 15 MB hard cap).

```
POST /user/mobile/traveldata        (also served at /api/user/mobile/traveldata)
Content-Type: application/json
Authorization: Bearer <mobile-session>
```

Authentication is required. Ownership is resolved solely from the bearer
session, never client-supplied identity fields. The device retains its
install-time UUID for installation identity. Existing anonymous rows remain
unowned and are not claimed when a person later signs in. Retrying a journey ID
owned by another account returns HTTP 409.

Uploads are **idempotent on `journey.id`**: the app can retry the same payload
safely. Every successful response includes `status: "accepted" | "duplicate" |
"quarantined"`. A duplicate quarantined journey returns its stored quarantine
reasons. Ingestion is transactional,
and the server sets `accepted_at` after raw storage and road aggregation finish.
Only accepted authenticated journeys are eligible for contributor rankings.

## Payload

```jsonc
{
  "schemaVersion": 2,
  "device": {
    "uuid": "0b6f3c1e-8a2e-4b7d-9c3f-1d2e3f4a5b6c",  // install-time UUID
    "platform": "android",                            // "android" | "ios"
    "model": "Pixel 8",                               // optional
    "appVersion": "1.0.0"                             // optional
  },
  "journey": {
    "id": "7f9e...uuid",           // client-minted, idempotency key
    "startedAt": 1754000000000,    // epoch ms
    "endedAt":   1754001800000,
    "distanceM": 12400.5,
    "durationS": 1800,
    "avgSpeedKmh": 24.8,
    "vehicleType": "CAR",          // CAR | BIKE | AUTO_RICKSHAW | BUS | TRUCK | OTHER
    "phoneMountPosition": "DASH_MOUNT",  // optional
    "baseFloorRms": 0.35,          // optional; vehicle vibration floor subtracted on-device
    "rqiScore": 71.2,              // 0–100 journey-level Road Quality Index
    "startLat": 19.0596, "startLon": 72.8295,
    "endLat":   19.0330, "endLon":  72.8397,
    "movingDurationS": 1510,
    "stationaryDurationS": 290,
    "detectionAlgorithmVersion": "motion-v2.0",
    "fixQuality": {
      "reliableFixCount": 740,
      "rejectedFixCount": 8,
      "meanAccuracyM": 9.4,
      "bestAccuracyM": 3.0,
      "worstAccuracyM": 24.0
    }
  },
  "segments": [                    // ~300 m stretches scored on-device
    {
      "segmentIndex": 0,
      "startLat": 19.0596, "startLon": 72.8295,
      "endLat":   19.0570, "endLon":  72.8301,
      "lengthM": 305.0,
      "rqiScore": 78.0,            // 0–100
      "eventCount": 1,
      "avgRms": 0.82               // m/s² windowed RMS after floor subtraction
    }
  ],
  "events": [                      // individual detected jolts
    {
      "id": "e1a2...uuid",
      "type": "POTHOLE",           // POTHOLE | BUMP | SPEED_BREAKER | SWERVE | MANUAL_REPORT
      "severity": 0.8,             // 0.0–1.0
      "timestamp": 1754000634000,  // epoch ms
      "lat": 19.0581, "lon": 72.8299,
      "altitudeM": 12.0,           // optional
      "speedKmh": 31.0,            // optional
      "accelX": 0.4, "accelY": 1.1, "accelZ": 24.6,  // optional raw trigger readings
      "gyroZ": 0.1,                // optional
      "heading": 184.0             // optional
    }
  ],
  "path": [[19.0596, 72.8295, 1754000000000], ...],  // optional downsampled GPS trace
  "locationSamples": [
    { "lat": 19.0596, "lon": 72.8295, "timestamp": 1754000000000, "accuracyM": 8, "speedKmh": 21 }
  ],
  "sensorWindows": [ { /* opaque raw windows */ } ]   // optional; stored verbatim
}
```

Schema v1 remains accepted. Schema v2 requires its motion durations, algorithm
version, fix summary, and accuracy-bearing `locationSamples`. The tuple `path`
is retained for replay compatibility. The full payload is stored verbatim in
`journey_raw`.

## Response

```jsonc
{ "ok": true, "status": "accepted", "duplicate": false, "journeyId": "...", "segmentsProcessed": 41, "eventsStored": 7 }
```

Quarantine is a terminal successful ingestion and returns
`status: "quarantined"` plus `quarantineReasons`; it never writes events,
segments, snapshots, leaderboard credit, or public-map changes. Errors: `400`
validation (message names the offending field), `409` ownership
or incomplete-ingestion conflict, `413` payload too large, `429` rate-limited,
`422` impossible telemetry, `413` payload too large, `429` rate-limited, and
`500` server error. The app retries only transient failures.

## Server-side processing (v1)

1. Device upserted by UUID (`devices`), journey stored (`journeys` + full
   payload in `journey_raw`), events stored segment-keyed (`road_events`).
2. Each journey segment is mapped to a **quantized ~100 m geographic cell**
   (`road_segments.segment_key`, e.g. `"19.055:72.840"`) — v1 road identity
   until the AI engine does OSM map-matching.
3. Cell RQI is a **sample-weighted running average**; every ingest also
   upserts a cumulative daily row in `segment_snapshots`.

## Timeline model (public map)

`segment_snapshots(segment_key, day, rqi, sample_count)` — one row per
segment per day-with-data. "The road as of date D" = latest snapshot ≤ D per
segment; days without new data carry the last state forward. Public API:

```
GET /api/public/roads?minLat&maxLat&minLon&maxLon[&at=YYYY-MM-DD]
GET /api/public/events?minLat&maxLat&minLon&maxLon[&from][&to][&type]
GET /api/public/timeline        → { earliest, latest, days: [{day, segmentsUpdated, avgRqi, eventCount}] }
```
