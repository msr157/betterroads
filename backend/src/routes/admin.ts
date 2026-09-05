import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createDecipheriv, createHash } from 'crypto';
import { db } from '../db/index.js';
import {
  administrators, adminSessions, collectionLabels, collectionMarkers, collectionWindows, contractors, devices, journeys,
  researchDevices, researchRoutes, researchSites, roadContracts, waitlistSignups, feedbacks,
} from '../db/schema.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { nearestCity } from '../lib/india.js';
import { bearerToken, createAdminSession, hashPassword, hashToken, resolveAdminSession, verifyPassword } from '../lib/auth.js';
import { parseCsv } from '../lib/csv.js';
import { resolveLabelConsensus } from '../lib/labelConsensus.js';

/**
 * Internal admin API — read-only stats + tables for the BetterRoads
 * admin dashboard (dashboard/).
 *
 * Administrators and revocable bearer sessions are stored in PostgreSQL.
 * The first administrator is bootstrapped only while the table is empty.
 */

const router = new Hono();

// ─── POST /auth/login — before the bearer middleware ─────────────────────────

router.post(
  '/auth/login',
  rateLimitMiddleware,
  zValidator(
    'json',
    z.object({ payload: z.string() }),
  ),
  async (c) => {
    const { payload } = c.req.valid('json');
    let username = '';
    let password = '';
    try {
      const [ivHex, encHex] = payload.split(':');
      if (!ivHex || !encHex) throw new Error('Malformed payload');
      const key = Buffer.from("BetterRoadsAdminSecureKey2026!@#", "utf8");
      const iv = Buffer.from(ivHex, "hex");
      const encryptedText = Buffer.from(encHex, "hex");
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      const authTag = encryptedText.subarray(encryptedText.length - 16);
      const data = encryptedText.subarray(0, encryptedText.length - 16);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(data, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      const parsed = JSON.parse(decrypted);
      username = parsed.username;
      password = parsed.password;
    } catch (e) {
      return c.json({ ok: false, error: 'Invalid payload.' }, 400);
    }
    const [administrator] = await db.select().from(administrators).where(eq(administrators.username, username.trim())).limit(1);
    if (!administrator || !(await verifyPassword(password, administrator.passwordHash))) {
      return c.json({ ok: false, error: 'Invalid username or password.' }, 401);
    }
    const session = await createAdminSession(administrator.id, c.req.header('user-agent'), c.req.header('x-forwarded-for'));
    return c.json({ ok: true, ...session, administrator: { id: administrator.id, username: administrator.username, displayName: administrator.displayName } });
  },
);

// ─── Auth middleware (everything below requires the bearer token) ────────────

router.use('*', async (c, next) => {
  const auth = await resolveAdminSession(c.req.header('authorization'));
  if (!auth) {
    return c.json({ ok: false, error: 'Unauthorized.' }, 401);
  }
  c.set('adminAuth' as never, auth as never);
  await next();
});

// ─── Shared pagination query schema ───────────────────────────────────────────

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const mapQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: z.enum(['POTHOLE', 'BUMP', 'SPEED_BREAKER', 'SWERVE', 'MANUAL_REPORT']).optional(),
  severity: z.coerce.number().min(0).max(1).default(0),
  showSegments: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  showEvents: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  showContracts: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
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
          acceptedAt: journeys.acceptedAt,
          qualityStatus: journeys.qualityStatus,
          qualityReasons: journeys.qualityReasons,
          qualityDiagnostics: journeys.qualityDiagnostics,
          detectionAlgorithmVersion: journeys.detectionAlgorithmVersion,
          movingDurationS: journeys.movingDurationS,
          stationaryDurationS: journeys.stationaryDurationS,
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

router.get('/account', async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const { passwordHash: _passwordHash, ...administrator } = auth.administrator;
  return c.json({ ok: true, administrator });
});

router.put('/account', zValidator('json', z.object({ displayName: z.string().trim().min(1).max(100), email: z.string().email().nullable(), preferences: z.record(z.string(), z.unknown()).default({}) })), async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const [administrator] = await db.update(administrators).set({ ...c.req.valid('json'), updatedAt: sql`now()` }).where(eq(administrators.id, auth.administrator.id)).returning();
  const { passwordHash: _passwordHash, ...safe } = administrator;
  return c.json({ ok: true, administrator: safe });
});

router.put('/account/password', zValidator('json', z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) })), async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const { currentPassword, newPassword } = c.req.valid('json');
  if (!(await verifyPassword(currentPassword, auth.administrator.passwordHash))) return c.json({ ok: false, error: 'Current password is incorrect.' }, 400);
  await db.update(administrators).set({ passwordHash: await hashPassword(newPassword), updatedAt: sql`now()` }).where(eq(administrators.id, auth.administrator.id));
  await db.update(adminSessions).set({ revokedAt: sql`now()` }).where(and(eq(adminSessions.administratorId, auth.administrator.id), isNull(adminSessions.revokedAt), sql`${adminSessions.id} <> ${auth.session.id}`));
  return c.json({ ok: true });
});

