import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  devices,
  journeyRaw,
  journeys,
  roadEvents,
  roadSegments,
  segmentSnapshots,
} from '../db/schema.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { cellCenter, mergeRqi, segmentKeyFor } from '../lib/roadSegments.js';

/**
 * POST /user/mobile/traveldata — the mobile app's single end-of-journey
 * upload. Contract doc: docs/api-contracts/traveldata.md (schemaVersion 1).
 *
 * The app is unauthenticated by design; the device is identified by an
 * install-time UUID. Uploads are idempotent on journeyId so the app can
 * retry safely.
 */

const router = new Hono();

// ─── Contract (schemaVersion 1) ───────────────────────────────────────────────

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
  schemaVersion: z.literal(1),
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
  sensorWindows: z.array(z.record(z.unknown())).max(200_000).optional(),
});

export type TravelDataPayload = z.infer<typeof travelDataSchema>;

// Journeys arrive as one ~10 MB batch; allow headroom for verbose traces.
const MAX_BODY_BYTES = 15 * 1024 * 1024;

// ─── Handler ─────────────────────────────────────────────────────────────────

router.post(
  '/traveldata',
  rateLimitMiddleware,
  zValidator('json', travelDataSchema, (result, c) => {
    if (!result.success) {
      const first = result.error.issues[0];
      const where = first ? ` (${first.path.join('.')})` : '';
      return c.json({ ok: false, error: `${first?.message ?? 'Invalid payload.'}${where}` }, 400);
    }
  }),
  async (c) => {
    const bodyLength = Number(c.req.header('content-length') ?? 0);
    if (!bodyLength || bodyLength > MAX_BODY_BYTES) {
      return c.json({ ok: false, error: 'Payload too large.' }, 413);
    }

    const payload = c.req.valid('json');
    const { device, journey } = payload;

    if (journey.endedAt < journey.startedAt) {
      return c.json({ ok: false, error: 'Journey ends before it starts.' }, 400);
    }

    try {
      // ── Idempotency: same journeyId → acknowledge without re-ingesting ────
      const existing = await db
        .select({ id: journeys.id })
        .from(journeys)
        .where(eq(journeys.id, journey.id))
        .limit(1);
      if (existing.length > 0) {
        return c.json({ ok: true, duplicate: true, journeyId: journey.id });
      }

      // ── Device upsert ──────────────────────────────────────────────────────
      const [deviceRow] = await db
        .insert(devices)
        .values({
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
            model: device.model ?? sql`${devices.model}`,
            appVersion: device.appVersion ?? sql`${devices.appVersion}`,
            journeyCount: sql`${devices.journeyCount} + 1`,
          },
        })
        .returning({ id: devices.id });

      // ── Journey + raw payload ──────────────────────────────────────────────
      await db.insert(journeys).values({
        id: journey.id,
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
      });

      await db.insert(journeyRaw).values({ journeyId: journey.id, payload });

      // ── Events (segment-keyed for map queries) ────────────────────────────
      if (payload.events.length > 0) {
        await db.insert(roadEvents).values(
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
            segmentKey: segmentKeyFor(e.lat, e.lon),
          })),
        );
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

        const [current] = await db
          .select()
          .from(roadSegments)
          .where(eq(roadSegments.segmentKey, key))
          .limit(1);

        let rqi: number;
        let samples: number;
        if (current) {
          rqi = mergeRqi(current.currentRqi, current.sampleCount, seg.rqiScore);
          samples = current.sampleCount + 1;
          await db
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
          await db
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
        await db
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

      return c.json({
        ok: true,
        duplicate: false,
        journeyId: journey.id,
        segmentsProcessed: payload.segments.length,
        eventsStored: payload.events.length,
      });
    } catch (err) {
      console.error('[traveldata] ingestion error:', err);
      return c.json({ ok: false, error: 'Something went wrong storing the journey.' }, 500);
    }
  },
);

export { router as travelDataRouter };
