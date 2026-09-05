# BetterRoads Vehicle-Separated Data Collection and ML Plan

**Document status:** implementation-ready plan

**Prepared:** 1 September 2026

**Primary objective:** make BetterRoads a trustworthy data-collection system first, then build and validate separate road-impact models for cars, motorcycles/scooters, and auto-rickshaws.

## 1. Executive decision

BetterRoads must not train one model on a mixture of fundamentally different vehicle dynamics. A pothole produces different acceleration and rotation patterns in a car, bike, auto-rickshaw, bus, and truck because their suspension, wheel count, wheelbase, tyre size, engine vibration, mounting position, and rider/driver motion differ.

The implementation will therefore:

1. Introduce a new collection-only schema v3 for all newly recorded data.
2. Preserve existing v1/v2 journeys exactly as historical data; do not delete, rewrite, relabel, or rebuild them.
3. Collect a common set of raw physical signals so the science remains comparable, while using a different versioned collection profile for every vehicle class.
4. Store, export, label, train, evaluate, deploy, and monitor every vehicle class independently.
5. Start public-model development with cars, while allowing bikes and auto-rickshaws to collect their own isolated datasets immediately.
6. Treat all new phone detections as `ANOMALY_CANDIDATE`, never as a confirmed pothole.
7. Keep collection data completely out of current public road events, road segments, RQI aggregates, leaderboards, and the public map until a separately validated inference and evidence pipeline is enabled.

This plan intentionally separates **data collection**, **model classification**, **location consensus**, and **surface scoring**. They solve different problems and must not be collapsed into one threshold or one score.

### 1.1 Scientific basis and limits

The plan uses the supplied research as engineering guidance, not as a pretrained product model:

- Mednis et al. supports using Z-DIFF and related thresholds as sensitive candidate generators, while also showing meaningful differences between phones and non-trivial false detections.
- Wu et al. (`Sensors 2020, 20, 5564`) supports approximately 50 Hz collection, resampling, orientation handling, windowed time/frequency features, and tree-model baselines. Its severe cross-road recall drop is direct evidence that BetterRoads needs its own labelled holdout data.
- The 2020 smartphone-sensor paper supports compact accelerometer/gyroscope features and simple model comparisons, but its small single-road experiment cannot justify deployment on Indian roads or across vehicle classes.
- India-focused road-sensing studies show strong changes across rough roads, phones, placements, and two/three/four-wheel vehicles. This is why class and mount separation are mandatory.
- Public datasets such as Pothole Lab, STRIDE, and RoadSens may test the data pipeline or provide pretraining experiments, but cannot replace BetterRoads-controlled validation on its supported phones, mounts, vehicles, and roads.

No published accuracy number is carried into BetterRoads as an expected production accuracy. BetterRoads reports only results measured on its untouched, independently collected evaluation sets.

## 2. Locked product rules

### 2.1 Supported collection classes

Use these stable machine values:

- `CAR`
- `BIKE`
- `AUTO_RICKSHAW`
- `BUS`
- `TRUCK`
- `OTHER`

The first three receive full collection profiles. `BUS` and `TRUCK` receive experimental, separately stored profiles but are not eligible for model training or public inference until their own data gates are met. `OTHER` may record journey-level GPS diagnostics but is excluded from sensor-window collection and all ML datasets.

Do not rename `BIKE` yet: in the UI it means motorcycle/scooter, not bicycle. The v3 payload must add a subtype to remove that ambiguity.

### 2.2 Collection modes

Every v3 session has one of two modes:

- `STANDARD`: ordinary contributors upload versioned feature vectors, accepted GPS samples, session diagnostics, anomaly candidates, and randomly selected normal windows. No raw accelerometer/gyroscope arrays are uploaded.
- `CONTROLLED_RESEARCH`: approved test devices upload the same manifest plus raw candidate, normal, calibration, and manually marked artifact windows. Labels come from pre-surveyed road sites, passenger-operated markers, repeat passes, and independent post-drive review.

The server determines whether an account/device may use `CONTROLLED_RESEARCH`. A client-supplied mode alone must never grant raw-upload access.

### 2.3 Separation guarantee

Vehicle separation is enforced in five places:

1. The mobile collector selects exactly one immutable `vehicleClass` and one matching profile at session start.
2. The database stores the vehicle class on the session and derives every child window's class through that session.
3. Raw-object keys begin with the vehicle class and profile version.
4. Training exports require one explicit vehicle class and reject mixed-class results.
5. Model artifacts contain a vehicle class; inference refuses to load an artifact for a different class.

Separate physical PostgreSQL tables per vehicle are not necessary and would cause schema drift. Separation should be structural and validated while the common window schema remains shared. Raw objects and exported datasets are physically separated by prefix.

## 3. What each vehicle collects

All supported classes collect the same core channels because removing a sensor from one class would prevent later scientific comparisons:

- Three-axis accelerometer in m/s².
- Three-axis gyroscope in rad/s.
- Original monotonic sensor timestamps and mapped epoch timestamps.
- GPS latitude, longitude, speed, heading, altitude when available, horizontal accuracy, and provider timestamp.
- Motion state, mount-quality state, sample cadence, missing-sample ratio, and clock-drift diagnostics.
- Device model, OS, app version, vehicle profile version, feature version, and trigger version.

The differences are in metadata, calibration, artifact handling, candidate triggering, and exported feature sets.

### 3.1 Car profile

**Eligible placement**

- Fixed dashboard, windscreen, or rigid centre-console mount.
- A stable console placement is allowed only if the mount check remains valid throughout the session.
- Handheld, pocket, bag, cup-holder, and loose-seat placements are invalid for training.

**Required metadata**

- Subtype: `HATCHBACK`, `SEDAN`, `SUV`, `MPV`, `OTHER_CAR`.
- Mount position and portrait/landscape orientation.
- Suspension/vehicle-age bands when known; these fields may be `UNKNOWN` and must never be guessed.
- Optional controlled-drive fields: tyre-pressure status, approximate passenger/load band, and route identifier.

**Collection behaviour**

- Target accelerometer and gyroscope cadence: 50 Hz.
- GPS request: best navigation accuracy, approximately 1 Hz, with movement filtering unchanged.
- Minimum three-second stationary mount calibration followed by an initial moving baseline window.
- Retain vertical impact, pitch/roll response, horizontal magnitude, jerk, RMS, frequency-band energy, speed, and mount-stability features.
- Use the high-recall candidate OR gate in section 5; candidate thresholds are collection triggers, not car/pothole decisions.

**Dataset location**

`sensor-data/car/<profile-version>/<session-id>/<window-id>.json.gz`

### 3.2 Bike/scooter profile

**Eligible placement**

- A rigid handlebar, stem, mirror-base, or body mount.
- Pocket, backpack, jacket, handheld, and helmet mounting are rejected from the main bike training dataset because rider movement overwhelms road response.
- Mount position is mandatory; a session cannot start in training-eligible mode without it.

