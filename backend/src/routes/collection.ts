import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  collectionRawObjects,
  collectionMarkers,
  collectionSessions,
  collectionWindows,
  devices,
  researchDevices,
} from '../db/schema.js';
import { resolveUserSession } from '../lib/auth.js';
import {
  collectionInitSchema,
  collectionSessionV3Schema,
  rawObjectManifestSchema,
  vehicleClassSchema,
} from '../lib/collectionSchema.js';
import { evaluateCollectionQuality } from '../lib/collectionQuality.js';
import { isInIndia } from '../lib/india.js';
import { collectionObjectStorageConfigured, presignRawUpload, verifyRawObject } from '../lib/objectStorage.js';
import { SERVER_VEHICLE_PROFILES, serverProfileFor } from '../lib/vehicleProfiles.js';
import { collectionRateLimitMiddleware } from '../middleware/rateLimit.js';

const router = new Hono();

router.use('*', bodyLimit({
  maxSize: 8 * 1024 * 1024,
  onError: (c) => c.json({ ok: false, error: 'Collection request body exceeds 8 MiB.' }, 413),
}));
router.use('*', collectionRateLimitMiddleware, async (c, next) => {
  const auth = await resolveUserSession(c.req.header('authorization'));
  if (!auth) return c.json({ ok: false, error: 'Invalid or expired session.' }, 401);
  c.set('userId' as never, auth.user.id as never);
  await next();
});

router.get(
  '/collection/config',
  zValidator('query', z.object({ vehicleClass: vehicleClassSchema, deviceUuid: z.string().uuid().optional() })),
  async (c) => {
    const { vehicleClass, deviceUuid } = c.req.valid('query');
    const profile = serverProfileFor(vehicleClass);
    const [research] = deviceUuid
      ? await db.select().from(researchDevices).where(eq(researchDevices.deviceUuid, deviceUuid)).limit(1)
      : [];
    const controlledAuthorized = Boolean(research?.status === 'AUTHORIZED'
      && !research.revokedAt && (!research.expiresAt || research.expiresAt > new Date())
      && Array.isArray(research.permittedVehicleClasses) && research.permittedVehicleClasses.includes(vehicleClass));
    return c.json({
      ok: true,
      schemaVersion: 3,
      profile,
      supportedModes: collectionObjectStorageConfigured() && controlledAuthorized ? ['STANDARD', 'CONTROLLED_RESEARCH'] : ['STANDARD'],
      controlledAuthorized,
      consentVersion: 'collection-consent-v1',
      minimumAppVersion: process.env.COLLECTION_MIN_APP_VERSION ?? '2.0.0',
      limits: { maxFeatureWindows: 320, maxRawObjects: 320, maxRawObjectBytes: 1_048_576 },
    });
  },
);