router.get('/account/sessions', async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const rows = await db.select({ id: adminSessions.id, createdAt: adminSessions.createdAt, lastUsedAt: adminSessions.lastUsedAt, expiresAt: adminSessions.expiresAt, userAgent: adminSessions.userAgent, ipAddress: adminSessions.ipAddress }).from(adminSessions).where(and(eq(adminSessions.administratorId, auth.administrator.id), isNull(adminSessions.revokedAt))).orderBy(desc(adminSessions.lastUsedAt));
  return c.json({ ok: true, sessions: rows.map((s) => ({ ...s, current: s.id === auth.session.id })) });
});

router.delete('/account/sessions/:id', async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  await db.update(adminSessions).set({ revokedAt: sql`now()` }).where(and(eq(adminSessions.id, c.req.param('id')), eq(adminSessions.administratorId, auth.administrator.id)));
  return c.json({ ok: true });
});

router.post('/auth/logout', async (c) => {
  const token = bearerToken(c.req.header('authorization'))!;
  await db.update(adminSessions).set({ revokedAt: sql`now()` }).where(eq(adminSessions.tokenHash, hashToken(token)));
  return c.json({ ok: true });
});

router.post('/auth/logout-all', async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  await db.update(adminSessions).set({ revokedAt: sql`now()` }).where(and(eq(adminSessions.administratorId, auth.administrator.id), isNull(adminSessions.revokedAt)));
  return c.json({ ok: true });
});