**Required metadata**

- Subtype: `MOTORCYCLE`, `SCOOTER`, `ELECTRIC_MOTORCYCLE`, `ELECTRIC_SCOOTER`.
- Mount position.
- Powertrain: `ICE`, `ELECTRIC`, or `UNKNOWN`.
- Optional controlled-drive fields: approximate engine-displacement band, rider/load band, tyre type, and route identifier.

**Collection behaviour**

- Target accelerometer and gyroscope cadence: 50 Hz.
- Record a stationary engine-on baseline for ICE vehicles in controlled sessions, in addition to the normal mount calibration.
- Preserve full gyro data because lean, steering, braking, and rider movement are essential artifact signals.
- Compute high-frequency vibration energy and a rolling engine-vibration baseline separately from impact energy.
- Candidate capture remains permissive, but bike windows are never evaluated with car thresholds or a car model.
- Turning/leaning windows are retained as negative/artifact examples in controlled research instead of being silently discarded.

**Dataset location**

`sensor-data/bike/<profile-version>/<session-id>/<window-id>.json.gz`

### 3.3 Auto-rickshaw profile

**Eligible placement**

- Rigid dashboard/frame mount or a verified stable fixed tray.
- Driver pocket, hanging holder, seat, and loose storage are invalid.

**Required metadata**

- Subtype: `PETROL_AUTO`, `CNG_AUTO`, `ELECTRIC_AUTO`, `OTHER_AUTO`.
- Mount position.
- Powertrain: `ICE`, `ELECTRIC`, or `UNKNOWN`.
- Optional controlled-drive fields: passenger/load band, vehicle-age band, and route identifier.

**Collection behaviour**

- Target accelerometer and gyroscope cadence: 50 Hz.
- Use a longer baseline phase that captures both stationary engine vibration and ordinary moving chassis vibration.
- Preserve continuous vibration-band features so the model can distinguish ordinary three-wheeler vibration from isolated road impacts.
- Capture acceleration/braking/turning artifacts as controlled negatives.
- Never subtract a single hard-coded RMS value and assume the remainder is a pothole; retain the observed baseline statistics in the payload.

**Dataset location**

`sensor-data/auto-rickshaw/<profile-version>/<session-id>/<window-id>.json.gz`

### 3.4 Bus and truck experimental profiles

- Require a fixed cabin mount and vehicle subtype.
- Add load-state band and axle/body metadata when known.
- Store under `sensor-data/bus/...` and `sensor-data/truck/...`.
- Mark every session `EXPERIMENTAL_ONLY`.
- Do not train, score, or display results until each class independently satisfies the same dataset and model gates.

### 3.5 Normal and artifact data are mandatory

A useful dataset cannot contain only threshold-triggered impacts. For each eligible session:

- Capture one unbiased normal window on a randomized schedule averaging 20 seconds, capped at 120 per session.
- Do not choose normal windows only when the road appears smooth; that would bias the dataset.
- Capture candidate windows with approximately 1.5 seconds before and 2 seconds after the trigger.
- Merge triggers less than one second apart into one encounter window.
- Cap raw candidate windows at 200 per controlled session; keep counts of suppressed candidates so noisy sessions remain diagnosable.
- Controlled sessions may explicitly mark handling, braking, turning, mount movement, rail crossing, speed breaker, joint/drain, pothole/damage, and uncertain encounters.

## 4. Schema v3 contract

### 4.1 Compatibility policy

- Existing v1/v2 rows remain untouched and readable.
- Existing `/user/mobile/traveldata` and `/api/user/mobile/traveldata` handlers remain as a legacy ingestion path during the mobile upgrade window.
- New app builds send only v3 to the new collection routes.
- v1/v2 types move into a clearly named legacy contract module; do not keep expanding them.
- Once the minimum supported app version is enforced and old upload queues have drained, v1/v2 ingestion returns a terminal `426 UPGRADE_REQUIRED`. Reading historical v1/v2 data remains supported indefinitely.
- Never run a migration that converts v1/v2 payloads into v3 training samples automatically.

### 4.2 V3 session manifest

The TypeScript and Zod definitions must describe this logical shape:

```ts
type CollectionSessionV3 = {
  schemaVersion: 3;
  sessionId: string;                 // client UUID, idempotency key
  device: {
    uuid: string;
    platform: 'android' | 'ios';
    model?: string;
    osVersion?: string;
    appVersion: string;
  };
  collection: {
    mode: 'STANDARD' | 'CONTROLLED_RESEARCH';
    vehicleClass: VehicleClass;
    vehicleSubtype: string;
    vehicleMetadata: Record<string, string | number | boolean | null>;
    mountPosition: string;
    profileVersion: string;
    featureVersion: string;
    triggerVersion: string;
    motionAlgorithmVersion: string;
    consentVersion: string;
  };
  timing: {
    startedAt: number;
    endedAt: number;
    movingDurationMs: number;
    stationaryDurationMs: number;
    sensorEpochOffsetMs: number;
    estimatedClockDriftPpm: number;
  };
  journey: {
    acceptedDistanceM: number;
    averageMovingSpeedKmh: number;
    start: LocationPoint;
    end: LocationPoint;
  };
  quality: {
    accelerometerSampleCount: number;
    gyroscopeSampleCount: number;
    effectiveAccelHz: number;
    effectiveGyroHz: number;
    accelMissingRatio: number;
    gyroMissingRatio: number;
    reliableFixCount: number;
    rejectedFixCount: number;
    meanAccuracyM: number;
    mountStableRatio: number;
    candidateCount: number;
    suppressedCandidateCount: number;
    normalWindowCount: number;
    reasons: string[];
  };
  locationSamples: LocationPoint[];
  featureWindows: FeatureWindowV1[];
  rawObjects: RawObjectManifest[];   // controlled mode only
};
```

`vehicleMetadata` is validated against the selected server-side vehicle profile; it is not an unrestricted dumping ground. Unknown values use explicit `UNKNOWN` enums or `null` where permitted.

### 4.3 Location sample

```ts
type LocationPoint = {
  timestamp: number;
  lat: number;
  lon: number;
  accuracyM: number;
  speedKmh?: number;
  headingDeg?: number;
  altitudeM?: number;
};
```

Only accepted, time-ordered fixes appear in `locationSamples`. Rejected-fix counts and reasons are diagnostic fields; do not upload known-bad coordinates as accepted path points.

### 4.4 Feature window

Each window contains:

- Window and encounter UUIDs.
- `CANDIDATE`, `RANDOM_NORMAL`, `CALIBRATION`, `MANUAL_MARKER`, or `ARTIFACT` kind.
- Start, trigger, and end timestamps.
- Trigger names and trigger measurements; never a phone-declared pothole class.
- Interpolated event location with GPS accuracy and time delta to surrounding fixes.
- Movement, speed, heading-change, mount, and sensor-cadence context.
- Time-domain acceleration features: min, max, mean, standard deviation, RMS, peak-to-peak, median, MAD, percentiles, crest factor, zero crossings, impulse duration, and jerk statistics.
- Gravity-aligned vertical and rotation-invariant horizontal features.
- Three-axis gyro features and turn/braking indicators.
- Frequency-band energy for 2–5 Hz, 5–10 Hz, and 10–20 Hz, dominant frequency, and spectral entropy.
- Missingness/interpolation diagnostics.
- The exact feature-extractor version.

