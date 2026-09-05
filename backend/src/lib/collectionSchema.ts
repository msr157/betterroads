import { z } from 'zod';
import { SERVER_VEHICLE_PROFILES, VEHICLE_CLASSES } from './vehicleProfiles.js';

const epochMs = z.number().int().min(1_577_836_800_000).refine(
  (value) => value <= Date.now() + 86_400_000,
  'Timestamp is too far in the future.',
);
const finite = z.number().finite();
const lat = finite.min(-90).max(90);
const lon = finite.min(-180).max(180);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const collectionModeSchema = z.enum(['STANDARD', 'CONTROLLED_RESEARCH']);
export const vehicleClassSchema = z.enum(VEHICLE_CLASSES);

export const locationPointSchema = z.object({
  timestamp: epochMs,
  lat,
  lon,
  accuracyM: finite.min(0).max(1_000),
  speedKmh: finite.min(0).max(400).optional(),
  headingDeg: finite.min(0).max(360).optional(),
  altitudeM: finite.min(-500).max(10_000).optional(),
}).strict();

const distributionSchema = z.object({
  min: finite, max: finite, mean: finite, standardDeviation: finite.min(0), rms: finite.min(0),
  peakToPeak: finite.min(0), median: finite, mad: finite.min(0), p05: finite, p25: finite, p75: finite,
  p95: finite, crestFactor: finite.min(0), zeroCrossings: z.number().int().min(0),
}).strict();

export const featureVectorV1Schema = z.object({
  vertical: distributionSchema,
  horizontal: distributionSchema,
  dynamicMagnitude: distributionSchema,
  jerk: distributionSchema,
  gyroMagnitude: distributionSchema,
  frequency: z.object({
    energy2To5Hz: finite.min(0), energy5To10Hz: finite.min(0), energy10To20Hz: finite.min(0),
    dominantFrequencyHz: finite.min(0).max(25), spectralEntropy: finite.min(0).max(1),
  }).strict(),
  context: z.object({
    durationMs: z.number().int().min(100).max(10_000),
    speedKmh: finite.min(0).max(400).optional(),
    headingChangeDeg: finite.min(-360).max(360).optional(),
    movementState: z.literal('moving'),
    mountStableRatio: finite.min(0).max(1),
    accelerometerSampleCount: z.number().int().min(0).max(1_000),
    gyroscopeSampleCount: z.number().int().min(0).max(1_000),
    accelerometerMissingRatio: finite.min(0).max(1),
    gyroscopeMissingRatio: finite.min(0).max(1),
  }).strict(),
}).strict();

export const featureWindowV1Schema = z.object({
  windowId: z.string().uuid(),
  encounterId: z.string().uuid(),
  kind: z.enum(['CANDIDATE', 'RANDOM_NORMAL', 'CALIBRATION', 'MANUAL_MARKER', 'ARTIFACT']),
  startedAt: epochMs,
  triggerAt: epochMs.optional(),
  endedAt: epochMs,
  triggerReasons: z.array(z.string().min(1).max(60)).max(10),
  triggerMeasurements: z.record(z.string().max(60), finite).optional(),
  location: locationPointSchema.extend({
    quality: z.enum(['INTERPOLATED', 'NEAREST', 'UNUSABLE']),
    bracketGapMs: z.number().int().min(0).max(120_000),
  }).optional(),
  featureVersion: z.literal('features-v1'),
  features: featureVectorV1Schema,
}).strict();

export const rawObjectManifestSchema = z.object({
  objectId: z.string().uuid(),
  windowId: z.string().uuid(),
  byteSize: z.number().int().min(1).max(1_048_576),
  sha256,
  contentType: z.literal('application/json'),
  contentEncoding: z.literal('gzip'),
  formatVersion: z.literal(1),
}).strict();

const collectionMarkerSchema = z.object({
  markerId: z.string().uuid(), markedAt: epochMs,
  markerType: z.enum(['PASSENGER_ROAD_FEATURE', 'KNOWN_NORMAL_SECTION', 'HANDLING_ARTIFACT']),
  location: locationPointSchema.optional(),
}).strict();

