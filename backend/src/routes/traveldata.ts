import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, between, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  devices,
  journeyRaw,
  journeys,
  potholeHotspots,
  roadEvents,
  roadSegments,
  segmentSnapshots,
} from '../db/schema.js';
import { ingestRateLimitMiddleware } from '../middleware/rateLimit.js';
import { cellCenter, mergeRqi, segmentKeyFor } from '../lib/roadSegments.js';
import { distanceMetres, recoveredEventAccuracy } from '../lib/potholeHotspots.js';
import { isInIndia } from '../lib/india.js';
import { resolveUserSession } from '../lib/auth.js';
import { evaluateJourneyQuality } from '../lib/journeyQuality.js';

/**
 * POST /user/mobile/traveldata — the mobile app's single end-of-journey
 * upload. Contract doc: docs/api-contracts/traveldata.md (schemaVersion 1).
 *
 * A valid mobile bearer session is required. The device UUID remains the
 * installation identity, while account ownership comes only from the session.
 */

const router = new Hono();

// ─── Backward-compatible contract (schemaVersion 1 | 2) ─────────────────────

const VEHICLE_TYPES = ['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK', 'OTHER'] as const;
const EVENT_TYPES = ['POTHOLE', 'BUMP', 'SPEED_BREAKER', 'SWERVE', 'MANUAL_REPORT'] as const;

const latSchema = z.number().min(-90).max(90);
const lonSchema = z.number().min(-180).max(180);
/** Epoch milliseconds, sane range: 2020-01-01 … now + 1 day (clock skew). */
const epochMs = z
  .number()
  .int()
  .min(1_577_836_800_000)
  .refine((t) => t <= Date.now() + 86_400_000, { message: 'Timestamp is in the future.' });

const segmentSchema = z.object({
  segmentIndex: z.number().int().min(0),
  startLat: latSchema,
  startLon: lonSchema,
  endLat: latSchema,
  endLon: lonSchema,
  lengthM: z.number().min(0).max(10_000),
  rqiScore: z.number().min(0).max(100),
  eventCount: z.number().int().min(0),
  avgRms: z.number().min(0),
});

const eventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  severity: z.number().min(0).max(1),
  timestamp: epochMs,
  lat: latSchema,
  lon: lonSchema,
  altitudeM: z.number().optional(),
  speedKmh: z.number().min(0).max(400).optional(),
  accelX: z.number().optional(),
  accelY: z.number().optional(),
  accelZ: z.number().optional(),
  gyroZ: z.number().optional(),
  heading: z.number().optional(),
});

const travelDataSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  device: z.object({
    /** Install-time UUID minted by the app (NOT a MAC address). */
    uuid: z.string().uuid(),
    platform: z.enum(['android', 'ios']).default('android'),
    model: z.string().max(120).optional(),
    appVersion: z.string().max(40).optional(),
  }),
  journey: z.object({
    id: z.string().uuid(),
    startedAt: epochMs,
    endedAt: epochMs,
    distanceM: z.number().min(0).max(2_000_000),
    durationS: z.number().int().min(0).max(172_800),
    avgSpeedKmh: z.number().min(0).max(400),
    vehicleType: z.enum(VEHICLE_TYPES),
    phoneMountPosition: z.string().max(40).optional(),
    baseFloorRms: z.number().min(0).optional(),
    rqiScore: z.number().min(0).max(100),
    startLat: latSchema,
    startLon: lonSchema,
    endLat: latSchema,
    endLon: lonSchema,
    movingDurationS: z.number().int().min(0).max(172_800).optional(),
    stationaryDurationS: z.number().int().min(0).max(172_800).optional(),
    detectionAlgorithmVersion: z.string().min(1).max(80).optional(),
    fixQuality: z.object({
      reliableFixCount: z.number().int().min(0),
      rejectedFixCount: z.number().int().min(0),
      meanAccuracyM: z.number().min(0),
      bestAccuracyM: z.number().min(0),
      worstAccuracyM: z.number().min(0),
    }).optional(),
  }),
  /** ~300 m journey segments as scored on-device. */
  segments: z.array(segmentSchema).max(10_000),
  events: z.array(eventSchema).max(50_000),
  /**
   * Optional downsampled GPS trace [[lat, lon, epochMs], …] and raw sensor
   * windows — stored verbatim in journey_raw for future reprocessing by the
   * AI engine; not interpreted by this endpoint.
   */
  path: z.array(z.tuple([latSchema, lonSchema, epochMs])).max(100_000).optional(),
  locationSamples: z.array(z.object({
    lat: latSchema,
    lon: lonSchema,
    timestamp: epochMs,
    accuracyM: z.number().min(0).max(1_000),
    speedKmh: z.number().min(0).max(400).optional(),
  })).max(100_000).optional(),
  sensorWindows: z.array(z.record(z.unknown())).max(200_000).optional(),
}).superRefine((payload, ctx) => {
  if (payload.schemaVersion !== 2) return;
  for (const key of ['movingDurationS', 'stationaryDurationS', 'detectionAlgorithmVersion', 'fixQuality'] as const) {
    if (payload.journey[key] === undefined) ctx.addIssue({ code: 'custom', path: ['journey', key], message: `Required for schemaVersion 2.` });
  }
  if (!payload.locationSamples) ctx.addIssue({ code: 'custom', path: ['locationSamples'], message: 'Required for schemaVersion 2.' });
});

