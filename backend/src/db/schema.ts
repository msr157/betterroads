import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    publicId: text('public_id').notNull(),
    username: text('username').notNull(),
    googleSubject: text('google_subject'),
    email: text('email'),
    name: text('name').notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: text('gender'),
    genderSelfDescription: text('gender_self_description'),
    city: text('city'),
    publicLeaderboard: boolean('public_leaderboard').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_public_id_idx').on(t.publicId),
    uniqueIndex('users_username_idx').on(t.username),
    uniqueIndex('users_google_subject_idx').on(t.googleSubject),
    uniqueIndex('users_email_idx').on(t.email),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
  },
  (t) => [uniqueIndex('user_sessions_token_idx').on(t.tokenHash), index('user_sessions_user_idx').on(t.userId)],
);

export const administrators = pgTable(
  'administrators',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email'),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    preferences: jsonb('preferences').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('administrators_username_idx').on(t.username)],
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    administratorId: integer('administrator_id').notNull().references(() => administrators.id),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
  },
  (t) => [uniqueIndex('admin_sessions_token_idx').on(t.tokenHash), index('admin_sessions_admin_idx').on(t.administratorId)],
);

export const contractors = pgTable('contractors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  registrationNumber: text('registration_number'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roadContracts = pgTable(
  'road_contracts',
  {
    id: serial('id').primaryKey(),
    contractorId: integer('contractor_id').notNull().references(() => contractors.id),
    roadName: text('road_name').notNull(),
    city: text('city').notNull(),
    ward: text('ward'),
    tenderReference: text('tender_reference'),
    details: text('details'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    budget: doublePrecision('budget'),
    status: text('status').notNull().default('planned'),
    guaranteeUntil: date('guarantee_until'),
    notes: text('notes'),
    geometry: jsonb('geometry'),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('road_contracts_city_idx').on(t.city), index('road_contracts_published_idx').on(t.published), index('road_contracts_contractor_idx').on(t.contractorId)],
);

/**
 * waitlist_signups — stores every unique email that joins the BetterRoads
 * waitlist. Keyed on email (unique) so duplicate submissions are idempotent.
 */
export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: serial('id').primaryKey(),

    /** Canonical lowercase email address. Max 254 chars per RFC 5321. */
    email: text('email').notNull(),

    /** Optional first name / display name, trimmed, max 80 chars. */
    name: text('name'),

    /** Optional city, trimmed, max 80 chars. */
    city: text('city'),

    /**
     * Optional way the signup offered to contribute (slug from
     * CONTRIBUTION_OPTIONS, e.g. 'road_data'). Null when none selected.
     */
    contribution: text('contribution'),

    /** Optional WhatsApp number for follow-up. Null when not provided. */
    whatsapp: text('whatsapp'),

    /** Optional free-text message / how they can help. Null when empty. */
    message: text('message'),

    /** Row creation timestamp (server-side UTC). */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('waitlist_signups_email_idx').on(table.email),
  ],
);

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type NewWaitlistSignup = typeof waitlistSignups.$inferInsert;

/**
 * app_settings — simple key-value store for global configurations.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// Road-sensing data model (traveldata ingestion pipeline)
//
// Identity model: no authentication — a device is identified by an
// install-time UUID generated on the phone (Android does not expose MAC
// addresses; getMacAddress() returns 02:00:00:00:00:00 since Android 6).
//
// Road identity: segments are keyed by a quantized geographic cell
// (~100 m, see src/lib/roadSegments.ts) rather than OSM way IDs. Two
// different roads crossing the same cell can collide; the AI engine will
// upgrade this to proper map-matching later. All raw journey data is kept
// (journey_raw) so segments can be re-derived under a better keying scheme.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * devices — one row per app installation. UUID minted by the phone on first
 * launch; no PII.
 */