router.get('/search', zValidator('query', z.object({ q: z.string().trim().min(2).max(100) })), async (c) => {
  const pattern = `%${c.req.valid('query').q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  const rows = await db.execute(sql`
    (SELECT 'user' AS type, id::text, name AS title, email AS subtitle FROM users WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} LIMIT 10)
    UNION ALL (SELECT 'journey', id, id, vehicle_type FROM journeys WHERE id ILIKE ${pattern} LIMIT 10)
    UNION ALL (SELECT 'device', id::text, device_uuid, coalesce(model, platform) FROM devices WHERE device_uuid ILIKE ${pattern} OR model ILIKE ${pattern} LIMIT 10)
    UNION ALL (SELECT 'waitlist', id::text, coalesce(name, email), email FROM waitlist_signups WHERE email ILIKE ${pattern} OR name ILIKE ${pattern} LIMIT 10)
    UNION ALL (SELECT 'contract', id::text, road_name, city FROM road_contracts WHERE road_name ILIKE ${pattern} OR city ILIKE ${pattern} OR tender_reference ILIKE ${pattern} LIMIT 10)
  `);
  return c.json({ ok: true, results: rows });
});

router.get('/alerts', async (c) => {
  const rows = await db.execute(sql`
    SELECT json_build_object('kind','severe-event','count',count(*),'message','Severe road events in the last 24 hours') AS alert
      FROM road_events WHERE severity >= 0.8 AND occurred_at >= now() - interval '24 hours'
    UNION ALL SELECT json_build_object('kind','low-rqi','count',count(*),'message','Road segments below RQI 40') FROM road_segments WHERE current_rqi < 40
    UNION ALL SELECT json_build_object('kind','new-device','count',count(*),'message','New devices in the last 24 hours') FROM devices WHERE first_seen_at >= now() - interval '24 hours'
    UNION ALL SELECT json_build_object('kind','ingestion-health','count',CASE WHEN count(*)=0 THEN 1 ELSE 0 END,'message',CASE WHEN count(*)=0 THEN 'No journeys received in the last hour' ELSE 'Ingestion active in the last hour' END) FROM journeys WHERE received_at >= now() - interval '1 hour'
    UNION ALL SELECT json_build_object('kind','waitlist-milestone','count',CASE WHEN count(*) >= 100 THEN floor(count(*) / 100)::int ELSE 0 END,'message',CASE WHEN count(*) >= 100 THEN concat(floor(count(*) / 100)::int * 100, '-signup milestone reached') ELSE 'Next waitlist milestone is 100 signups' END) FROM waitlist_signups
  `) as unknown as Array<{ alert: unknown }>;
  return c.json({ ok: true, generatedAt: new Date().toISOString(), alerts: rows.map((r) => r.alert) });
});

const contractorSchema = z.object({ name: z.string().trim().min(1).max(160), registrationNumber: z.string().trim().max(100).nullable().optional(), contactName: z.string().trim().max(120).nullable().optional(), email: z.string().email().nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), address: z.string().trim().max(500).nullable().optional() });
const geometrySchema = z.object({ type: z.enum(['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']), coordinates: z.array(z.unknown()) });
const contractSchema = z.object({ contractorId: z.number().int().positive(), roadName: z.string().trim().min(1).max(200), city: z.string().trim().min(1).max(100), ward: z.string().trim().max(100).nullable().optional(), tenderReference: z.string().trim().max(160).nullable().optional(), details: z.string().trim().max(2000).nullable().optional(), startDate: z.string().date().nullable().optional(), endDate: z.string().date().nullable().optional(), budget: z.number().nonnegative().nullable().optional(), status: z.enum(['planned', 'active', 'completed', 'cancelled', 'under-guarantee']), guaranteeUntil: z.string().date().nullable().optional(), notes: z.string().trim().max(4000).nullable().optional(), geometry: geometrySchema.nullable().optional(), published: z.boolean().default(false) }).refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'End date must not precede start date.' });

router.get('/contractors', async (c) => c.json({ ok: true, contractors: await db.select().from(contractors).orderBy(contractors.name) }));
router.post('/contractors', zValidator('json', contractorSchema), async (c) => { const [row] = await db.insert(contractors).values(c.req.valid('json')).returning(); return c.json({ ok: true, contractor: row }, 201); });
router.put('/contractors/:id', zValidator('json', contractorSchema), async (c) => { const [row] = await db.update(contractors).set({ ...c.req.valid('json'), updatedAt: sql`now()` }).where(eq(contractors.id, Number(c.req.param('id')))).returning(); return row ? c.json({ ok: true, contractor: row }) : c.json({ ok: false, error: 'Contractor not found.' }, 404); });
router.delete('/contractors/:id', async (c) => { try { await db.delete(contractors).where(eq(contractors.id, Number(c.req.param('id')))); return c.json({ ok: true }); } catch { return c.json({ ok: false, error: 'Contractor is in use.' }, 409); } });

router.get('/contracts', async (c) => { const rows = await db.execute(sql`SELECT rc.id, rc.contractor_id AS "contractorId", rc.road_name AS "roadName", rc.city, rc.ward, rc.tender_reference AS "tenderReference", rc.details, rc.start_date::text AS "startDate", rc.end_date::text AS "endDate", rc.budget, rc.status, rc.guarantee_until::text AS "guaranteeUntil", rc.notes, rc.geometry, rc.published, rc.published_at AS "publishedAt", rc.created_at AS "createdAt", rc.updated_at AS "updatedAt", c.name AS "contractorName" FROM road_contracts rc JOIN contractors c ON c.id=rc.contractor_id ORDER BY rc.updated_at DESC`); return c.json({ ok: true, contracts: rows }); });
router.post('/contracts', zValidator('json', contractSchema), async (c) => { const v = c.req.valid('json'); const [row] = await db.insert(roadContracts).values({ ...v, publishedAt: v.published ? new Date() : null }).returning(); return c.json({ ok: true, contract: row }, 201); });
router.put('/contracts/:id', zValidator('json', contractSchema), async (c) => { const v = c.req.valid('json'); const [row] = await db.update(roadContracts).set({ ...v, publishedAt: v.published ? sql`coalesce(${roadContracts.publishedAt}, now())` : null, updatedAt: sql`now()` }).where(eq(roadContracts.id, Number(c.req.param('id')))).returning(); return row ? c.json({ ok: true, contract: row }) : c.json({ ok: false, error: 'Contract not found.' }, 404); });
router.delete('/contracts/:id', async (c) => { const [row] = await db.delete(roadContracts).where(eq(roadContracts.id, Number(c.req.param('id')))).returning({ id: roadContracts.id }); return row ? c.json({ ok: true }) : c.json({ ok: false, error: 'Contract not found.' }, 404); });

router.get('/contracts/template.csv', (c) => c.text('contractorName,registrationNumber,roadName,city,ward,tenderReference,startDate,endDate,budget,status,guaranteeUntil,published,notes\n', 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="betterroads-contract-import.csv"' }));
router.post('/contracts/import', async (c) => {
  let rows: string[][];
  try { rows = parseCsv(await c.req.text()); }
  catch (error) { return c.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid CSV.' }, 400); }
  const header = rows.shift() ?? [];
  const required = ['contractorName', 'roadName', 'city', 'status'];
  if (!required.every((v) => header.includes(v))) return c.json({ ok: false, error: `CSV must include ${required.join(', ')}.` }, 400);
  let imported = 0;
  const errors: Array<{ row: number; error: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const values = rows[i]!;
    const raw = Object.fromEntries(header.map((key, j) => [key, values[j] ?? '']));
    try {
      let [contractor] = await db.select().from(contractors).where(eq(contractors.name, raw.contractorName)).limit(1);
      if (!contractor) [contractor] = await db.insert(contractors).values({ name: raw.contractorName, registrationNumber: raw.registrationNumber || null }).returning();
      const parsed = contractSchema.parse({ contractorId: contractor.id, roadName: raw.roadName, city: raw.city, ward: raw.ward || null, tenderReference: raw.tenderReference || null, startDate: raw.startDate || null, endDate: raw.endDate || null, budget: raw.budget ? Number(raw.budget) : null, status: raw.status, guaranteeUntil: raw.guaranteeUntil || null, published: ['true', '1', 'yes'].includes(raw.published.toLowerCase()), notes: raw.notes || null });
      await db.insert(roadContracts).values({ ...parsed, publishedAt: parsed.published ? new Date() : null }); imported++;
    } catch (error) { errors.push({ row: i + 2, error: error instanceof Error ? error.message : 'Invalid row.' }); }
  }
  return c.json({ ok: true, partial: errors.length > 0, imported, errors }, errors.length ? 207 : 200);
});

router.get('/map/data', zValidator('query', mapQuerySchema), async (c) => {
  const { from, to, type, severity, showSegments, showEvents, showContracts } = c.req.valid('query');
  const [segments, events, contractsRows, journeyRows] = await Promise.all([
    showSegments ? db.execute(sql`SELECT rs.segment_key AS "segmentKey", rs.geometry, coalesce((SELECT ss.rqi FROM segment_snapshots ss WHERE ss.segment_key=rs.segment_key ${to ? sql`AND ss.day <= ${to}::date` : sql``} ORDER BY ss.day DESC LIMIT 1), rs.current_rqi) AS rqi, rs.sample_count AS "sampleCount" FROM road_segments rs WHERE EXISTS (SELECT 1 FROM segment_snapshots ss WHERE ss.segment_key=rs.segment_key ${from ? sql`AND ss.day >= ${from}::date` : sql``} ${to ? sql`AND ss.day <= ${to}::date` : sql``}) OR (${!from && !to}) LIMIT 5000`) : Promise.resolve([]),
    showEvents ? db.execute(sql`SELECT id,type,severity,occurred_at AS "occurredAt",lat,lon,journey_id AS "journeyId" FROM road_events WHERE severity >= ${severity} ${from ? sql`AND occurred_at >= ${from}::date` : sql``} ${to ? sql`AND occurred_at < ${to}::date + interval '1 day'` : sql``} ${type ? sql`AND type=${type.toUpperCase()}` : sql``} LIMIT 5000`) : Promise.resolve([]),
    showContracts ? db.execute(sql`SELECT id,road_name AS "roadName",city,status,geometry,published FROM road_contracts WHERE geometry IS NOT NULL`) : Promise.resolve([]),
    db.execute(sql`SELECT j.id, j.started_at AS "startedAt", j.ended_at AS "endedAt", j.distance_m AS "distanceM" FROM journeys j JOIN journey_raw jr ON jr.journey_id=j.id WHERE (jsonb_array_length(coalesce(jr.payload->'path', '[]'::jsonb)) >= 2 OR jsonb_array_length(coalesce(jr.payload->'locationSamples', '[]'::jsonb)) >= 2) ${from ? sql`AND j.ended_at >= ${from}::date` : sql``} ${to ? sql`AND j.started_at < ${to}::date + interval '1 day'` : sql``} ORDER BY j.ended_at DESC LIMIT 100`),
  ]);
  return c.json({ ok: true, segments, events, contracts: contractsRows, journeys: journeyRows });
});

router.get('/journeys/:id/replay', async (c) => {
  const rows = await db.execute(sql`SELECT j.id,j.started_at AS "startedAt",j.ended_at AS "endedAt",j.distance_m AS "distanceM",CASE WHEN jsonb_array_length(coalesce(jr.payload->'path', '[]'::jsonb)) >= 2 THEN jr.payload->'path' ELSE (SELECT jsonb_agg(jsonb_build_array((sample->>'lat')::float, (sample->>'lon')::float, (sample->>'timestamp')::bigint)) FROM jsonb_array_elements(coalesce(jr.payload->'locationSamples', '[]'::jsonb)) sample) END AS path FROM journeys j JOIN journey_raw jr ON jr.journey_id=j.id WHERE j.id=${c.req.param('id')}`);
  if (!rows[0]) return c.json({ ok: false, error: 'Journey not found.' }, 404);
  return c.json({ ok: true, journey: rows[0] });
});

router.get('/map/export.geojson', zValidator('query', mapQuerySchema), async (c) => {
  const { from, to, type, severity, showSegments, showEvents, showContracts } = c.req.valid('query');
  const [segments, events, contractsRows] = await Promise.all([
    showSegments ? db.execute(sql`SELECT rs.segment_key AS id, rs.geometry, coalesce((SELECT ss.rqi FROM segment_snapshots ss WHERE ss.segment_key=rs.segment_key ${to ? sql`AND ss.day <= ${to}::date` : sql``} ORDER BY ss.day DESC LIMIT 1), rs.current_rqi) AS rqi, rs.sample_count AS samples, rs.event_count AS events FROM road_segments rs WHERE EXISTS (SELECT 1 FROM segment_snapshots ss WHERE ss.segment_key=rs.segment_key ${from ? sql`AND ss.day >= ${from}::date` : sql``} ${to ? sql`AND ss.day <= ${to}::date` : sql``}) OR (${!from && !to}) LIMIT 10000`) as unknown as Promise<Array<{ id: string; geometry: [number, number][]; rqi: number; samples: number; events: number }>> : Promise.resolve([]),
    showEvents ? db.execute(sql`SELECT id,type,severity,occurred_at AS "occurredAt",lat,lon,journey_id AS "journeyId" FROM road_events WHERE severity >= ${severity} ${from ? sql`AND occurred_at >= ${from}::date` : sql``} ${to ? sql`AND occurred_at < ${to}::date + interval '1 day'` : sql``} ${type ? sql`AND type=${type.toUpperCase()}` : sql``} LIMIT 10000`) as unknown as Promise<Array<{ id: string; type: string; severity: number; occurredAt: string; lat: number; lon: number; journeyId: string }>> : Promise.resolve([]),
    showContracts ? db.execute(sql`SELECT id,road_name AS "roadName",city,status,geometry,published FROM road_contracts WHERE geometry IS NOT NULL`) as unknown as Promise<Array<{ id: number; roadName: string; city: string; status: string; geometry: object; published: boolean }>> : Promise.resolve([]),
  ]);
  const features = [
    ...segments.map((r) => ({ type: 'Feature', properties: { layer: 'rqi-segment', id: r.id, rqi: r.rqi, samples: r.samples, events: r.events }, geometry: { type: 'LineString', coordinates: r.geometry.map(([lat, lon]) => [lon, lat]) } })),
    ...events.map((e) => ({ type: 'Feature', properties: { layer: 'road-event', id: e.id, type: e.type, severity: e.severity, occurredAt: e.occurredAt, journeyId: e.journeyId }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } })),
    ...contractsRows.map((r) => ({ type: 'Feature', properties: { layer: 'contract', id: r.id, roadName: r.roadName, city: r.city, status: r.status, published: r.published }, geometry: r.geometry })),
  ];
  return c.json({ type: 'FeatureCollection', features }, 200, { 'Content-Disposition': 'attachment; filename="betterroads-map.geojson"' });
});

// ─── Vehicle-separated research collection ──────────────────────────────────

const collectionPageSchema = pageSchema.extend({
  vehicleClass: z.enum(['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK']).optional(),
  qualityStatus: z.enum(['RECEIVED', 'QUARANTINED']).optional(),
  mode: z.enum(['STANDARD', 'CONTROLLED_RESEARCH']).optional(),
});

router.get('/collection/sessions', zValidator('query', collectionPageSchema), async (c) => {
  const { limit, offset, vehicleClass, qualityStatus, mode } = c.req.valid('query');
  const rows = await db.execute(sql`
    SELECT cs.id, cs.vehicle_class AS "vehicleClass", cs.vehicle_subtype AS "vehicleSubtype",
           cs.mount_position AS "mountPosition", cs.profile_version AS "profileVersion", cs.mode,
           cs.upload_state AS "uploadState", cs.quality_status AS "qualityStatus",
           cs.quality_reasons AS "qualityReasons", cs.accepted_distance_m AS "acceptedDistanceM",
           cs.started_at AS "startedAt", cs.completed_at AS "completedAt", d.device_uuid AS "deviceUuid",
           d.model AS "deviceModel",
           (SELECT count(*)::int FROM collection_windows cw WHERE cw.session_id=cs.id) AS "windowCount",
           (SELECT count(*)::int FROM collection_raw_objects ro WHERE ro.session_id=cs.id AND ro.state='VERIFIED') AS "rawObjectCount"
    FROM collection_sessions cs JOIN devices d ON d.id=cs.device_id
    WHERE (${vehicleClass ?? null}::text IS NULL OR cs.vehicle_class=${vehicleClass ?? null})
      AND (${qualityStatus ?? null}::text IS NULL OR cs.quality_status=${qualityStatus ?? null})
      AND (${mode ?? null}::text IS NULL OR cs.mode=${mode ?? null})
    ORDER BY cs.received_at DESC LIMIT ${limit} OFFSET ${offset}
  `);
  const totals = await db.execute(sql`
    SELECT count(*)::int AS count FROM collection_sessions cs
    WHERE (${vehicleClass ?? null}::text IS NULL OR cs.vehicle_class=${vehicleClass ?? null})
      AND (${qualityStatus ?? null}::text IS NULL OR cs.quality_status=${qualityStatus ?? null})
      AND (${mode ?? null}::text IS NULL OR cs.mode=${mode ?? null})
  `) as unknown as Array<{ count: number }>;
  return c.json({ ok: true, sessions: rows, total: totals[0]?.count ?? 0, limit, offset });
});

router.get('/collection/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const sessions = await db.execute(sql`SELECT * FROM collection_sessions WHERE id=${id}`);
  if (!sessions[0]) return c.json({ ok: false, error: 'Collection session not found.' }, 404);
  const [windows, rawObjects, markers] = await Promise.all([
    db.execute(sql`SELECT * FROM collection_windows WHERE session_id=${id} ORDER BY started_at`),
    db.execute(sql`SELECT id,window_id AS "windowId",object_key AS "objectKey",expected_size AS "expectedSize",observed_size AS "observedSize",sha256,state,verified_at AS "verifiedAt" FROM collection_raw_objects WHERE session_id=${id}`),
    db.execute(sql`SELECT cm.*,rs.stable_site_id AS "stableSiteId",rs.site_type AS "siteType" FROM collection_markers cm LEFT JOIN research_sites rs ON rs.id=cm.site_id WHERE cm.session_id=${id} ORDER BY cm.marked_at`),
  ]);
  return c.json({ ok: true, session: sessions[0], windows, rawObjects, markers });
});

const researchDeviceSchema = z.object({
  deviceUuid: z.string().uuid(),
  permittedVehicleClasses: z.array(z.enum(['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK'])).min(1).max(5),
  expiresAt: z.string().datetime().nullable().optional(),
  operatorNote: z.string().trim().max(500).nullable().optional(),
});

router.get('/research/devices', async (c) => c.json({ ok: true, devices: await db.select().from(researchDevices).orderBy(desc(researchDevices.createdAt)) }));
router.post('/research/devices', zValidator('json', researchDeviceSchema), async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const input = c.req.valid('json');
  const [row] = await db.insert(researchDevices).values({
    deviceUuid: input.deviceUuid, status: 'AUTHORIZED', permittedVehicleClasses: [...new Set(input.permittedVehicleClasses)],
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, operatorNote: input.operatorNote ?? null,
    approvedBy: auth.administrator.id, revokedAt: null,
  }).onConflictDoUpdate({
    target: researchDevices.deviceUuid,
    set: {
      status: 'AUTHORIZED', permittedVehicleClasses: [...new Set(input.permittedVehicleClasses)],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, operatorNote: input.operatorNote ?? null,
      approvedBy: auth.administrator.id, revokedAt: null,
    },
  }).returning();
  return c.json({ ok: true, device: row }, 201);
});
router.delete('/research/devices/:uuid', async (c) => {
  const [row] = await db.update(researchDevices).set({ status: 'REVOKED', revokedAt: sql`now()` }).where(eq(researchDevices.deviceUuid, c.req.param('uuid'))).returning();
  return row ? c.json({ ok: true }) : c.json({ ok: false, error: 'Research device not found.' }, 404);
});

const researchRouteSchema = z.object({
  name: z.string().trim().min(1).max(160), city: z.string().trim().min(1).max(100),
  routeVersion: z.string().trim().min(1).max(80),
  geometry: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).min(2).max(100_000),
});
const researchSiteSchema = z.object({
  stableSiteId: z.string().trim().min(1).max(100),
  siteType: z.enum(['POTHOLE_OR_DAMAGE', 'SPEED_BREAKER', 'JOINT_OR_DRAIN', 'RAIL_CROSSING', 'NORMAL_SECTION', 'OTHER', 'UNCERTAIN']),
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180),
  direction: z.string().trim().max(40).nullable().optional(), notes: z.string().trim().max(1000).nullable().optional(),
});

router.get('/research/routes', async (c) => c.json({ ok: true, routes: await db.select().from(researchRoutes).orderBy(desc(researchRoutes.createdAt)) }));
router.post('/research/routes', zValidator('json', researchRouteSchema), async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const [route] = await db.insert(researchRoutes).values({ ...c.req.valid('json'), createdBy: auth.administrator.id }).returning();
  return c.json({ ok: true, route }, 201);
});
router.get('/research/routes/:routeId/sites', async (c) => {
  const routeId = Number(c.req.param('routeId'));
  return c.json({ ok: true, sites: await db.select().from(researchSites).where(eq(researchSites.routeId, routeId)).orderBy(researchSites.stableSiteId) });
});
router.post('/research/routes/:routeId/sites', zValidator('json', researchSiteSchema), async (c) => {
  const routeId = Number(c.req.param('routeId'));
  const [site] = await db.insert(researchSites).values({ routeId, ...c.req.valid('json') }).returning();
  return c.json({ ok: true, site }, 201);
});

router.put(
  '/collection/markers/:id/match',
  zValidator('json', z.object({ routeId: z.number().int().positive(), siteId: z.number().int().positive(), notes: z.string().trim().max(1000).optional() })),
  async (c) => {
    const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
    const input = c.req.valid('json');
    const [site] = await db.select().from(researchSites).where(and(eq(researchSites.id, input.siteId), eq(researchSites.routeId, input.routeId))).limit(1);
    if (!site) return c.json({ ok: false, error: 'Research site does not belong to the selected route.' }, 400);
    const [marker] = await db.select().from(collectionMarkers).where(eq(collectionMarkers.id, c.req.param('id'))).limit(1);
    if (!marker) return c.json({ ok: false, error: 'Collection marker not found.' }, 404);
    const [updated] = await db.update(collectionMarkers).set({
      routeId: input.routeId, siteId: input.siteId, matchStatus: 'MATCHED',
      matchDiagnostics: {
        ...(marker.matchDiagnostics as Record<string, unknown>), matchedBy: auth.administrator.id,
        matchedAt: new Date().toISOString(), notes: input.notes ?? null,
      },
    }).where(eq(collectionMarkers.id, marker.id)).returning();
    return c.json({ ok: true, marker: updated });
  },
);

const labelSchema = z.object({
  windowId: z.string().uuid(), taxonomyVersion: z.literal('impact-taxonomy-v1'),
  primaryLabel: z.enum(['USABLE_NORMAL', 'GENUINE_ROAD_IMPACT', 'HANDLING_OR_MANEUVER_ARTIFACT', 'POTHOLE_OR_DAMAGE', 'SPEED_BREAKER', 'JOINT_OR_DRAIN', 'RAIL_CROSSING', 'OTHER_IMPACT', 'UNCERTAIN', 'UNUSABLE_SENSOR_DATA']),
  secondaryAttributes: z.record(z.string().max(60), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).default({}),
  confidence: z.number().min(0).max(1),
  evidenceSource: z.enum(['SURVEYED_SITE_MARKER', 'REPEAT_PASS', 'MANUAL_ARTIFACT', 'OTHER']),
  notes: z.string().trim().max(2000).nullable().optional(),
});

router.get(
  '/collection/label-queue',
  zValidator('query', z.object({ vehicleClass: z.enum(['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK']).optional() })),
  async (c) => {
    const { vehicleClass } = c.req.valid('query');
    const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
    const rows = await db.execute(sql`
      SELECT cw.id AS "windowId",cw.encounter_id AS "encounterId",cw.kind,cw.started_at AS "startedAt",
             cw.trigger_reasons AS "triggerReasons",cw.features,cw.label_state AS "labelState",
             cw.lat,cw.lon,cw.accuracy_m AS "accuracyM",cs.id AS "sessionId",
             cs.vehicle_class AS "vehicleClass",cs.vehicle_subtype AS "vehicleSubtype",cs.mount_position AS "mountPosition",
             (SELECT jsonb_agg(jsonb_build_object('primaryLabel',cl.primary_label,'reviewerId',cl.reviewer_id,'confidence',cl.confidence,'reviewRound',cl.review_round) ORDER BY cl.created_at)
                FROM collection_labels cl WHERE cl.window_id=cw.id) AS reviews
      FROM collection_windows cw JOIN collection_sessions cs ON cs.id=cw.session_id
      WHERE cs.mode='CONTROLLED_RESEARCH' AND cs.quality_status='RECEIVED'
        AND cw.label_state IN ('UNLABELLED','IN_REVIEW','DISPUTED')
        AND (cw.label_state='DISPUTED' OR NOT EXISTS (
          SELECT 1 FROM collection_labels own_review
          WHERE own_review.window_id=cw.id AND own_review.reviewer_id=${auth.administrator.id}
        ))
        AND (${vehicleClass ?? null}::text IS NULL OR cs.vehicle_class=${vehicleClass ?? null})
      ORDER BY cw.started_at LIMIT 50
    `);
    return c.json({ ok: true, windows: rows });
  },
);

router.post('/collection/labels', zValidator('json', labelSchema), async (c) => {
  const auth = c.get('adminAuth' as never) as NonNullable<Awaited<ReturnType<typeof resolveAdminSession>>>;
  const input = c.req.valid('json');
  const [window] = await db.select().from(collectionWindows).where(eq(collectionWindows.id, input.windowId)).limit(1);
  if (!window) return c.json({ ok: false, error: 'Collection window not found.' }, 404);
  const priorReview = await db.execute(sql`
    SELECT coalesce(max(review_round), 0)::int AS "lastRound"
    FROM collection_labels
    WHERE window_id=${input.windowId} AND reviewer_id=${auth.administrator.id}
  `) as unknown as Array<{ lastRound: number }>;
  const reviewRound = (priorReview[0]?.lastRound ?? 0) + 1;
  if (reviewRound > 10) return c.json({ ok: false, error: 'Maximum review rounds reached for this window.' }, 409);
  const [label] = await db.insert(collectionLabels).values({
    ...input, reviewRound, notes: input.notes ?? null, reviewerId: auth.administrator.id,
  }).returning();
  const reviews = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (cl.reviewer_id) cl.reviewer_id, cl.primary_label
      FROM collection_labels cl
      WHERE cl.window_id=${input.windowId} AND cl.taxonomy_version=${input.taxonomyVersion}
      ORDER BY cl.reviewer_id, cl.review_round DESC, cl.created_at DESC
    )
    SELECT latest.primary_label AS "primaryLabel", count(*)::int AS reviewers
    FROM latest GROUP BY latest.primary_label ORDER BY reviewers DESC
  `) as unknown as Array<{ primaryLabel: string; reviewers: number }>;
  const consensus = resolveLabelConsensus(reviews.flatMap((row) => Array(row.reviewers).fill(row.primaryLabel)));
  await db.update(collectionWindows).set({
    labelState: consensus.labelState,
    exportEligible: consensus.exportEligible,
  }).where(eq(collectionWindows.id, input.windowId));
  return c.json({ ok: true, label, labelState: consensus.labelState }, 201);
});