router.post(
  '/collection/sessions/init',
  zValidator('json', collectionInitSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId' as never) as number;
    const profile = SERVER_VEHICLE_PROFILES[input.vehicleClass];
    const mismatch = validateInitAgainstProfile(input, profile);
    if (mismatch) return c.json({ ok: false, error: mismatch }, 400);

    const [existing] = await db.select().from(collectionSessions).where(eq(collectionSessions.id, input.sessionId)).limit(1);
    if (existing) {
      if (existing.userId !== userId) return c.json({ ok: false, error: 'Collection session belongs to another account.' }, 409);
      if (existing.vehicleClass !== input.vehicleClass || existing.profileVersion !== input.profileVersion || existing.mode !== input.mode) {
        return c.json({ ok: false, error: 'Collection session identity does not match its original initialization.' }, 409);
      }
      return c.json({ ok: true, status: 'duplicate', sessionId: input.sessionId, uploadState: existing.uploadState });
    }

    const [ownedDevice] = await db.select().from(devices).where(eq(devices.deviceUuid, input.device.uuid)).limit(1);
    if (ownedDevice?.userId && ownedDevice.userId !== userId) return c.json({ ok: false, error: 'Device belongs to another account.' }, 409);

    let authorizationSource = 'STANDARD_ACCOUNT';
    if (input.mode === 'CONTROLLED_RESEARCH') {
      const [research] = await db.select().from(researchDevices).where(eq(researchDevices.deviceUuid, input.device.uuid)).limit(1);
      const permitted = research?.status === 'AUTHORIZED'
        && !research.revokedAt
        && (!research.expiresAt || research.expiresAt > new Date())
        && Array.isArray(research.permittedVehicleClasses)
        && research.permittedVehicleClasses.includes(input.vehicleClass);
      if (!permitted) return c.json({ ok: false, error: 'Device is not authorized for controlled collection in this vehicle class.' }, 403);
      if (!collectionObjectStorageConfigured()) return c.json({ ok: false, error: 'Controlled collection storage is unavailable.' }, 503);
      authorizationSource = 'RESEARCH_DEVICE';
    }

    const [device] = await db.insert(devices).values({
      userId, deviceUuid: input.device.uuid, platform: input.device.platform, model: input.device.model ?? null,
      appVersion: input.device.appVersion, defaultVehicleType: input.vehicleClass,
    }).onConflictDoUpdate({
      target: devices.deviceUuid,
      set: { userId, lastSeenAt: sql`now()`, model: input.device.model ?? sql`${devices.model}`, appVersion: input.device.appVersion },
    }).returning({ id: devices.id });

    await db.insert(collectionSessions).values({
      id: input.sessionId, userId, deviceId: device.id, mode: input.mode, vehicleClass: input.vehicleClass,
      vehicleSubtype: input.vehicleSubtype, vehicleMetadata: input.vehicleMetadata, mountPosition: input.mountPosition,
      profileVersion: input.profileVersion, featureVersion: input.featureVersion, triggerVersion: input.triggerVersion,
      motionAlgorithmVersion: input.motionAlgorithmVersion, consentVersion: input.consentVersion,
      authorizationSource, startedAt: new Date(input.startedAt),
    });
    return c.json({ ok: true, status: 'initialized', sessionId: input.sessionId, uploadState: 'UPLOADING' }, 201);
  },
);

router.post(
  '/collection/sessions/:sessionId/raw-uploads',
  zValidator('param', z.object({ sessionId: z.string().uuid() })),
  zValidator('json', z.object({ objects: z.array(rawObjectManifestSchema).min(1).max(320) }).strict()),
  async (c) => {
    const { sessionId } = c.req.valid('param');
    const { objects } = c.req.valid('json');
    const userId = c.get('userId' as never) as number;
    const [session] = await db.select().from(collectionSessions).where(eq(collectionSessions.id, sessionId)).limit(1);
    if (!session || session.userId !== userId) return c.json({ ok: false, error: 'Collection session not found.' }, 404);
    if (session.mode !== 'CONTROLLED_RESEARCH' || session.authorizationSource !== 'RESEARCH_DEVICE') {
      return c.json({ ok: false, error: 'Raw uploads require an authorized controlled session.' }, 403);
    }
    if (session.uploadState !== 'UPLOADING') return c.json({ ok: false, error: 'Collection session is not accepting uploads.' }, 409);

    const existing = objects.length > 0
      ? await db.select().from(collectionRawObjects).where(inArray(collectionRawObjects.id, objects.map((object) => object.objectId)))
      : [];
    const byId = new Map(existing.map((object) => [object.id, object]));
    const uploads = [];
    for (const object of objects) {
      const stored = byId.get(object.objectId);
      if (stored && (stored.sessionId !== sessionId || stored.windowId !== object.windowId || stored.expectedSize !== object.byteSize || stored.sha256 !== object.sha256)) {
        return c.json({ ok: false, error: `Raw object ${object.objectId} conflicts with its original manifest.` }, 409);
      }
      const signed = await presignRawUpload({
        vehicleClass: session.vehicleClass as keyof typeof SERVER_VEHICLE_PROFILES,
        profileVersion: session.profileVersion,
        sessionId,
        objectId: object.objectId,
        byteSize: object.byteSize,
        sha256: object.sha256,
      });
      if (!stored) {
        await db.insert(collectionRawObjects).values({
          id: object.objectId, sessionId, windowId: object.windowId, objectKey: signed.objectKey,
          contentType: object.contentType, contentEncoding: object.contentEncoding,
          expectedSize: object.byteSize, sha256: object.sha256,
        });
      }
      uploads.push({ objectId: object.objectId, url: signed.url, expiresInS: signed.expiresInS, headers: signed.headers });
    }
    return c.json({ ok: true, sessionId, uploads });
  },
);

