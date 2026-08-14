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
    googleSubject: text('google_subject').notNull(),
    email: text('email').notNull(),
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
  (t) => [index('road_contracts_city_idx').on(t.city), index('road_contracts_published_idx').on(t.published)],
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
    /** Set only after authenticated ingestion and road aggregation completes. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('journeys_device_idx').on(t.deviceId),
    index('journeys_user_idx').on(t.userId),
    index('journeys_ended_at_idx').on(t.endedAt),
    index('journeys_accepted_at_idx').on(t.acceptedAt),
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
    /** Quantized cell this event falls in (see road_segments). */
    segmentKey: text('segment_key').notNull(),
  },
  (t) => [
    index('road_events_journey_idx').on(t.journeyId),
    index('road_events_segment_idx').on(t.segmentKey),
    index('road_events_occurred_idx').on(t.occurredAt),
    index('road_events_latlon_idx').on(t.lat, t.lon),
  ],
);

export type RoadEvent = typeof roadEvents.$inferSelect;

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