router.get(
  '/collection/export',
  zValidator('query', z.object({ vehicleClass: z.enum(['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK']) })),
  async (c) => {
    const { vehicleClass } = c.req.valid('query');
    const sourceRows = await db.execute(sql`
      SELECT cw.id AS "windowId",cw.encounter_id AS "encounterId",cw.kind,cw.feature_version AS "featureVersion",
             cw.features,cw.started_at AS "startedAt",cw.ended_at AS "endedAt",cs.id AS "sessionId",
             cs.vehicle_class AS "vehicleClass",cs.vehicle_subtype AS "vehicleSubtype",cs.profile_version AS "profileVersion",
             cs.mount_position AS "mountPosition",d.device_uuid AS "deviceUuid",d.model AS "deviceModel",
             (SELECT cl.primary_label FROM collection_labels cl WHERE cl.window_id=cw.id ORDER BY cl.review_round DESC,cl.created_at DESC LIMIT 1) AS label,
             (SELECT ro.object_key FROM collection_raw_objects ro WHERE ro.window_id=cw.id AND ro.state='VERIFIED' LIMIT 1) AS "rawObjectKey",
             (SELECT ro.sha256 FROM collection_raw_objects ro WHERE ro.window_id=cw.id AND ro.state='VERIFIED' LIMIT 1) AS "rawObjectSha256"
      FROM collection_windows cw
      JOIN collection_sessions cs ON cs.id=cw.session_id
      JOIN devices d ON d.id=cs.device_id
      WHERE cs.vehicle_class=${vehicleClass} AND cs.mode='CONTROLLED_RESEARCH' AND cs.quality_status='RECEIVED'
        AND cs.upload_state='COMPLETE' AND cw.export_eligible=true AND cw.label_state='AGREED'
      ORDER BY cw.id
    `);
    if (sourceRows.some((row) => (row as { vehicleClass: string }).vehicleClass !== vehicleClass)) {
      return c.json({ ok: false, error: 'Mixed-vehicle export invariant failed.' }, 500);
    }
    const pseudonymSalt = process.env.COLLECTION_EXPORT_PSEUDONYM_SALT;
    if (!pseudonymSalt) return c.json({ ok: false, error: 'Dataset export pseudonym salt is not configured.' }, 503);
    const rows = sourceRows.map((row) => {
      const typed = row as Record<string, unknown> & { deviceUuid: string };
      const { deviceUuid, ...safe } = typed;
      return {
        ...safe,
        devicePseudonym: createHash('sha256').update(`${pseudonymSalt}:${deviceUuid}`).digest('hex').slice(0, 24),
      };
    });
    const datasetHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    return c.json({
      ok: true, schemaVersion: 1, vehicleClass, generatedAt: new Date().toISOString(), datasetHash,
      windowCount: rows.length, windows: rows,
    }, 200, { 'Content-Disposition': `attachment; filename="betterroads-${vehicleClass.toLowerCase()}-${datasetHash.slice(0, 12)}.json"` });
  },
);

router.get('/feedback', async (c) => {
  const rows = await db.select()
    .from(feedbacks)
    .orderBy(desc(feedbacks.createdAt));
  return c.json({ ok: true, feedback: rows });
});

export { router as adminRouter };