Absolute latitude, longitude, device UUID, user identity, session ID, route ID, and city must not be classifier features. They are context for map matching, grouping, and audit only.

### 4.5 Raw controlled window object

Each `.json.gz` object contains:

- Format version and IDs.
- Vehicle class and profile version repeated in the header.
- Original device-coordinate accelerometer and gyroscope arrays.
- Monotonic time offsets in microseconds, not rounded epoch milliseconds.
- Calibration state and sensor availability.
- No user/account identifier.

Use delta timestamps and numeric arrays to keep the file compact. Compress with deterministic gzip and record the byte size plus SHA-256 in `RawObjectManifest`. Maximum compressed object size is 1 MiB; split larger encounter windows without splitting an individual sample.

## 5. Mobile sensing design

### 5.1 Unit and timestamp corrections happen first

Before collecting any research data:

1. Convert Expo accelerometer values from g to m/s² on both Android and iOS using `9.80665`. The current Android-only assumption is wrong and would poison every threshold and feature.
2. Read all three gyroscope axes. The current collector keeps only `z`.
3. Preserve the sensor-provided timestamp. Build a one-time monotonic-to-epoch mapping and monitor drift instead of stamping samples with `Date.now()`.
4. Record effective cadence, jitter, gaps, duplicated timestamps, and out-of-order samples.
5. Keep original raw axes for controlled sessions; perform gravity alignment on a copy.

No controlled collection should begin until replay tests prove these corrections.

### 5.2 Motion and GPS gate

Retain the pure `acquiring`, `stationary`, `moving`, and `temporary-stop` state machine with these rules:

- Reject out-of-order fixes.
- Reject accuracy worse than 50 m.
- Only fixes at or below 25 m may contribute directly to accepted distance or event location.
- Reject jumps implying more than 180 km/h and break path continuity across the rejected gap.
- Confirm movement with at least three reliable fixes plus sustained GPS speed near 5 km/h and accuracy-aware displacement, or at least 30 m consistent displacement in 45 seconds.
- Enter temporary stop after 15 seconds below approximately 2 km/h with no meaningful displacement.
- Resume through the same movement-confirmation gate and never bridge the stop with a false distance jump.

Standard feature/candidate windows are eligible only while movement is confirmed and mount quality is acceptable. Controlled sessions may retain explicitly marked stationary/handling artifacts, but those windows remain labelled context and can never affect the public map.

### 5.3 Orientation and mount handling

- Estimate gravity using a low-pass filter and derive gravity-aligned vertical acceleration.
- Use horizontal vector magnitude rather than assuming device X or Y matches the vehicle.
- Do not require the phone's physical Z axis to be vertical; that would exclude valid landscape and tilted fixed mounts.
- Run an initial three-second stability calibration and continuously calculate mount-stable ratio.
- Detect abrupt orientation changes, repeated handling-like rotations, free-fall/placement events, and a gravity magnitude outside an earth-like range.
- Pause standard candidate collection when the mount becomes invalid. Show a clear UI instruction and resume only after a stable recalibration period.

### 5.4 Candidate gate

The first gate is intentionally sensitive and creates only collection windows. A window opens when confirmed movement and mount quality are present and any of these conditions fires:

- Z-DIFF at least 0.2 g (`1.96133 m/s²`).
- Short-window acceleration RMS at least `1.2 m/s²` over approximately 400 ms.
- Dynamic acceleration magnitude at least the larger of `6 m/s²` or the rolling baseline median plus six MAD.
- A profile-specific high-frequency/jerk trigger approved through replay testing.

The fixed values are initial bootstrap defaults from the research baseline, not claims of universal accuracy. Store them in versioned profiles, make them server-configurable within safe bounds, and change them only by creating a new trigger version.

Do not use a minimum speed as a hard pothole rule after movement has been confirmed. Speed is a model/context feature. A low-speed car can still enter a pothole.

### 5.5 Rolling buffers and window creation

- Maintain time-based, not sample-count-only, rolling buffers for both sensors.
- Keep at least 1.5 seconds of pre-trigger samples.
- Continue for 2 seconds after the latest trigger.
- Associate sensor and GPS data by timestamps; interpolate between bracketing accepted GPS fixes only when both are sufficiently accurate and close in time.
- If location cannot be interpolated safely, keep the sensor window for research with `locationQuality=UNUSABLE`; do not invent coordinates.
- Merge nearby triggers into one encounter and retain every trigger reason.
- Never let opening, closing, or refreshing the HUD alter buffers, RMS accumulation, feature calculation, or scores.

### 5.6 Local retention and offline behaviour

- Store pending v3 session manifests under a new versioned collection queue; do not mix them with current `pending-journeys` files.
- Store controlled raw windows as separate files so one failed object does not require rewriting the session.
- Persist an upload state machine: `LOCAL`, `INITIALIZED`, `UPLOADING_OBJECTS`, `COMPLETING`, `COMPLETE`, `TERMINAL_REJECTED`.
- Retry only timeouts, network failures, 429, and 5xx responses with bounded exponential backoff and jitter.
- Treat validation, ownership, consent, checksum, and unsupported-version failures as terminal.
- Delete local raw files only after the server confirms the complete manifest and every object checksum.
- If the user revokes collection consent before upload completion, delete the pending v3 collection files and cancel the session; do not delete unrelated historical journeys.

## 6. Server ingestion and storage design

### 6.1 New API routes

Add authenticated routes under both existing mobile prefixes:

1. `GET /api/user/mobile/collection/config?vehicleClass=CAR`
   - Returns the current profile version, supported modes, enum choices, safe limits, feature/trigger versions, minimum app version, and consent version.
   - Mobile ships with the same conservative profile as an offline fallback and records which source/version it used.

2. `POST /api/user/mobile/collection/sessions/init`
   - Accepts client session ID, device identity, vehicle metadata, collection mode request, timing start, and object headers.
   - Authenticates owner/device, validates the exact vehicle profile, verifies controlled-mode authorization, and idempotently creates `UPLOADING` state.

3. `POST /api/user/mobile/collection/sessions/:sessionId/raw-uploads`
   - Controlled mode only.
   - Accepts object IDs, sizes, content types, and SHA-256 values.
   - Returns short-lived presigned PUT URLs for missing objects only.
   - Object keys are generated by the server; the client cannot choose a cross-vehicle prefix.

4. `POST /api/user/mobile/collection/sessions/:sessionId/complete`
   - Accepts the final v3 manifest.
   - Validates time order, movement, sensor cadence, vehicle/profile consistency, feature counts, GPS continuity, object existence, object size, and checksum metadata.
   - Commits metadata atomically and returns `received`, `quarantined`, or `duplicate`.