export const devices = pgTable(
  'devices',
  {
    id: serial('id').primaryKey(),
    /** Owner of authenticated uploads; null for pre-auth anonymous devices. */
    userId: integer('user_id').references(() => users.id),
    /** Install-time UUID minted by the mobile app. */
    deviceUuid: text('device_uuid').notNull(),
    /** 'android' | 'ios'. */
    platform: text('platform').notNull().default('android'),
    /** Free-form device model string, e.g. "Pixel 8". */
    model: text('model'),
    appVersion: text('app_version'),
    /** Default vehicle type the user set in the app, if any. */
    defaultVehicleType: text('default_vehicle_type'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    journeyCount: integer('journey_count').notNull().default(0),
  },
  (t) => [uniqueIndex('devices_uuid_idx').on(t.deviceUuid), index('devices_user_idx').on(t.userId)],
);

export type Device = typeof devices.$inferSelect;

/**
 * journeys — one completed trip (point A → point B), uploaded by the mobile
 * app in a single POST once the journey ends. Mirrors the app's Room
 * `journeys` table.
 */
export const journeys = pgTable(
  'journeys',
  {
    /** Client-minted UUID — makes uploads idempotent on retry. */
    id: text('id').primaryKey(),
    /** Owner resolved from the bearer session; null only on legacy rows. */
    userId: integer('user_id').references(() => users.id),
    deviceId: integer('device_id')
      .notNull()
      .references(() => devices.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    distanceM: doublePrecision('distance_m').notNull(),
    durationS: integer('duration_s').notNull(),
    avgSpeedKmh: doublePrecision('avg_speed_kmh').notNull(),
    /** 'CAR' | 'BIKE' | 'AUTO_RICKSHAW' | 'BUS' | 'TRUCK' | 'OTHER'. */
    vehicleType: text('vehicle_type').notNull(),
    phoneMountPosition: text('phone_mount_position'),
    /** Vehicle-specific vibration floor the app subtracted (m/s² RMS). */
    baseFloorRms: doublePrecision('base_floor_rms'),
    /** Journey-level RQI (0–100) as computed on-device. */
    rqiScore: doublePrecision('rqi_score').notNull(),
    eventCount: integer('event_count').notNull().default(0),
    startLat: doublePrecision('start_lat').notNull(),
    startLon: doublePrecision('start_lon').notNull(),
    endLat: doublePrecision('end_lat').notNull(),
    endLon: doublePrecision('end_lon').notNull(),
    /** Payload schema version the app uploaded with. */
    schemaVersion: integer('schema_version').notNull().default(1),
    qualityStatus: text('quality_status').notNull().default('LEGACY_APPROVED'),
    qualityReasons: jsonb('quality_reasons').notNull().default([]),
    qualityDiagnostics: jsonb('quality_diagnostics').notNull().default({}),
    detectionAlgorithmVersion: text('detection_algorithm_version'),
    movingDurationS: integer('moving_duration_s'),
    stationaryDurationS: integer('stationary_duration_s'),
    /** Set only after authenticated ingestion and road aggregation completes. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('journeys_device_idx').on(t.deviceId),
    index('journeys_user_idx').on(t.userId),
    index('journeys_ended_at_idx').on(t.endedAt),
    index('journeys_accepted_at_idx').on(t.acceptedAt),
    index('journeys_quality_status_idx').on(t.qualityStatus),
  ],
);

export type Journey = typeof journeys.$inferSelect;

/**
 * journey_raw — the full uploaded payload (GPS path, per-segment stats, raw
 * sensor windows when included), kept verbatim so the AI engine can reprocess
 * historical journeys as detection/matching improves. Separate table so the
 * hot `journeys` table stays narrow.
 */
export const journeyRaw = pgTable('journey_raw', {
  journeyId: text('journey_id')
    .primaryKey()
    .references(() => journeys.id),
  payload: jsonb('payload').notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════
// Collection schema v3 — research/feature data only. These tables are never
// consumed by the legacy road-event or road-segment aggregation path.
// ═══════════════════════════════════════════════════════════════════════════

export const collectionSessions = pgTable(
  'collection_sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    deviceId: integer('device_id').notNull().references(() => devices.id),
    schemaVersion: integer('schema_version').notNull().default(3),
    mode: text('mode').notNull(),
    vehicleClass: text('vehicle_class').notNull(),
    vehicleSubtype: text('vehicle_subtype').notNull(),
    vehicleMetadata: jsonb('vehicle_metadata').notNull().default({}),
    mountPosition: text('mount_position').notNull(),
    profileVersion: text('profile_version').notNull(),
    featureVersion: text('feature_version').notNull(),
    triggerVersion: text('trigger_version').notNull(),
    motionAlgorithmVersion: text('motion_algorithm_version').notNull(),
    consentVersion: text('consent_version').notNull(),
    authorizationSource: text('authorization_source').notNull().default('STANDARD_ACCOUNT'),
    uploadState: text('upload_state').notNull().default('UPLOADING'),
    qualityStatus: text('quality_status'),
    qualityReasons: jsonb('quality_reasons').notNull().default([]),
    qualityDiagnostics: jsonb('quality_diagnostics').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    movingDurationMs: integer('moving_duration_ms'),
    stationaryDurationMs: integer('stationary_duration_ms'),
    acceptedDistanceM: doublePrecision('accepted_distance_m'),
    averageMovingSpeedKmh: doublePrecision('average_moving_speed_kmh'),
    startLat: doublePrecision('start_lat'),
    startLon: doublePrecision('start_lon'),
    endLat: doublePrecision('end_lat'),
    endLon: doublePrecision('end_lon'),
    timingDiagnostics: jsonb('timing_diagnostics').notNull().default({}),
    sensorQuality: jsonb('sensor_quality').notNull().default({}),
    locationSamples: jsonb('location_samples').notNull().default([]),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('collection_sessions_user_idx').on(t.userId),
    index('collection_sessions_device_idx').on(t.deviceId),
    index('collection_sessions_vehicle_idx').on(t.vehicleClass),
    index('collection_sessions_quality_idx').on(t.qualityStatus),
    index('collection_sessions_state_idx').on(t.uploadState),
    index('collection_sessions_completed_idx').on(t.completedAt),
  ],
);

export const collectionWindows = pgTable(
  'collection_windows',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => collectionSessions.id),
    encounterId: text('encounter_id').notNull(),
    kind: text('kind').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    triggerAt: timestamp('trigger_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    triggerReasons: jsonb('trigger_reasons').notNull().default([]),
    triggerMeasurements: jsonb('trigger_measurements').notNull().default({}),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    accuracyM: doublePrecision('accuracy_m'),
    locationQuality: text('location_quality'),
    bracketGapMs: integer('bracket_gap_ms'),
    featureVersion: text('feature_version').notNull(),
    features: jsonb('features').notNull(),
    labelState: text('label_state').notNull().default('UNLABELLED'),
    exportEligible: boolean('export_eligible').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('collection_windows_session_idx').on(t.sessionId),
    index('collection_windows_encounter_idx').on(t.encounterId),
    index('collection_windows_kind_idx').on(t.kind),
    index('collection_windows_label_idx').on(t.labelState),
    index('collection_windows_started_idx').on(t.startedAt),
  ],
);

export const collectionRawObjects = pgTable(
  'collection_raw_objects',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => collectionSessions.id),
    // Verified against collection_windows during completion. It cannot be a
    // DB FK because controlled objects upload before the final window manifest.
    windowId: text('window_id').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    contentEncoding: text('content_encoding').notNull(),
    expectedSize: integer('expected_size').notNull(),
    observedSize: integer('observed_size'),
    sha256: text('sha256').notNull(),
    state: text('state').notNull().default('PENDING'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('collection_raw_objects_key_idx').on(t.objectKey),
    index('collection_raw_objects_session_idx').on(t.sessionId),
    index('collection_raw_objects_window_idx').on(t.windowId),
    index('collection_raw_objects_state_idx').on(t.state),
  ],
);

export const collectionLabels = pgTable(
  'collection_labels',
  {
    id: serial('id').primaryKey(),
    windowId: text('window_id').notNull().references(() => collectionWindows.id),
    reviewerId: integer('reviewer_id').notNull().references(() => administrators.id),
    taxonomyVersion: text('taxonomy_version').notNull(),
    primaryLabel: text('primary_label').notNull(),
    secondaryAttributes: jsonb('secondary_attributes').notNull().default({}),
    confidence: doublePrecision('confidence').notNull(),
    reviewRound: integer('review_round').notNull().default(1),
    evidenceSource: text('evidence_source').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('collection_labels_window_idx').on(t.windowId),
    index('collection_labels_reviewer_idx').on(t.reviewerId),
    uniqueIndex('collection_labels_round_idx').on(t.windowId, t.reviewerId, t.reviewRound),
  ],
);

export const researchDevices = pgTable(
  'research_devices',
  {
    deviceUuid: text('device_uuid').primaryKey(),
    status: text('status').notNull().default('AUTHORIZED'),
    permittedVehicleClasses: jsonb('permitted_vehicle_classes').notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    operatorNote: text('operator_note'),
    approvedBy: integer('approved_by').references(() => administrators.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('research_devices_status_idx').on(t.status)],
);

export const researchRoutes = pgTable('research_routes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  routeVersion: text('route_version').notNull(),
  geometry: jsonb('geometry').notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: integer('created_by').notNull().references(() => administrators.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const researchSites = pgTable(
  'research_sites',
  {
    id: serial('id').primaryKey(),
    routeId: integer('route_id').notNull().references(() => researchRoutes.id),
    stableSiteId: text('stable_site_id').notNull(),
    siteType: text('site_type').notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    direction: text('direction'),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('research_sites_stable_id_idx').on(t.routeId, t.stableSiteId), index('research_sites_route_idx').on(t.routeId)],
);

export const collectionMarkers = pgTable(
  'collection_markers',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => collectionSessions.id),
    routeId: integer('route_id').references(() => researchRoutes.id),
    siteId: integer('site_id').references(() => researchSites.id),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull(),
    markerType: text('marker_type').notNull(),
    matchStatus: text('match_status').notNull().default('UNMATCHED'),
    matchDiagnostics: jsonb('match_diagnostics').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('collection_markers_session_idx').on(t.sessionId), index('collection_markers_site_idx').on(t.siteId)],
);

export const modelRegistry = pgTable(
  'model_registry',
  {
    id: text('id').primaryKey(),
    modelVersion: text('model_version').notNull(),
    vehicleClass: text('vehicle_class').notNull(),
    task: text('task').notNull(),
    featureVersion: text('feature_version').notNull(),
    trainingDatasetHash: text('training_dataset_hash').notNull(),
    artifactKey: text('artifact_key').notNull(),
    artifactSha256: text('artifact_sha256').notNull(),
    metrics: jsonb('metrics').notNull(),
    calibration: jsonb('calibration').notNull().default({}),
    decisionThresholds: jsonb('decision_thresholds').notNull().default({}),
    stage: text('stage').notNull().default('EXPERIMENT'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('model_registry_version_idx').on(t.vehicleClass, t.task, t.modelVersion),
    index('model_registry_stage_idx').on(t.stage),
  ],
);

/**
 * road_events — individual detected jolts (pothole, bump, swerve…), tagged
 * with the sensor readings that triggered them. Mirrors the app's
 * `road_events` Room table.
 */
export const roadEvents = pgTable(
  'road_events',
  {
    /** Client-minted UUID. */
    id: text('id').primaryKey(),
    journeyId: text('journey_id')
      .notNull()
      .references(() => journeys.id),
    /** 'POTHOLE' | 'BUMP' | 'SPEED_BREAKER' | 'SWERVE' | 'MANUAL_REPORT'. */
    type: text('type').notNull(),
    /** 0.0–1.0. */
    severity: doublePrecision('severity').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    altitudeM: doublePrecision('altitude_m'),
    speedKmh: doublePrecision('speed_kmh'),
    accelX: doublePrecision('accel_x'),
    accelY: doublePrecision('accel_y'),
    accelZ: doublePrecision('accel_z'),
    gyroZ: doublePrecision('gyro_z'),
    heading: doublePrecision('heading'),
    /** GPS accuracy at the recorded position, when supplied or recoverable. */
    accuracyM: doublePrecision('accuracy_m'),
    /** How accuracy was obtained. Null means legacy precision is unknown. */
    locationQuality: text('location_quality'),
    /** Stable association used by the public pothole-hotspot layer. */
    potholeHotspotId: text('pothole_hotspot_id'),
    /** Quantized cell this event falls in (see road_segments). */
    segmentKey: text('segment_key').notNull(),
  },
  (t) => [
    index('road_events_journey_idx').on(t.journeyId),
    index('road_events_segment_idx').on(t.segmentKey),
    index('road_events_occurred_idx').on(t.occurredAt),
    index('road_events_latlon_idx').on(t.lat, t.lon),
    index('road_events_hotspot_idx').on(t.potholeHotspotId),
  ],
);

export type RoadEvent = typeof roadEvents.$inferSelect;

/** Stable recorded centres for accepted automatic pothole detections. */
export const potholeHotspots = pgTable(
  'pothole_hotspots',
  {
    id: text('id').primaryKey(),
    centerLat: doublePrecision('center_lat').notNull(),
    centerLon: doublePrecision('center_lon').notNull(),
    segmentKey: text('segment_key').notNull(),
    firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).notNull(),
    lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('pothole_hotspots_latlon_idx').on(t.centerLat, t.centerLon),
    index('pothole_hotspots_segment_idx').on(t.segmentKey),
  ],
);

export type PotholeHotspot = typeof potholeHotspots.$inferSelect;

/**
 * road_segments — the aggregated, current view of a stretch of road
 * (~100 m quantized cell). `currentRqi` is a sample-weighted running average
 * across every journey that crossed the cell.
 */
export const roadSegments = pgTable(
  'road_segments',
  {
    /** Quantized cell key, e.g. "19.055:72.840" (see src/lib/roadSegments.ts). */
    segmentKey: text('segment_key').primaryKey(),
    centerLat: doublePrecision('center_lat').notNull(),
    centerLon: doublePrecision('center_lon').notNull(),
    /**
     * Representative polyline for drawing: [[lat, lon], …] from the first
     * journey segment observed in this cell (refined later by the AI engine).
     */
    geometry: jsonb('geometry').notNull(),
    /** Latest sample-weighted RQI, 0–100. */
    currentRqi: doublePrecision('current_rqi').notNull(),
    /** Number of journey-segments that contributed to currentRqi. */
    sampleCount: integer('sample_count').notNull().default(0),
    /** Total detected events in this cell, all time. */
    eventCount: integer('event_count').notNull().default(0),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('road_segments_latlon_idx').on(t.centerLat, t.centerLon)],
);

export type RoadSegment = typeof roadSegments.$inferSelect;

/**
 * segment_snapshots — daily RQI time-series per segment. This is what powers
 * the public map's draggable timeline: "as of date D" = the latest snapshot
 * ≤ D for each segment. One row per (segment, day) with data; days without
 * new journeys simply have no row, so the previous snapshot carries forward.
 */
export const segmentSnapshots = pgTable(
  'segment_snapshots',
  {
    id: serial('id').primaryKey(),
    segmentKey: text('segment_key')
      .notNull()
      .references(() => roadSegments.segmentKey),
    /** UTC calendar day the contributing journeys ended on. */
    day: date('day').notNull(),
    /** Sample-weighted RQI for this segment as of this day (cumulative). */
    rqi: doublePrecision('rqi').notNull(),
    /** Cumulative samples up to and including this day. */
    sampleCount: integer('sample_count').notNull(),
    /** Events detected on this day in this segment. */
    eventCount: integer('event_count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('segment_snapshots_key_day_idx').on(t.segmentKey, t.day),
    index('segment_snapshots_day_idx').on(t.day),
  ],
);

export type SegmentSnapshot = typeof segmentSnapshots.$inferSelect;

export const feedbacks = pgTable('feedbacks', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  category: text('category').notNull(),
  description: text('description').notNull(),
  source: text('source').notNull(),
  deviceOs: text('device_os'),
  location: text('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
