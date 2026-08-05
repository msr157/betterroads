import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { devices, journeys, waitlistSignups } from '../db/schema.js';

/**
 * Internal admin API — read-only stats + tables for the BetterRoads
 * admin dashboard (dashboard/). Protected by a single shared bearer
 * token (ADMIN_TOKEN env var); if the var is unset the whole surface
 * is disabled (503) so a forgotten deploy can never expose data.
 */

const router = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────

/**
 * Constant-time token comparison. Both sides are hashed to a fixed length
 * first so `timingSafeEqual` never throws on length mismatch and the
 * comparison leaks nothing about the token's length or contents.
 */
function tokensMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

router.use('*', async (c, next) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return c.json({ ok: false, error: 'admin API disabled' }, 503);
  }

  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token || !tokensMatch(token, expected)) {
    return c.json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  await next();
});

// ─── Shared pagination query schema ───────────────────────────────────────────

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const countAsInt = sql<number>`cast(count(*) as int)`;

// ─── GET /overview ────────────────────────────────────────────────────────────
// Headline counts + last-14-days daily journey/event series for the
// overview screen's stat tiles and sparkline.

router.get('/overview', async (c) => {
  try {
    const [countRows, dailyRows] = await Promise.all([
      db.execute(sql`
        SELECT (SELECT count(*) FROM waitlist_signups)::int AS "signups",
               (SELECT count(*) FROM devices)::int          AS "devices",
               (SELECT count(*) FROM journeys)::int         AS "journeys",
               (SELECT count(*) FROM road_events)::int      AS "events",
               (SELECT count(*) FROM road_segments)::int    AS "segments"
      `) as unknown as Promise<
        Array<{ signups: number; devices: number; journeys: number; events: number; segments: number }>
      >,
      // Dense 14-day series (today inclusive) — days with no data are
      // emitted as zeros so the client can render bars without gap logic.
      db.execute(sql`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS "day",
               coalesce(j.n, 0)::int        AS "journeys",
               coalesce(e.n, 0)::int        AS "events"
        FROM generate_series(current_date - 13, current_date, interval '1 day') AS d(day)
        LEFT JOIN (
          SELECT received_at::date AS day, count(*) AS n
          FROM journeys
          WHERE received_at >= current_date - 13
          GROUP BY 1
        ) j ON j.day = d.day::date
        LEFT JOIN (
          SELECT occurred_at::date AS day, count(*) AS n
          FROM road_events
          WHERE occurred_at >= current_date - 13
          GROUP BY 1
        ) e ON e.day = d.day::date
        ORDER BY d.day ASC
      `) as unknown as Promise<Array<{ day: string; journeys: number; events: number }>>,
    ]);

    return c.json({
      ok: true,
      counts: countRows[0] ?? { signups: 0, devices: 0, journeys: 0, events: 0, segments: 0 },
      daily: dailyRows,
    });
  } catch (err) {
    console.error('[admin/overview] query error:', err);
    return c.json({ ok: false, error: 'Failed to load overview.' }, 500);
  }
});

// ─── GET /journeys?limit=50&offset=0 ─────────────────────────────────────────
// Recent journeys, newest first, with the owning device joined in.

router.get('/journeys', zValidator('query', pageSchema), async (c) => {
  const { limit, offset } = c.req.valid('query');

  try {
    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: journeys.id,
          startedAt: journeys.startedAt,
          endedAt: journeys.endedAt,
          receivedAt: journeys.receivedAt,
          distanceM: journeys.distanceM,
          durationS: journeys.durationS,
          avgSpeedKmh: journeys.avgSpeedKmh,
          vehicleType: journeys.vehicleType,
          rqiScore: journeys.rqiScore,
          eventCount: journeys.eventCount,
          deviceUuid: devices.deviceUuid,
          devicePlatform: devices.platform,
          deviceModel: devices.model,
        })
        .from(journeys)
        .innerJoin(devices, eq(journeys.deviceId, devices.id))
        .orderBy(desc(journeys.receivedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: countAsInt }).from(journeys),
    ]);

    return c.json({ ok: true, journeys: rows, total: totalRows[0]?.count ?? 0, limit, offset });
  } catch (err) {
    console.error('[admin/journeys] query error:', err);
    return c.json({ ok: false, error: 'Failed to load journeys.' }, 500);
  }
});

// ─── GET /devices?limit=50&offset=0 ──────────────────────────────────────────
// Device installs, most recently active first.

router.get('/devices', zValidator('query', pageSchema), async (c) => {
  const { limit, offset } = c.req.valid('query');

  try {
    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: devices.id,
          deviceUuid: devices.deviceUuid,
          platform: devices.platform,
          model: devices.model,
          appVersion: devices.appVersion,
          defaultVehicleType: devices.defaultVehicleType,
          journeyCount: devices.journeyCount,
          firstSeenAt: devices.firstSeenAt,
          lastSeenAt: devices.lastSeenAt,
        })
        .from(devices)
        .orderBy(desc(devices.lastSeenAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: countAsInt }).from(devices),
    ]);

    return c.json({ ok: true, devices: rows, total: totalRows[0]?.count ?? 0, limit, offset });
  } catch (err) {
    console.error('[admin/devices] query error:', err);
    return c.json({ ok: false, error: 'Failed to load devices.' }, 500);
  }
});

// ─── GET /signups?limit=50&offset=0 ──────────────────────────────────────────
// Waitlist signups, newest first.

router.get('/signups', zValidator('query', pageSchema), async (c) => {
  const { limit, offset } = c.req.valid('query');

  try {
    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: waitlistSignups.id,
          email: waitlistSignups.email,
          name: waitlistSignups.name,
          city: waitlistSignups.city,
          contribution: waitlistSignups.contribution,
          createdAt: waitlistSignups.createdAt,
        })
        .from(waitlistSignups)
        .orderBy(desc(waitlistSignups.createdAt), desc(waitlistSignups.id))
        .limit(limit)
        .offset(offset),
      db.select({ count: countAsInt }).from(waitlistSignups),
    ]);

    return c.json({ ok: true, signups: rows, total: totalRows[0]?.count ?? 0, limit, offset });
  } catch (err) {
    console.error('[admin/signups] query error:', err);
    return c.json({ ok: false, error: 'Failed to load signups.' }, 500);
  }
});

export { router as adminRouter };