export type TravelDataPayload = z.infer<typeof travelDataSchema>;

// Journeys arrive as one ~10 MB batch; allow headroom for verbose traces.
const MAX_BODY_BYTES = 15 * 1024 * 1024;

// ─── Handler ─────────────────────────────────────────────────────────────────

router.post(
  '/traveldata',
  ingestRateLimitMiddleware,
  async (c, next) => {
    const auth = await resolveUserSession(c.req.header('authorization'));
    if (!auth) return c.json({ ok: false, error: 'Invalid or expired session.' }, 401);
    c.set('userId' as never, auth.user.id as never);
    await next();
  },
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ ok: false, error: 'Payload too large.' }, 413),
  }),
  zValidator('json', travelDataSchema, (result, c) => {
    if (!result.success) {
      const first = result.error.issues[0];
      const where = first ? ` (${first.path.join('.')})` : '';
      return c.json({ ok: false, error: `${first?.message ?? 'Invalid payload.'}${where}` }, 400);
    }
  }),
  async (c) => {
    const payload = c.req.valid('json');
    const { device, journey } = payload;
    const userId = c.get('userId' as never) as number;

    if (journey.endedAt < journey.startedAt) {
      return c.json({ ok: false, error: 'Journey ends before it starts.' }, 400);
    }

    // India-only product: a journey that never touches India is rejected with
    // a terminal 400 so the app drops it from its retry queue.
    if (
      !isInIndia(journey.startLat, journey.startLon) &&
      !isInIndia(journey.endLat, journey.endLon)
    ) {
      return c.json({ ok: false, error: 'BetterRoads only covers roads in India.' }, 400);
    }

    try {
      // ── Idempotency: same journeyId → acknowledge without re-ingesting ────
      const existing = await db
        .select({ id: journeys.id, userId: journeys.userId, acceptedAt: journeys.acceptedAt, qualityStatus: journeys.qualityStatus, qualityReasons: journeys.qualityReasons })
        .from(journeys)
        .where(eq(journeys.id, journey.id))
        .limit(1);
      if (existing.length > 0) {
        if (existing[0].userId !== userId) {
          return c.json({ ok: false, error: 'Journey ID belongs to another account.' }, 409);
        }
        if (existing[0].qualityStatus === 'QUARANTINED') {
          return c.json({ ok: true, status: 'quarantined', duplicate: true, journeyId: journey.id, quarantineReasons: existing[0].qualityReasons });
        }
        if (!existing[0].acceptedAt) {
          return c.json({ ok: false, error: 'A previous ingestion of this journey did not complete. Contact support.' }, 409);
        }
        return c.json({ ok: true, status: 'duplicate', duplicate: true, journeyId: journey.id });
      }

      const [ownedDevice] = await db.select({ userId: devices.userId }).from(devices).where(eq(devices.deviceUuid, device.uuid)).limit(1);
      if (ownedDevice?.userId && ownedDevice.userId !== userId) {
        return c.json({ ok: false, error: 'This device is linked to another account.' }, 409);
      }

      const quality = evaluateJourneyQuality(payload);
      const hardFailure = quality.reasons.find((reason) =>
        reason === 'IMPOSSIBLE_LOCATION_JUMP' || reason === 'LOCATION_TIMESTAMPS_OUT_OF_ORDER');
      if (hardFailure) {
        return c.json({ ok: false, status: 'rejected', error: `Impossible journey telemetry: ${hardFailure}.` }, 422);
      }
      const result = await db.transaction(async (tx) => {

      // ── Device upsert ──────────────────────────────────────────────────────
      const [deviceRow] = await tx
        .insert(devices)
        .values({
          userId,
          deviceUuid: device.uuid,
          platform: device.platform,
          model: device.model ?? null,
          appVersion: device.appVersion ?? null,
          defaultVehicleType: journey.vehicleType,
          journeyCount: 1,
        })
        .onConflictDoUpdate({
          target: devices.deviceUuid,
          set: {
            lastSeenAt: sql`now()`,
            userId,
            model: device.model ?? sql`${devices.model}`,
            appVersion: device.appVersion ?? sql`${devices.appVersion}`,
            journeyCount: sql`${devices.journeyCount} + 1`,
          },
        })
        .returning({ id: devices.id });

      // ── Journey + raw payload ──────────────────────────────────────────────
      await tx.insert(journeys).values({
        id: journey.id,
        userId,
        deviceId: deviceRow.id,
        startedAt: new Date(journey.startedAt),
        endedAt: new Date(journey.endedAt),
        distanceM: journey.distanceM,
        durationS: journey.durationS,
        avgSpeedKmh: journey.avgSpeedKmh,
        vehicleType: journey.vehicleType,
        phoneMountPosition: journey.phoneMountPosition ?? null,
        baseFloorRms: journey.baseFloorRms ?? null,
        rqiScore: journey.rqiScore,
        eventCount: payload.events.length,
        startLat: journey.startLat,
        startLon: journey.startLon,
        endLat: journey.endLat,
        endLon: journey.endLon,
        schemaVersion: payload.schemaVersion,
        qualityStatus: quality.status,
        qualityReasons: quality.reasons,
        qualityDiagnostics: quality.diagnostics,
        detectionAlgorithmVersion: journey.detectionAlgorithmVersion ?? null,
        movingDurationS: journey.movingDurationS ?? null,
        stationaryDurationS: journey.stationaryDurationS ?? null,
      });

      await tx.insert(journeyRaw).values({ journeyId: journey.id, payload });

      if (quality.status === 'QUARANTINED') {
        return {
          ok: true,
          status: 'quarantined' as const,
          duplicate: false,
          journeyId: journey.id,
          quarantineReasons: quality.reasons,
          segmentsProcessed: 0,
          eventsStored: 0,
        };
      }

      // ── Events (segment-keyed for map queries) ────────────────────────────
      if (payload.events.length > 0) {
        const eventMetadata = new Map<string, { accuracyM: number | null; locationQuality: string | null; potholeHotspotId: string | null }>();
        for (const event of payload.events) {
          const recovered = recoveredEventAccuracy(event, payload.locationSamples ?? []);
          let potholeHotspotId: string | null = null;
          if (event.type === 'POTHOLE') {
            const key = segmentKeyFor(event.lat, event.lon);
            const latDelta = 20 / 110_540;
            const lonDelta = 20 / (111_320 * Math.cos(event.lat * Math.PI / 180));
            const candidates = await tx.select().from(potholeHotspots).where(and(
              between(potholeHotspots.centerLat, event.lat - latDelta, event.lat + latDelta),
              between(potholeHotspots.centerLon, event.lon - lonDelta, event.lon + lonDelta),
            ));
            const nearest = candidates
              .map((hotspot) => ({ hotspot, distance: distanceMetres(event, { lat: hotspot.centerLat, lon: hotspot.centerLon }) }))
              .filter(({ distance }) => distance <= 20)
              .sort((a, b) => a.distance - b.distance)[0]?.hotspot;
            potholeHotspotId = nearest?.id ?? `ph:${event.id}`;
            if (nearest) {
              await tx.update(potholeHotspots).set({ lastDetectedAt: new Date(event.timestamp) }).where(eq(potholeHotspots.id, nearest.id));
            } else {
              await tx.insert(potholeHotspots).values({ id: potholeHotspotId, centerLat: event.lat, centerLon: event.lon, segmentKey: key, firstDetectedAt: new Date(event.timestamp), lastDetectedAt: new Date(event.timestamp) });
            }
          }
          eventMetadata.set(event.id, { accuracyM: recovered?.accuracyM ?? null, locationQuality: recovered ? 'GPS_SAMPLE_RECOVERED' : null, potholeHotspotId });
        }
        await tx.insert(roadEvents).values(
          payload.events.map((e) => ({
            id: e.id,
            journeyId: journey.id,
            type: e.type,
            severity: e.severity,
            occurredAt: new Date(e.timestamp),
            lat: e.lat,
            lon: e.lon,
            altitudeM: e.altitudeM ?? null,
            speedKmh: e.speedKmh ?? null,
            accelX: e.accelX ?? null,
            accelY: e.accelY ?? null,
            accelZ: e.accelZ ?? null,
            gyroZ: e.gyroZ ?? null,
            heading: e.heading ?? null,
            accuracyM: eventMetadata.get(e.id)?.accuracyM ?? null,
            locationQuality: eventMetadata.get(e.id)?.locationQuality ?? null,
            potholeHotspotId: eventMetadata.get(e.id)?.potholeHotspotId ?? null,
            segmentKey: segmentKeyFor(e.lat, e.lon),
          })),
          // Client-minted IDs: a replayed batch (or one that half-succeeded
          // before a crash) must not 500 the whole upload.
        ).onConflictDoNothing();
      }

      // ── Segment aggregation + daily snapshot (timeline source) ────────────
      // Naive v1 done inline; the AI engine will take this over asynchronously.
      const day = new Date(journey.endedAt).toISOString().slice(0, 10);
      const eventsPerKey = new Map<string, number>();
      for (const e of payload.events) {
        const k = segmentKeyFor(e.lat, e.lon);
        eventsPerKey.set(k, (eventsPerKey.get(k) ?? 0) + 1);
      }

      for (const seg of payload.segments) {
        const midLat = (seg.startLat + seg.endLat) / 2;
        const midLon = (seg.startLon + seg.endLon) / 2;
        const key = segmentKeyFor(midLat, midLon);
        const segEvents = eventsPerKey.get(key) ?? 0;

        const [current] = await tx
          .select()
          .from(roadSegments)
          .where(eq(roadSegments.segmentKey, key))
          .limit(1);

        let rqi: number;
        let samples: number;
        if (current) {
          rqi = mergeRqi(current.currentRqi, current.sampleCount, seg.rqiScore);
          samples = current.sampleCount + 1;
          await tx
            .update(roadSegments)
            .set({
              currentRqi: rqi,
              sampleCount: samples,
              eventCount: current.eventCount + segEvents,
              lastUpdatedAt: sql`now()`,
            })
            .where(eq(roadSegments.segmentKey, key));
        } else {
          rqi = seg.rqiScore;
          samples = 1;
          const center = cellCenter(key);
          await tx
            .insert(roadSegments)
            .values({
              segmentKey: key,
              centerLat: center.lat,
              centerLon: center.lon,
              geometry: [
                [seg.startLat, seg.startLon],
                [seg.endLat, seg.endLon],
              ],
              currentRqi: rqi,
              sampleCount: samples,
              eventCount: segEvents,
            })
            .onConflictDoNothing();
        }

        // Daily snapshot: upsert the cumulative state for (segment, day).
        await tx
          .insert(segmentSnapshots)
          .values({ segmentKey: key, day, rqi, sampleCount: samples, eventCount: segEvents })
          .onConflictDoUpdate({
            target: [segmentSnapshots.segmentKey, segmentSnapshots.day],
            set: {
              rqi,
              sampleCount: samples,
              eventCount: sql`${segmentSnapshots.eventCount} + ${segEvents}`,
            },
          });
      }

      // A contribution becomes rankable only after the complete validated
      // payload has been stored and its road segments have been processed.
      await tx.update(journeys).set({ acceptedAt: sql`now()` }).where(eq(journeys.id, journey.id));

      return {
        ok: true,
        status: 'accepted' as const,
        duplicate: false,
        journeyId: journey.id,
        segmentsProcessed: payload.segments.length,
        eventsStored: payload.events.length,
      };
      });
      return c.json(result);
    } catch (err) {
      console.error('[traveldata] ingestion error:', err);
      return c.json({ ok: false, error: 'Something went wrong storing the journey.' }, 500);
    }
  },
);

export { router as travelDataRouter };