5. `POST /api/user/mobile/collection/sessions/:sessionId/cancel`
   - Cancels only an incomplete session owned by that account and schedules its unreferenced raw objects for deletion.

Do not place v3 into the current `traveldataSchema` union. A separate route and validator reduce the risk that collection-only data accidentally enters legacy map aggregation.

### 6.2 V3 quality outcomes

- `RECEIVED`: complete and eligible for research review/export.
- `QUARANTINED`: stored for diagnostics but excluded from training exports by default.
- `DUPLICATE`: identical already-completed session.
- Hard rejection: malformed, unauthorized, outside India, impossible timestamps/location jumps, object-prefix mismatch, checksum mismatch, unsupported vehicle/profile/version, or controlled-mode impersonation.

Quarantine reasons use stable machine codes. Store human-readable details separately so code changes do not alter analytical categories.

### 6.3 PostgreSQL tables

Add these tables without modifying historical journey rows:

**`collection_sessions`**

- IDs and ownership: session UUID, user ID, device ID.
- Vehicle identity: class, subtype, normalized metadata JSON, mount position.
- Versions: schema, collection profile, feature extractor, trigger, motion algorithm, consent.
- Mode and authorization source.
- Timing, moving/stationary duration, accepted distance, average moving speed.
- Start/end coarse coordinates for admin search; detailed accepted path remains in manifest storage.
- Quality metrics JSON, quality status/reasons, upload state.
- Received/completed/cancelled timestamps.
- Unique `(id, vehicle_class)` constraint and indexes on vehicle class, status, device, user, and completion date.

**`collection_windows`**

- Window UUID and session foreign key.
- Kind, encounter UUID, time bounds, trigger timestamp/reasons.
- Interpolated location and location quality.
- Speed/movement/mount context.
- Feature version and validated feature JSON.
- Raw object ID nullable; standard sessions always leave it null.
- Label state and export eligibility.
- Unique window ID and indexes on session, kind, label state, and time.

**`collection_raw_objects`**

- Object UUID, session ID, window ID.
- Server-generated object key, content type/encoding, expected and observed size, SHA-256.
- Upload/verification/deletion state and timestamps.
- No public URL.

**`collection_labels`**

- Window/encounter reference, taxonomy version, primary label, secondary attributes, confidence, reviewer ID, review round, evidence source, notes, and timestamps.
- Preserve label history; do not overwrite the first reviewer row.

**`research_devices`**

- Device UUID, authorization status, permitted vehicle classes, expiry, operator note, and approving administrator.

**`model_registry`** (introduced before inference, not required for the first collector release)

- Model ID/version, vehicle class, task, feature version, training-dataset hash, artifact key/hash, metrics JSON, calibration data, decision thresholds, stage, created/approved/retired timestamps.
- Unique vehicle class + task + model version.

### 6.4 Object storage

- Use a private S3-compatible bucket. MinIO is the local-development implementation; production may use MinIO or another compatible private service.
- Enable server-side encryption, block public access, and use short-lived presigned uploads.
- Raw objects use the server-generated class/profile prefix described above.
- Keep controlled raw windows for 24 months by default, subject to the consent/privacy policy.
- Delete orphaned upload objects after seven days.
- Logs must never print presigned URLs, raw payloads, exact paths, or account tokens.

## 7. Labels and controlled-drive procedure

### 7.1 Field protocol

For each controlled drive:

1. Record phone, mount, vehicle metadata, route ID, driver/operator, app/profile versions, and weather/road notes.
2. Rigidly mount the phone and give a passenger or research operator control of the marker interface; the driver must not operate it.
3. Pre-survey the controlled route and assign stable IDs and coordinates to known potholes/damage, speed breakers, joints/drains, rail crossings, and designated normal sections.
4. Record passenger-operated manual markers; the driver must not interact with the app while moving.
5. Include deliberately varied normal road, rough road, turns, braking, acceleration, traffic stops, rail crossings, joints/drains, speed breakers, potholes/damage, and handling artifacts.
6. After the drive, align manual marker timestamps with the pre-surveyed sites using route order, matched position, direction, speed, and repeated passes; preserve ambiguous matches as uncertain.
7. Label physical encounters, not overlapping windows. Multiple windows from one pothole share one encounter ID.
8. Have two reviewers independently inspect at least 20% of the synchronized sensor/GPS/site encounters. Require Cohen's kappa of at least 0.8 before accepting a label batch.

### 7.2 Hierarchical label taxonomy

Use separate decisions instead of one overloaded class:

1. `USABLE_SENSOR_DATA` / `UNUSABLE_SENSOR_DATA`.
2. `NORMAL` / `GENUINE_ROAD_IMPACT` / `HANDLING_OR_MANEUVER_ARTIFACT` / `UNCERTAIN`.
3. For genuine impacts: `POTHOLE_OR_DAMAGE`, `SPEED_BREAKER`, `JOINT_OR_DRAIN`, `RAIL_CROSSING`, `OTHER_IMPACT`, `UNCERTAIN_IMPACT`.
4. Independent surface label: `SMOOTH`, `ORDINARY`, `ROUGH`, `VERY_ROUGH`, `UNRATED`.

Do not force an uncertain marker-to-site match into a confident pothole label. Store planned infrastructure separately from road damage.

### 7.3 Initial dataset gate per vehicle class

Before training a deployable model for one class, that class should have:

- At least five phone models.
- At least five independent vehicles covering relevant suspension/body variants.
- At least ten routes across two cities.
- Multiple eligible mount positions.
- At least 500 independent encounters per important positive class and at least 100 distinct physical sites where applicable.
- Several thousand independently sampled normal and artifact windows.
- A final untouched temporal holdout collected after the training data.

Fifty overlapping windows from one pothole count as one encounter for split and confidence purposes.

## 8. ML and road-scoring plan

### 8.1 Independent models

Build these artifacts independently:

- `car-impact-*`, `car-impact-type-*`, and `car-surface-*`.
- `bike-impact-*`, `bike-impact-type-*`, and `bike-surface-*`.
- `auto-impact-*`, `auto-impact-type-*`, and `auto-surface-*`.

No artifact may fall back to a model for another vehicle. Unsupported classes remain collection-only.

### 8.2 Training sequence

For each eligible vehicle class:

1. Freeze a dataset manifest containing window IDs, encounter IDs, label versions, feature version, object hashes, and extraction query hash.
2. Split by encounter, journey, physical site/route, phone, and vehicle. Never perform a random row split over overlapping windows.
3. Keep the temporal holdout untouched until final evaluation.
4. Fit a transparent logistic-regression baseline.
5. Fit a Random Forest matching the strongest paper baseline.
6. Fit LightGBM as the likely production candidate.
7. Calibrate probabilities on a validation set.
8. Compare models against the published-rule heuristic, not just against each other.
9. Evaluate by phone, mount, vehicle subtype, speed band, route, city, and road category.
10. Register the model only if it beats the heuristic and satisfies every release gate.