const deviceSchema = z.object({
  uuid: z.string().uuid(), platform: z.enum(['android', 'ios']), model: z.string().max(120).optional(),
  osVersion: z.string().max(40).optional(), appVersion: z.string().min(1).max(40),
}).strict();

const qualitySchema = z.object({
  accelerometerSampleCount: z.number().int().min(0).max(20_000_000),
  gyroscopeSampleCount: z.number().int().min(0).max(20_000_000),
  effectiveAccelHz: finite.min(0).max(1_000), effectiveGyroHz: finite.min(0).max(1_000),
  accelMissingRatio: finite.min(0).max(1), gyroMissingRatio: finite.min(0).max(1),
  reliableFixCount: z.number().int().min(0).max(1_000_000), rejectedFixCount: z.number().int().min(0).max(1_000_000),
  meanAccuracyM: finite.min(0).max(1_000), mountStableRatio: finite.min(0).max(1),
  candidateCount: z.number().int().min(0).max(200), suppressedCandidateCount: z.number().int().min(0).max(10_000_000),
  normalWindowCount: z.number().int().min(0).max(120), reasons: z.array(z.string().min(1).max(100)).max(100),
}).strict();

export const collectionSessionV3Schema = z.object({
  schemaVersion: z.literal(3),
  sessionId: z.string().uuid(),
  device: deviceSchema,
  collection: z.object({
    mode: collectionModeSchema,
    vehicleClass: vehicleClassSchema,
    vehicleSubtype: z.string().min(1).max(60),
    vehicleMetadata: z.record(z.string().max(60), z.union([z.string().max(120), finite, z.boolean(), z.null()])),
    mountPosition: z.string().min(1).max(60),
    profileVersion: z.string().min(1).max(80),
    featureVersion: z.literal('features-v1'),
    triggerVersion: z.string().min(1).max(80),
    motionAlgorithmVersion: z.string().min(1).max(80),
    consentVersion: z.string().min(1).max(80),
  }).strict(),
  timing: z.object({
    startedAt: epochMs, endedAt: epochMs,
    movingDurationMs: z.number().int().min(0).max(172_800_000),
    stationaryDurationMs: z.number().int().min(0).max(172_800_000),
    sensorEpochOffsetMs: finite,
    estimatedClockDriftPpm: finite.min(-1_000_000).max(1_000_000),
  }).strict(),
  journey: z.object({
    acceptedDistanceM: finite.min(0).max(2_000_000),
    averageMovingSpeedKmh: finite.min(0).max(400),
    start: locationPointSchema,
    end: locationPointSchema,
  }).strict(),
  quality: qualitySchema,
  locationSamples: z.array(locationPointSchema).max(100_000),
  featureWindows: z.array(featureWindowV1Schema).max(320),
  rawObjects: z.array(rawObjectManifestSchema).max(320),
  markers: z.array(collectionMarkerSchema).max(500),
}).strict().superRefine((payload, ctx) => {
  const profile = SERVER_VEHICLE_PROFILES[payload.collection.vehicleClass];
  const checks: Array<[boolean, (string | number)[], string]> = [
    [profile.collectionEligible, ['collection', 'vehicleClass'], 'Vehicle class is collection-ineligible.'],
    [profile.profileVersion === payload.collection.profileVersion, ['collection', 'profileVersion'], 'Profile does not match vehicle class.'],
    [profile.triggerVersion === payload.collection.triggerVersion, ['collection', 'triggerVersion'], 'Trigger version does not match profile.'],
    [profile.subtypes.includes(payload.collection.vehicleSubtype), ['collection', 'vehicleSubtype'], 'Unsupported subtype for vehicle class.'],
    [profile.mountPositions.includes(payload.collection.mountPosition), ['collection', 'mountPosition'], 'Unsupported mount for vehicle class.'],
    [payload.timing.endedAt >= payload.timing.startedAt, ['timing', 'endedAt'], 'Session ends before it starts.'],
    [payload.collection.mode === 'CONTROLLED_RESEARCH' || payload.rawObjects.length === 0, ['rawObjects'], 'STANDARD sessions cannot contain raw objects.'],
  ];
  const requiredMetadata: Partial<Record<typeof payload.collection.vehicleClass, string[]>> = {
    CAR: ['vehicleAgeBand'],
    BIKE: ['powertrain'],
    AUTO_RICKSHAW: ['powertrain'],
    BUS: ['loadBand'],
    TRUCK: ['loadBand'],
  };
  for (const key of requiredMetadata[payload.collection.vehicleClass] ?? []) {
    checks.push([
      payload.collection.vehicleMetadata[key] !== undefined && payload.collection.vehicleMetadata[key] !== null && payload.collection.vehicleMetadata[key] !== '',
      ['collection', 'vehicleMetadata', key],
      `Required vehicle metadata is missing: ${key}.`,
    ]);
  }
  for (const [valid, path, message] of checks) {
    if (!valid) ctx.addIssue({ code: 'custom', path, message });
  }
  const windowIds = new Set(payload.featureWindows.map((window) => window.windowId));
  if (windowIds.size !== payload.featureWindows.length) {
    ctx.addIssue({ code: 'custom', path: ['featureWindows'], message: 'Window IDs must be unique.' });
  }
  const candidateCount = payload.featureWindows.filter((window) => window.kind === 'CANDIDATE').length;
  const normalCount = payload.featureWindows.filter((window) => window.kind === 'RANDOM_NORMAL').length;
  if (candidateCount !== payload.quality.candidateCount) {
    ctx.addIssue({ code: 'custom', path: ['quality', 'candidateCount'], message: 'Candidate count does not match feature windows.' });
  }
  if (normalCount !== payload.quality.normalWindowCount) {
    ctx.addIssue({ code: 'custom', path: ['quality', 'normalWindowCount'], message: 'Normal-window count does not match feature windows.' });
  }
  for (const [index, window] of payload.featureWindows.entries()) {
    if (window.kind === 'CANDIDATE' && window.triggerAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['featureWindows', index, 'triggerAt'], message: 'Candidate windows require a trigger timestamp.' });
    }
  }
  for (const [index, object] of payload.rawObjects.entries()) {
    if (!windowIds.has(object.windowId)) ctx.addIssue({ code: 'custom', path: ['rawObjects', index, 'windowId'], message: 'Raw object references an unknown window.' });
  }
  if (payload.collection.mode === 'STANDARD' && payload.markers.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['markers'], message: 'STANDARD sessions cannot contain research markers.' });
  }
  for (const [index, marker] of payload.markers.entries()) {
    if (marker.markedAt < payload.timing.startedAt || marker.markedAt > payload.timing.endedAt) {
      ctx.addIssue({ code: 'custom', path: ['markers', index, 'markedAt'], message: 'Marker is outside session time.' });
    }
  }
});

export const collectionInitSchema = z.object({
  sessionId: z.string().uuid(),
  device: deviceSchema,
  mode: collectionModeSchema,
  vehicleClass: vehicleClassSchema,
  vehicleSubtype: z.string().min(1).max(60),
  vehicleMetadata: z.record(z.string().max(60), z.union([z.string().max(120), finite, z.boolean(), z.null()])),
  mountPosition: z.string().min(1).max(60),
  profileVersion: z.string().min(1).max(80),
  featureVersion: z.literal('features-v1'),
  triggerVersion: z.string().min(1).max(80),
  motionAlgorithmVersion: z.string().min(1).max(80),
  consentVersion: z.string().min(1).max(80),
  startedAt: epochMs,
}).strict();

export type CollectionSessionV3 = z.infer<typeof collectionSessionV3Schema>;
export type CollectionInit = z.infer<typeof collectionInitSchema>;