router.post(
  '/collection/sessions/:sessionId/complete',
  zValidator('param', z.object({ sessionId: z.string().uuid() })),
  zValidator('json', collectionSessionV3Schema),
  async (c) => {
    const { sessionId } = c.req.valid('param');
    const payload = c.req.valid('json');
    const userId = c.get('userId' as never) as number;
    if (payload.sessionId !== sessionId) return c.json({ ok: false, error: 'Path and payload session IDs differ.' }, 400);
    if (!isInIndia(payload.journey.start.lat, payload.journey.start.lon) && !isInIndia(payload.journey.end.lat, payload.journey.end.lon)) {
      return c.json({ ok: false, error: 'BetterRoads only covers roads in India.' }, 400);
    }
    const [session] = await db.select().from(collectionSessions).where(eq(collectionSessions.id, sessionId)).limit(1);
    if (!session || session.userId !== userId) return c.json({ ok: false, error: 'Collection session not found.' }, 404);
    if (session.uploadState === 'COMPLETE') {
      return c.json({
        ok: true, status: 'duplicate', sessionId,
        originalStatus: session.qualityStatus?.toLowerCase(), quarantineReasons: session.qualityReasons,
      });
    }
    if (session.uploadState === 'CANCELLED') return c.json({ ok: false, error: 'Collection session was cancelled.' }, 409);
    if (!matchesInitializedSession(session, payload)) return c.json({ ok: false, error: 'Final manifest differs from initialized collection identity.' }, 409);

    const quality = evaluateCollectionQuality(payload);
    if (quality.hardFailure) {
      await db.update(collectionRawObjects).set({ state: 'DELETE_PENDING' }).where(eq(collectionRawObjects.sessionId, sessionId));
      await db.update(collectionSessions).set({ uploadState: 'CANCELLED', cancelledAt: sql`now()` }).where(eq(collectionSessions.id, sessionId));
      return c.json({ ok: false, status: 'rejected', error: quality.hardFailure }, 422);
    }

    if (payload.collection.mode === 'CONTROLLED_RESEARCH') {
      const rows = await db.select().from(collectionRawObjects).where(eq(collectionRawObjects.sessionId, sessionId));
      if (rows.length !== payload.rawObjects.length) return c.json({ ok: false, error: 'Not all raw objects were initialized.' }, 409);
      const manifestById = new Map(payload.rawObjects.map((object) => [object.objectId, object]));
      for (const row of rows) {
        const manifest = manifestById.get(row.id);
        if (!manifest || manifest.windowId !== row.windowId || manifest.sha256 !== row.sha256 || manifest.byteSize !== row.expectedSize) {
          return c.json({ ok: false, error: 'Raw object manifest does not match initialized objects.' }, 409);
        }
        let observedSize: number;
        try { observedSize = await verifyRawObject(row.objectKey, row.expectedSize, row.sha256); }
        catch (error) { return c.json({ ok: false, error: error instanceof Error ? error.message : 'Raw object verification failed.' }, 422); }
        await db.update(collectionRawObjects).set({ state: 'VERIFIED', observedSize, uploadedAt: sql`now()`, verifiedAt: sql`now()` }).where(eq(collectionRawObjects.id, row.id));
      }
    }

    await db.transaction(async (tx) => {
      if (payload.featureWindows.length > 0) {
        await tx.insert(collectionWindows).values(payload.featureWindows.map((window) => ({
          id: window.windowId, sessionId, encounterId: window.encounterId, kind: window.kind,
          startedAt: new Date(window.startedAt), triggerAt: window.triggerAt ? new Date(window.triggerAt) : null,
          endedAt: new Date(window.endedAt), triggerReasons: window.triggerReasons,
          triggerMeasurements: window.triggerMeasurements ?? {},
          lat: window.location?.lat ?? null, lon: window.location?.lon ?? null, accuracyM: window.location?.accuracyM ?? null,
          locationQuality: window.location?.quality ?? null, bracketGapMs: window.location?.bracketGapMs ?? null,
          featureVersion: window.featureVersion, features: window.features,
        })));
      }
      if (payload.markers.length > 0) {
        await tx.insert(collectionMarkers).values(payload.markers.map((marker) => ({
          id: marker.markerId, sessionId, markedAt: new Date(marker.markedAt), markerType: marker.markerType,
          matchDiagnostics: marker.location ? { observedLocation: marker.location } : {},
        })));
      }
      await tx.update(collectionSessions).set({
        uploadState: 'COMPLETE', qualityStatus: quality.status, qualityReasons: quality.reasons,
        qualityDiagnostics: quality.diagnostics, endedAt: new Date(payload.timing.endedAt),
        movingDurationMs: payload.timing.movingDurationMs, stationaryDurationMs: payload.timing.stationaryDurationMs,
        acceptedDistanceM: payload.journey.acceptedDistanceM, averageMovingSpeedKmh: payload.journey.averageMovingSpeedKmh,
        startLat: payload.journey.start.lat, startLon: payload.journey.start.lon,
        endLat: payload.journey.end.lat, endLon: payload.journey.end.lon,
        timingDiagnostics: {
          sensorEpochOffsetMs: payload.timing.sensorEpochOffsetMs,
          estimatedClockDriftPpm: payload.timing.estimatedClockDriftPpm,
        },
        sensorQuality: payload.quality, locationSamples: payload.locationSamples, completedAt: sql`now()`,
      }).where(and(eq(collectionSessions.id, sessionId), eq(collectionSessions.userId, userId)));
    });
    return c.json({
      ok: true, status: quality.status === 'RECEIVED' ? 'received' : 'quarantined', sessionId,
      ...(quality.reasons.length > 0 ? { quarantineReasons: quality.reasons } : {}),
    });
  },
);