Use class weights or training-time sampling inside training folds only. Never oversample, normalize, select features, or tune thresholds before the grouped split; that causes leakage.

### 8.3 Two-stage classifier

The first production hierarchy is:

1. Sensor-quality/artifact model: usable genuine vehicle response versus handling/mount/maneuver artifact.
2. Impact model: normal versus genuine road impact.
3. Impact-type model: pothole/damage versus speed breaker versus joint/drain/transverse feature versus other/uncertain.

Uncertainty is a first-class outcome. A high-recall impact candidate with weak type confidence stays `POSSIBLE_ROAD_ANOMALY`; it is not forced into `POTHOLE`.

### 8.4 BetterRoads Surface Score

Surface quality is a separate model/statistical output, not the pothole classifier and not formal IRI.

- Normalize robust vibration/frequency features for vehicle class, phone, speed, and mount-quality context.
- Aggregate repeated traversals on map-matched road bins.
- Define 100 as the smooth reference end and 0 as the worst calibrated end of the BetterRoads observed range.
- Version every score calibration.
- Keep current API `rqi` only as a deprecated compatibility alias when the new public score eventually launches.
- Never compare a raw car surface score directly with an uncalibrated bike or auto score. Cross-vehicle public aggregation requires a later validated calibration study.

## 9. Location consensus and public-map eligibility

Collection release does not write public events. The later inference release must:

- Self-host Valhalla and record the OSM/graph version used for every match.
- Map-match accepted paths to OSM edges and fixed approximately 50 m surface bins.
- Interpolate candidate time onto the matched path and cluster observations on the same road edge within approximately 15 m.
- Avoid current coordinate-grid collisions at intersections, flyovers, and parallel roads.

Evidence states:

- `POSSIBLE`: one eligible, quality-passing observation from a validated vehicle-specific model. Display with low visual weight and never call it confirmed.
- `CONFIRMED`: at least three independent installations on separate journeys with consistent matched location and model support.
- `STALE`: a possible anomaly not repeated in 14 days, or a confirmed anomaly not repeated in 60 days.
- `RESOLVED`: sufficient clean repeat traversals or explicit administrator verification.

The evidence layer combines observations only after each observation has been evaluated by its matching vehicle-specific model. Consensus may combine calibrated evidence from cars, bikes, and autos later, but the raw datasets and classifiers remain separate.

## 10. File-by-file implementation map

Paths marked **new** do not exist yet. Do not overwrite unrelated dirty work in existing files.

### 10.1 Mobile app

| File | Required change |
|---|---|
| `mobile/app/src/types.ts` | Move v1/v2 declarations to the legacy module; export v3 collection, vehicle metadata, feature-window, raw-object, quality, and API response types. |
| `mobile/app/src/legacyTravelData.ts` **new** | Hold frozen v1/v2 types used only to drain existing offline journeys. |
| `mobile/app/src/vehicles.ts` | Replace one `baselineRms` list with UI vehicle options referencing immutable profile IDs; keep labels and icons compatible. |
| `mobile/app/src/collection/vehicleProfiles.ts` **new** | Define built-in CAR, BIKE, AUTO_RICKSHAW, BUS, and TRUCK collection profiles, metadata schemas, safe caps, mount choices, and offline fallback versions. |
| `mobile/app/src/collection/clock.ts` **new** | Convert sensor monotonic timestamps to epoch, retain microsecond offsets, estimate drift, and reject duplicate/out-of-order samples. |
| `mobile/app/src/collection/orientation.ts` **new** | Gravity alignment, horizontal magnitude, mount calibration, orientation-change and handling diagnostics. |
| `mobile/app/src/collection/ringBuffer.ts` **new** | Time-based accelerometer/gyro buffers with pre/post-trigger extraction and deterministic encounter merging. |
| `mobile/app/src/collection/triggers.ts` **new** | Pure high-recall trigger logic and profile-versioned thresholds; emit `ANOMALY_CANDIDATE` reasons only. |
| `mobile/app/src/collection/features.ts` **new** | Canonical resampling and v1 feature extraction; no identity or absolute-location features. |
| `mobile/app/src/collection/windowEncoder.ts` **new** | Controlled raw-window delta encoding, deterministic gzip, SHA-256, size caps, and manifest creation. |
| `mobile/app/src/collection/queue.ts` **new** | Multi-file collection upload state machine and resumable offline storage separate from legacy journey queue. |
| `mobile/app/src/journeyRecorder.ts` | Feed full three-axis sensors with correct units/timestamps into motion, orientation, buffers, triggers, and features; build v3 manifests instead of new v2 payloads. |
| `mobile/app/src/sensorEngine.ts` | Stop creating authoritative `POTHOLE`, `BUMP`, `SWERVE`, and RQI results for v3. Retain frozen legacy behaviour only while legacy queue replay needs it, or split it into a legacy file. |
| `mobile/app/src/motionFilter.ts` | Keep the pure GPS state machine; expose discontinuity and quality diagnostics required by v3 without weakening existing movement gates. |
| `mobile/app/src/upload.ts` | Preserve legacy queue draining; route new sessions through the init/presign/complete protocol and terminal/retry classifications. |
| `mobile/app/App.tsx` | Collect subtype/mount metadata before start, request the server profile, create `JourneyRecorder` with an immutable collection configuration, and show precise discard/upload results. |
| `mobile/app/src/components/JourneyDashboard.tsx` | Keep manual vehicle selection; add vehicle-specific subtype/mount fields, collection consent, profile state, sensor/mount warnings, and `Acquiring GPS`/`Ready`/`Recording`/`Paused in traffic` states. Do not display phone-declared pothole counts. |
| `mobile/app/src/config.ts` | Add collection endpoint paths, profile fallback version, and safe upload limits; no object-storage secrets are embedded in the app. |
| `mobile/app/package.json` | Add only the audited compression/encoding dependency needed by `windowEncoder`; add replay/parity test scripts. |
| `mobile/app/README.md` and `mobile/app/context.md` | Replace v1/v2 collection claims with v3 collection-mode, placement, privacy, queue, and vehicle-separation documentation. |

### 10.2 Mobile tests and fixtures

