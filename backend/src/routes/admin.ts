import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { devices, journeys, waitlistSignups } from '../db/schema.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { nearestCity } from '../lib/india.js';

/**
 * Internal admin API — read-only stats + tables for the BetterRoads
 * admin dashboard (dashboard/).
 *
 * Auth: the dashboard logs in with username/password
 * (ADMIN_USERNAME/ADMIN_PASSWORD env, default admin/admin until real
 * credentials are provisioned) and receives the bearer token every other
 * endpoint requires. ADMIN_TOKEN env still overrides the token value so
 * existing deployments keep working.
 */

const router = new Hono();

// ─── Credentials & token ──────────────────────────────────────────────────────

function adminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin',
  };
}

/**
 * The bearer token the dashboard uses after login. ADMIN_TOKEN when set;
 * otherwise derived from the credentials so a credential change invalidates
 * outstanding sessions.
 */
function effectiveToken(): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const { username, password } = adminCredentials();
  return createHash('sha256')
    .update(`betterroads-admin:${username}:${password}`)
    .digest('hex');
}

/**
 * Constant-time string comparison. Both sides are hashed to a fixed length
 * first so `timingSafeEqual` never throws on length mismatch and the
 * comparison leaks nothing about the secret's length or contents.
 */
function secretsMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// ─── POST /auth/login — before the bearer middleware ─────────────────────────

router.post(
  '/auth/login',
  rateLimitMiddleware,
  zValidator(
    'json',
    z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(200) }),
  ),
  async (c) => {
    const { username, password } = c.req.valid('json');
    const expected = adminCredentials();
    const userOk = secretsMatch(username, expected.username);
    const passOk = secretsMatch(password, expected.password);
    if (!userOk || !passOk) {
      return c.json({ ok: false, error: 'Invalid username or password.' }, 401);
    }
    return c.json({ ok: true, token: effectiveToken() });
  },
);

// ─── Auth middleware (everything below requires the bearer token) ────────────

router.use('*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token || !secretsMatch(token, effectiveToken())) {
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

// ─── GET /cities ──────────────────────────────────────────────────────────────
// Real-time geography: where is data coming from right now? Journeys from the
// last 7 days are attributed to the nearest major Indian city (start point,
// 60 km radius, else "Other") and grouped, with a live feed of the most
// recent uploads. The dashboard polls this.

router.get('/cities', async (c) => {
  try {
    const rows = (await db.execute(sql`
      SELECT j.id,
             j.received_at   AS "receivedAt",
             j.start_lat     AS "startLat",
             j.start_lon     AS "startLon",
             j.vehicle_type  AS "vehicleType",
             j.distance_m    AS "distanceM",
             j.rqi_score     AS "rqiScore",
             j.event_count   AS "eventCount",
             j.device_id     AS "deviceId"
      FROM journeys j
      WHERE j.received_at >= now() - interval '7 days'
      ORDER BY j.received_at DESC
      LIMIT 5000
    `)) as unknown as Array<{
      id: string;
      receivedAt: string;
      startLat: number;
      startLon: number;
      vehicleType: string;
      distanceM: number;
      rqiScore: number;
      eventCount: number;
      deviceId: number;
    }>;

    const dayAgo = Date.now() - 24 * 3_600_000;

    interface CityAgg {
      city: string;
      state: string | null;
      journeys24h: number;
      journeys7d: number;
      events24h: number;
      devices24h: Set<number>;
      rqiSum24h: number;
      lastReceivedAt: string | null;
    }
    const byCity = new Map<string, CityAgg>();

    const attributed = rows.map((r) => {
      const match = nearestCity(r.startLat, r.startLon);
      const city = match?.name ?? 'Other';
      const state = match?.state ?? null;

      let agg = byCity.get(city);
      if (!agg) {
        agg = {
          city,
          state,
          journeys24h: 0,
          journeys7d: 0,
          events24h: 0,
          devices24h: new Set(),
          rqiSum24h: 0,
          lastReceivedAt: null,
        };
        byCity.set(city, agg);
      }
      agg.journeys7d += 1;
      if (new Date(r.receivedAt).getTime() >= dayAgo) {
        agg.journeys24h += 1;
        agg.events24h += r.eventCount;
        agg.devices24h.add(r.deviceId);
        agg.rqiSum24h += r.rqiScore;
      }
      // Rows arrive newest-first, so the first hit per city is its latest.
      if (!agg.lastReceivedAt) agg.lastReceivedAt = r.receivedAt;

      return { ...r, city, state };
    });

    const cities = [...byCity.values()]
      .map(({ devices24h, rqiSum24h, ...rest }) => ({
        ...rest,
        devices24h: devices24h.size,
        avgRqi24h: rest.journeys24h > 0 ? Math.round(rqiSum24h / rest.journeys24h) : null,
      }))
      .sort((a, b) => b.journeys24h - a.journeys24h || b.journeys7d - a.journeys7d);

    return c.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      cities,
      recent: attributed.slice(0, 30).map((r) => ({
        id: r.id,
        receivedAt: r.receivedAt,
        city: r.city,
        state: r.state,
        vehicleType: r.vehicleType,
        distanceM: r.distanceM,
        rqiScore: r.rqiScore,
        eventCount: r.eventCount,
      })),
    });
  } catch (err) {
    console.error('[admin/cities] query error:', err);
    return c.json({ ok: false, error: 'Failed to load city activity.' }, 500);
  }
});

export { router as adminRouter };