router.post(
  '/collection/sessions/:sessionId/cancel',
  zValidator('param', z.object({ sessionId: z.string().uuid() })),
  async (c) => {
    const { sessionId } = c.req.valid('param');
    const userId = c.get('userId' as never) as number;
    const [session] = await db.select().from(collectionSessions).where(eq(collectionSessions.id, sessionId)).limit(1);
    if (!session || session.userId !== userId) return c.json({ ok: false, error: 'Collection session not found.' }, 404);
    if (session.uploadState === 'COMPLETE') return c.json({ ok: false, error: 'Completed collection cannot be cancelled through the upload endpoint.' }, 409);
    await db.transaction(async (tx) => {
      await tx.update(collectionRawObjects).set({ state: 'DELETE_PENDING' }).where(eq(collectionRawObjects.sessionId, sessionId));
      await tx.update(collectionSessions).set({ uploadState: 'CANCELLED', cancelledAt: sql`now()` }).where(eq(collectionSessions.id, sessionId));
    });
    return c.json({ ok: true, status: 'cancelled', sessionId });
  },
);

function validateInitAgainstProfile(input: z.infer<typeof collectionInitSchema>, profile: typeof SERVER_VEHICLE_PROFILES[keyof typeof SERVER_VEHICLE_PROFILES]): string | null {
  if (!profile.collectionEligible) return 'Vehicle class is not eligible for sensor collection.';
  if (input.profileVersion !== profile.profileVersion || input.featureVersion !== profile.featureVersion || input.triggerVersion !== profile.triggerVersion) {
    return 'Collection versions do not match the selected vehicle profile.';
  }
  if (!profile.subtypes.includes(input.vehicleSubtype)) return 'Vehicle subtype does not match the selected class.';
  if (!profile.mountPositions.includes(input.mountPosition)) return 'Mount position does not match the selected class.';
  const required = input.vehicleClass === 'CAR' ? ['vehicleAgeBand']
    : input.vehicleClass === 'BIKE' || input.vehicleClass === 'AUTO_RICKSHAW' ? ['powertrain']
      : input.vehicleClass === 'BUS' || input.vehicleClass === 'TRUCK' ? ['loadBand'] : [];
  for (const key of required) if (input.vehicleMetadata[key] === undefined || input.vehicleMetadata[key] === null || input.vehicleMetadata[key] === '') return `Required vehicle metadata is missing: ${key}.`;
  return null;
}

function matchesInitializedSession(session: typeof collectionSessions.$inferSelect, payload: z.infer<typeof collectionSessionV3Schema>): boolean {
  return session.mode === payload.collection.mode
    && session.vehicleClass === payload.collection.vehicleClass
    && session.vehicleSubtype === payload.collection.vehicleSubtype
    && session.mountPosition === payload.collection.mountPosition
    && session.profileVersion === payload.collection.profileVersion
    && session.featureVersion === payload.collection.featureVersion
    && session.triggerVersion === payload.collection.triggerVersion
    && session.motionAlgorithmVersion === payload.collection.motionAlgorithmVersion
    && session.consentVersion === payload.collection.consentVersion;
}

export { router as collectionRouter };