| File | Required change |
|---|---|
| `mobile/app/src/collection/clock.test.ts` **new** | Timestamp scale, monotonic mapping, jitter, drift, duplicate, restart, and out-of-order tests. |
| `mobile/app/src/collection/orientation.test.ts` **new** | Portrait/landscape/tilted mounts, gravity, orientation change, handheld motion, and stable-mount tests. |
| `mobile/app/src/collection/triggers.test.ts` **new** | Candidate recall fixtures, cooldown/merge rules, speed-context behaviour, and no phone-side class assertions. |
| `mobile/app/src/collection/features.test.ts` **new** | Known signal statistics, frequency bands, missingness, resampling, determinism, and forbidden-feature checks. |
| `mobile/app/src/collection/queue.test.ts` **new** | Offline restart, partial object upload, duplicate completion, terminal rejection, cancellation, and cleanup. |
| `mobile/app/src/journeyRecorder.test.ts` **new** | End-to-end synthetic replay for each vehicle profile and mode. |
| `mobile/app/src/motionFilter.test.ts` | Extend current tests with tunnel gaps, circular routes, missing GPS speed, long traffic stops, and path discontinuities. |
| `mobile/app/test-fixtures/replays/` **new** | Versioned parked, shaking, start-before-departure, red-light, congestion, tunnel, GPS-jump, weak-accuracy, and known-impact fixtures. |

### 10.3 Backend

| File | Required change |
|---|---|
| `backend/src/db/schema.ts` | Add collection sessions, windows, raw objects, labels, research devices, and later model registry without altering legacy journey semantics. |
| `backend/migrations/0012_vehicle_collection_v3.sql` **new** | Create collection tables, enums/check constraints, foreign keys, indexes, and immutable separation constraints. Generate matching Drizzle snapshot/journal entries. |
| `backend/src/routes/collection.ts` **new** | Implement config, init, presign, complete, cancel, idempotency, ownership, mode authorization, and explicit statuses. |
| `backend/src/lib/collectionSchema.ts` **new** | Strict Zod v3 validators, discriminated vehicle metadata, field limits, and response types. |
| `backend/src/lib/collectionQuality.ts` **new** | Pure server-side session/window continuity, cadence, movement, GPS, count, version, object, and feature validation. |
| `backend/src/lib/objectStorage.ts` **new** | Private S3 client, server-generated keys, presigned PUTs, HEAD verification, and orphan-deletion primitives. |
| `backend/src/lib/vehicleProfiles.ts` **new** | Authoritative profile registry and compatibility rules mirrored by the mobile fallback. |
| `backend/src/index.ts` | Mount collection routes under `/user/mobile` and `/api/user/mobile`; update release identifier and startup object-store diagnostics without leaking secrets. |
| `backend/src/routes/traveldata.ts` | Freeze as legacy v1/v2 ingestion, document the sunset/minimum-app gate, and ensure it cannot accept v3. Do not mix collection tables with road aggregation. |
| `backend/src/routes/admin.ts` | Add collection session/window summaries, research-device authorization, pre-surveyed site/route management, label workflow, and single-vehicle dataset export endpoints. |
| `backend/src/middleware/rateLimit.ts` | Add separate limits for session init, manifest completion, and presign requests; raw PUT traffic goes directly to object storage. |
| `backend/.env.example` | Add S3 endpoint/region/bucket/access credentials, presign TTL, collection feature flags, minimum app version, and raw-retention settings. |
| `backend/package.json` | Add S3 client/presigner dependencies and collection-specific test scripts if needed. |
| `backend/scripts/cleanup-collection-objects.mjs` **new** | Dry-run by default; find orphaned/cancelled/expired objects, validate exact keys, and delete only with explicit execution mode. |

### 10.4 Backend tests

| File | Required change |
|---|---|
| `backend/src/lib/collectionSchema.test.ts` **new** | Valid/invalid metadata for every class, standard/raw discrimination, size/count/version limits, and forbidden unknown keys. |
| `backend/src/lib/collectionQuality.test.ts` **new** | Movement, timestamp, cadence, GPS, class/profile, feature/object, and quarantine/hard-rejection matrices. |
| `backend/src/lib/objectStorage.test.ts` **new** | Key generation, cross-class rejection, checksum/size verification, URL TTL, and no-public-read tests with a fake adapter. |
| `backend/src/routes/collection.test.ts` **new** | Authentication, ownership, controlled authorization, init retry, missing-object completion, duplicate completion, cancellation, and zero legacy aggregate writes. |
| `backend/src/routes/traveldata.test.ts` **new or extended** | Prove v1/v2 remain readable during transition, v3 is rejected by the legacy validator, and sunset returns terminal upgrade status only when enabled. |

### 10.5 AI/training package

| File | Required change |
|---|---|
| `ai/pyproject.toml` | Split runtime and training dependencies; add NumPy/SciPy/scikit-learn, LightGBM, joblib and test tooling only where needed. |
| `ai/betterroads_ai/features.py` **new** | Python canonical v1 feature extraction matching TypeScript. |
| `ai/betterroads_ai/dataset.py` **new** | One-vehicle export loading, encounter grouping, label joins, data audit, and dataset manifest hashing. |
| `ai/betterroads_ai/splits.py` **new** | Grouped route/site/journey/device/vehicle splits and final temporal holdout enforcement. |
| `ai/betterroads_ai/train.py` **new** | Heuristic, logistic regression, Random Forest, and LightGBM training with fold-contained preprocessing. |
| `ai/betterroads_ai/evaluate.py` **new** | Overall/subgroup metrics, calibration, per-100-km false positives, threshold selection, and release-gate report. |
| `ai/betterroads_ai/registry.py` **new** | Artifact hashes, metadata, vehicle/task compatibility and registry stage transitions. |
| `ai/betterroads_ai/inference.py` **new** | Server-side inference that requires exact vehicle class, feature version, and approved model stage. |
| `ai/betterroads_ai/surface.py` **new** | Independent vehicle-calibrated Surface Score features and repeated-traversal aggregation. |
| `ai/betterroads_ai/classify.py` | Mark current threshold clustering as legacy heuristic evidence; it must not masquerade as the trained v3 classifier. |
| `ai/betterroads_ai/rebuild.py` | Keep legacy rebuild isolated; never ingest collection sessions or quarantined/unaccepted data into existing public aggregates. |
| `ai/README.md` | State accurately what is heuristic, what is trained, supported classes, dataset/model versions, and exact commands. Remove claims that are not backed by artifacts and evaluation reports. |

### 10.6 AI tests

| File | Required change |
|---|---|
| `ai/tests/test_feature_parity.py` **new** | Consume the same golden fixtures as TypeScript and require numeric agreement within `1e-6` for defined deterministic features. |
| `ai/tests/test_dataset.py` **new** | Reject mixed vehicle classes, duplicate encounters, label leakage, unsupported versions, and quarantined sessions. |
| `ai/tests/test_splits.py` **new** | Prove no encounter, journey, route/site, device, or vehicle crosses protected partitions. |
| `ai/tests/test_training.py` **new** | Ensure preprocessing/oversampling occurs only inside folds and outputs reproducible manifests. |
| `ai/tests/test_inference.py` **new** | Reject class/version mismatch and unapproved models; preserve uncertainty. |
| `ai/tests/test_surface.py` **new** | Vehicle-separated normalization, repeated-pass stability, speed bands, and calibration versioning. |
| `ai/tests/test_rebuild.py` | Add explicit fixtures proving v3 collection-only rows cannot enter the legacy rebuild. |

### 10.7 Administrator dashboard

