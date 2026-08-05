# Travel Data Contract — schemaVersion 1

The mobile app fires **one** API call per completed journey (Point A → Point B),
sending the full collected dataset in a single batch (~10 MB typical, 15 MB hard cap).

```
POST /user/mobile/traveldata        (also served at /api/user/mobile/traveldata)
Content-Type: application/json
```

No authentication. The device is identified by an **install-time UUID** minted by
the app on first launch. (The original spec said MAC ID — Android ≥ 6 does not
expose MAC addresses to apps, so a persisted UUID is the equivalent stable,
auth-free identifier.)

Uploads are **idempotent on `journey.id`**: the app can retry the same payload
safely; the server replies `{ ok: true, duplicate: true }` for an already-stored
journey.

## Payload

```jsonc
{
  "schemaVersion": 1,
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
    "endLat":   19.0330, "endLon":  72.8397
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
  "sensorWindows": [ { /* opaque raw windows */ } ]   // optional; stored verbatim
}
```

`path` and `sensorWindows` are not interpreted by the ingestion endpoint —
they are stored verbatim in `journey_raw` so the AI Core Engine can reprocess
every historical journey as detection and map-matching improve.

## Response

```jsonc
{ "ok": true, "duplicate": false, "journeyId": "...", "segmentsProcessed": 41, "eventsStored": 7 }
```

Errors: `400` validation (message names the offending field), `413` payload
too large, `429` rate-limited, `500` server error. On any non-2xx except `400`,
the app should keep the journey queued and retry with backoff.

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