| File | Required change |
|---|---|
| `dashboard/src/App.tsx` | Add `Collection` and `Labeling` screens under Intelligence/Research. |
| `dashboard/src/lib/api.ts` | Add typed collection sessions, windows, research-device, labels, export, and object-presence response shapes. |
| `dashboard/src/components/CollectionSessions.tsx` **new** | Vehicle/status/profile filters, quality summary, raw/feature counts, and session detail/replay entry. |
| `dashboard/src/components/LabelingWorkspace.tsx` **new** | Sensor/GPS/manual-marker/site alignment, hierarchical labels, independent review rounds, disagreements, and audit history. |
| `dashboard/src/components/ResearchDevices.tsx` **new** | Authorize/revoke controlled devices by vehicle class and expiry. |
| `dashboard/src/components/ModelRegistry.tsx` **new, later phase** | Display per-vehicle model metrics, dataset hash, stage, thresholds, and approval history. |
| `dashboard/src/index.css` | Add accessible timeline/chart/label controls using the existing design tokens. |

### 10.8 Public website/map

No public-map change is required for the collection release. Later inference work modifies:

| File | Required change |
|---|---|
| `backend/src/routes/publicRoads.ts` | Return only approved evidence/score products, with evidence status, confidence, independent-device count, model version, score version, and freshness. Keep legacy shapes compatible during transition. |
| `website/src/components/map/api.ts` | Add typed possible/confirmed/stale/resolved evidence and Surface Score metadata. |
| `website/src/components/map/MapPage.tsx` | Render collection-independent evidence layers and never show raw candidates. |
| `website/src/components/map/MapLegend.tsx` | Explain Possible versus Confirmed and BetterRoads Surface Score honestly. |
| `website/src/components/map/rqiScale.ts` | Transition display wording from RQI to versioned BetterRoads Surface Score while retaining compatibility mapping. |

### 10.9 Infrastructure and documentation

| File | Required change |
|---|---|
| `docker-compose.yml` | Add private local MinIO and a one-time bucket initializer; add Valhalla only in the later map-matching phase. |
| `infra/valhalla/` **new, later phase** | India OSM graph build/update configuration, health checks, storage, resource limits, and graph-version record. |
| `docs/api-contracts/collection-v3.md` **new** | Exact routes, schemas, responses, retry rules, limits, examples, and deprecation schedule. |
| `docs/api-contracts/traveldata.md` | Mark v1/v2 legacy, frozen, and excluded from v3 model training. |
| `docs/CONTROLLED_DRIVE_PROTOCOL.md` **new** | Operator checklist, mounting, route/site survey, consent, route diversity, passenger markers, repeat passes, incident handling, and upload verification. |
| `docs/LABEL_TAXONOMY.md` **new** | Definitions, counterexamples, uncertainty rules, review procedure, and taxonomy versioning. |
| `docs/MODEL_CARD_TEMPLATE.md` **new** | Intended use, unsupported use, vehicle class, training distribution, subgroup metrics, thresholds, limitations, and approval. |
| `docs/PRIVACY_AND_RETENTION.md` **new** | Consent, precise location handling, raw-sensor retention, access, deletion, de-identification, and export controls. |
| `docs/ARCHITECTURE_STATUS.md` | Update only after components actually exist; distinguish planned, implemented, validated, and deployed states. |
| `scripts/test-all.mjs` | Add v3 mobile/backend/AI parity and integration suites without removing existing website/dashboard/build checks. |

## 11. Step-by-step delivery order

### Phase 0 — Preserve and baseline current work

1. Record the current dirty worktree and avoid rewriting unrelated website/dashboard/APK changes.
2. Run current mobile typecheck/tests, backend tests/build, AI tests, website build, and dashboard build.
3. Save representative v1/v2 payload fixtures and verify current legacy ingestion behaviour.
4. Add this plan and contract documentation before implementation branches diverge.

**Exit condition:** reproducible baseline results and no ambiguity about pre-existing failures.

### Phase 1 — Correct sensor science

1. Implement timestamp conversion, full gyro axes, and g-to-m/s² correction.
2. Implement orientation/mount processing and cadence diagnostics.
3. Extend motion filtering and create replay fixtures.
4. Build rolling buffers and neutral candidate windows.
5. Prove a parked ten-minute recording creates zero eligible distance/candidates and that shaking a stationary phone creates no eligible road event.

**Exit condition:** controlled fixture tests pass and no production/user collection is accepted under the old incorrect Android units.

### Phase 2 — Vehicle profiles and local collection

1. Add immutable CAR, BIKE, AUTO_RICKSHAW, BUS, and TRUCK profiles.
2. Add subtype/mount metadata UI and validation.
3. Add canonical feature extraction and random normal sampling.
4. Add controlled raw-window encoding and separate offline queue.
5. Run phone-level dry drives without server acceptance; inspect sizes, cadence, battery, and mount states.

**Exit condition:** each session is unambiguously one vehicle class/profile, ordinary payload median is below 2 MiB, controlled session manifest plus objects remains within configured limits, and no raw arrays appear in STANDARD manifests.

### Phase 3 — V3 backend and private storage

1. Create collection tables/migration and strict validators.
2. Add MinIO locally and object-storage abstraction.
3. Implement config/init/presign/complete/cancel routes.
4. Add idempotency, authorization, quality evaluation, retention metadata, and cleanup dry run.
5. Prove v3 writes zero rows to `road_events`, `road_segments`, `segment_snapshots`, and legacy journey leaderboard inputs.

**Exit condition:** offline/duplicate/partial/terminal flows pass end-to-end and cross-vehicle object or export attempts are rejected.

### Phase 4 — Admin research workflow

1. Add research-device authorization.
2. Add collection-session inspection and sensor/GPS replay.
3. Add pre-surveyed route/site management and marker-to-site alignment.
4. Add hierarchical double-review labeling with audit history.
5. Add single-vehicle frozen dataset exports and hashes.

**Exit condition:** a reviewer can take a controlled drive from upload through audited labels and produce a reproducible one-vehicle dataset manifest.

### Phase 5 — Controlled field collection

1. Pilot cars, bikes, and autos separately using the controlled protocol.
2. Audit false triggers, missed markers, cadence, GPS, mount invalidation, battery, object sizes, and label agreement weekly.
3. Change profiles only by version; never silently tune an existing profile.
4. Continue until each vehicle class independently reaches its data gate.

**Exit condition:** the car dataset gate is met first; bike/auto continue collecting without delaying car experiments.

### Phase 6 — Car model first

1. Freeze the first eligible car dataset.
2. Train heuristic, logistic regression, Random Forest, and LightGBM with grouped splits.
3. Calibrate and evaluate on unseen routes/phones/cars and then the untouched temporal holdout.
4. Register a car artifact only if every gate passes.
5. Deploy in server-side shadow mode; compare predictions without changing the public map.

**Exit condition:** shadow metrics agree with offline expectations and no public or aggregate write occurs.

### Phase 7 — Bike and auto models independently

Repeat Phase 6 independently for bike and auto only after each reaches its own dataset gate. Do not reuse the car model, car normalization, or car thresholds.

### Phase 8 — Map matching, consensus, and Surface Score

1. Deploy self-hosted Valhalla with recorded graph versions.
2. Build same-road-edge event clustering and independent-device evidence states.
3. Calibrate Surface Score independently per vehicle class and validate repeated-route stability.
4. Enable Possible, Confirmed, and Surface Score as separate feature flags.
5. Update public API/map only after the corresponding evidence gate passes.

## 12. Verification and acceptance gates

### 12.1 Collector correctness

- Accelerometer conversion test at rest produces gravity magnitude near `9.80665 m/s²` on Android and iOS fixtures.
- Effective sensor cadence is accepted between 40 and 60 Hz; out-of-range sessions are quarantined from training.
- TypeScript and Python canonical features agree within `1e-6` where both use deterministic floating-point formulas.
- Ten minutes parked: zero accepted scored distance and zero STANDARD candidates; a STANDARD session is discarded when journey minimums are not met. An authorized CONTROLLED_RESEARCH session may retain an explicitly labelled stationary/calibration artifact for research only.
- Stationary shaking: no eligible road-impact observation.
- Two-minute traffic stop: collection pauses and resumes in the same session without bridging distance.
- Slow consistent congestion movement eventually commits buffered GPS points.
- Rejected GPS jump never becomes path distance or event location.
- Ordinary STANDARD payload contains no raw sensor arrays or object references.
- Controlled raw windows preserve at least 1.5 seconds before and 2 seconds after an isolated trigger when sensor data exists.
- Candidate capture recall on controlled marked encounters is at least 97%; precision is not a collection-gate target because this layer is intentionally high recall.

### 12.2 Payload, performance, and privacy

- Median STANDARD journey payload below 2 MiB.
- Each compressed raw object no larger than 1 MiB; server-configured controlled-session cap enforced.
- Sensing battery overhead target below 5% per hour on representative supported phones.
- No user/account IDs inside raw objects or model features.
- No public object access.
- Cross-account, cross-device, cross-class, unsupported-version, and checksum failures are terminal and tested.
- Consent revocation removes pending local collection and schedules incomplete server objects for deletion.

### 12.3 Model gates per vehicle class

- Possible-impact layer: pothole/damage recall at least 90%, precision at least 70%, fewer than five false possible observations per 100 km.
- Every required phone/mount/subtype/speed subgroup has recall at least 80%; report sample counts and confidence intervals.
- Confirmed public anomaly layer: precision at least 95% and fewer than 0.5 false confirmed anomalies per 100 km.
- Map-matched event location: median error at most 10 m and p95 at most 25 m against verified locations.
- Surface Score: Spearman rank correlation at least 0.8 with independent route ratings and median repeated-pass difference no more than 10 points.
- The candidate/model must beat the heuristic on the untouched holdout; accuracy alone is never sufficient.

### 12.4 Required replay scenarios

- Parked GPS jitter.
- Stationary phone shaking.
- Start recording before departure.
- Red lights and long traffic stops.
- Stop-and-go congestion crawl.
- Tunnel/GPS gap and recovery.
- Impossible GPS jump.
- Weak accuracy and missing speed.
- Circular route returning near the start.
- Out-of-order and duplicated timestamps.
- Sensor cadence drop, burst, and clock drift.
- Portrait, landscape, tilted fixed mount, and mid-drive mount movement.
- Hard braking, acceleration, U-turn, ordinary turns, swerving, and phone handling.
- Pothole/damage, speed breaker, joint/drain, rail crossing, rough road, and normal road.
- Each scenario repeated under car, bike, and auto profiles where physically relevant.

## 13. Rollout, monitoring, and rollback

- Ship the collector behind per-vehicle server feature flags.
- Start with internal controlled devices, then a small consented standard cohort.
- Monitor sessions by class/profile/app/phone/mount: completion, quarantine reasons, effective Hz, GPS accuracy, candidates/km, normal windows/km, payload size, battery sample, and upload retry rate.
- Never compare raw candidates/km across vehicle classes as if they share the same physical response.
- Profile updates are immutable versions. Rollback means disabling a version and returning the previous approved profile to new sessions; existing sessions retain their recorded version.
- Model deployment stages are `EXPERIMENT`, `SHADOW`, `POSSIBLE_ONLY`, `CONFIRMED_ELIGIBLE`, `RETIRED`.
- Public Possible, Confirmed, and Surface Score layers have independent kill switches.
- A rollback must stop new inference/public promotion without deleting raw collection data, labels, manifests, historical models, or existing legacy records.

## 14. Explicit non-goals for the first collection release

- No claim that the phone has identified a pothole.
- No public map writes from v3 collection data.
- No automatic mixing or transfer learning across vehicle classes.
- No background/screen-off recording.
- No driver-operated manual confirmation while moving.
- No formal IRI claim.
- No historical v1/v2 audit, relabel, migration, or aggregate rebuild.
- No universal support claim for buses, trucks, bicycles, handheld phones, pockets, or unknown placements.

## 15. Final implementation checklist

- [ ] Preserve and test v1/v2 legacy behaviour.
- [ ] Correct Android/iOS accelerometer units and sensor timestamps.
- [ ] Collect full accelerometer and gyroscope axes.
- [ ] Add orientation-independent features and mount calibration.
- [ ] Add separate immutable vehicle profiles.
- [ ] Replace phone-side road labels with neutral candidate windows for v3.
- [ ] Add unbiased normal-window sampling.
- [ ] Add standard feature-only and authorized controlled-raw modes.
- [ ] Implement separate v3 offline queue and resumable object upload.
- [ ] Add private object storage and v3 collection tables/routes.
- [ ] Prove zero legacy/public aggregate writes from collection data.
- [ ] Add admin controlled-device, replay, labeling, and export workflows.
- [ ] Establish controlled field protocol and label agreement.
- [ ] Reach the dataset gate independently for each vehicle.
- [ ] Train/evaluate car models first with grouped and temporal holdouts.
- [ ] Train bike and auto models independently when ready.
- [ ] Deploy inference in shadow mode.
- [ ] Add Valhalla map matching and evidence consensus.
- [ ] Enable Possible, Confirmed, and Surface Score independently only after their gates pass.

## 16. Definition of success

The collection release is successful when BetterRoads can reliably record scientifically usable, versioned, consented data for cars, bikes, and auto-rickshaws; guarantee that the three datasets cannot be accidentally mixed; survive offline use and partial uploads; expose an auditable research/labeling workflow; and produce no unsupported pothole claims or public-map changes.

The ML release is successful only when a vehicle-specific model beats the heuristic on entirely unseen routes, phones, vehicles, and physical encounters, passes subgroup and location gates, remains calibrated in shadow production, and feeds an independent multi-observation evidence system rather than turning one phone jolt into a public pothole.
