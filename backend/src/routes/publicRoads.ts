import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { feedbacks } from '../db/schema.js';
import { clampBboxToIndia } from '../lib/india.js';
import { feedbackRateLimitMiddleware } from '../middleware/rateLimit.js';

/**
 * Public read-only API for the map + timeline UI.
 *
 * Timeline model: segment_snapshots holds one cumulative row per
 * (segment, day-with-data). "State of the road network as of date D" =
 * for each segment, the latest snapshot with day ≤ D. Days without new
 * journeys carry the previous snapshot forward, exactly like a
 * Google-Maps-style time slider expects.
 */

const router = new Hono();

const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

/** Max segments / events returned per request — client should zoom in. */
const MAX_ROWS = 5_000;

const bboxSchema = {
  minLat: z.coerce.number().min(-90).max(90),
  maxLat: z.coerce.number().min(-90).max(90),
  minLon: z.coerce.number().min(-180).max(180),
  maxLon: z.coerce.number().min(-180).max(180),
};

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.');

// ─── GET /roads?minLat=…&maxLat=…&minLon=…&maxLon=…[&at=YYYY-MM-DD] ──────────
// Road segments in the bounding box with their RQI as of the given date
// (defaults to today = current state).

router.get(
  '/roads',
  zValidator('query', z.object({ ...bboxSchema, at: dayString.optional() })),
  async (c) => {
    const { at, ...requested } = c.req.valid('query');

    // India-only product: queries outside India return an empty (valid) result.
    const bbox = clampBboxToIndia(requested);
    if (!bbox) return c.json({ ok: true, at: at ?? null, segments: [] }, 200, CACHE);
    const { minLat, maxLat, minLon, maxLon } = bbox;

    try {
      const rows = at
        ? // Historical view: latest snapshot per segment on or before `at`.
          await db.execute(sql`
            SELECT s.segment_key AS "segmentKey",
                   s.center_lat  AS "centerLat",
                   s.center_lon  AS "centerLon",
                   s.geometry,
                   snap.rqi,
                   snap.sample_count AS "sampleCount",
                   snap.event_count  AS "eventCount",
                   snap.day::text    AS "lastEvidenceAt"
            FROM road_segments s
            JOIN LATERAL (
              SELECT rqi, sample_count, day,
                     (SELECT coalesce(sum(ss2.event_count), 0)::int
                      FROM segment_snapshots ss2
                      WHERE ss2.segment_key = s.segment_key AND ss2.day <= ${at}) AS event_count
              FROM segment_snapshots
              WHERE segment_key = s.segment_key AND day <= ${at}
              ORDER BY day DESC
              LIMIT 1
            ) snap ON true
            WHERE s.center_lat BETWEEN ${minLat} AND ${maxLat}
              AND s.center_lon BETWEEN ${minLon} AND ${maxLon}
            LIMIT ${MAX_ROWS}
          `)
        : // Current view: the running aggregate on road_segments.
          await db.execute(sql`
            SELECT segment_key  AS "segmentKey",
                   center_lat   AS "centerLat",
                   center_lon   AS "centerLon",
                   geometry,
                   current_rqi  AS "rqi",
                   sample_count AS "sampleCount",
                   event_count  AS "eventCount",
                   last_updated_at::text AS "lastEvidenceAt"
            FROM road_segments
            WHERE center_lat BETWEEN ${minLat} AND ${maxLat}
              AND center_lon BETWEEN ${minLon} AND ${maxLon}
            LIMIT ${MAX_ROWS}
          `);

      return c.json({ ok: true, at: at ?? null, segments: rows }, 200, CACHE);
    } catch (err) {
      console.error('[public/roads] query error:', err);
      return c.json({ ok: false, error: 'Failed to load road data.' }, 500);
    }
  },
);

// ─── GET /events?minLat=…&…[&from=…][&to=…][&type=POTHOLE] ───────────────────
// Individual event markers (potholes etc.) in the bbox and time range.

router.get(
  '/events',
  zValidator(
    'query',
    z.object({
      ...bboxSchema,
      from: dayString.optional(),
      to: dayString.optional(),
      type: z.string().max(20).optional(),
    }),
  ),
  async (c) => {
    const { from, to, type, ...requested } = c.req.valid('query');

    const bbox = clampBboxToIndia(requested);
    if (!bbox) return c.json({ ok: true, events: [] }, 200, CACHE);
    const { minLat, maxLat, minLon, maxLon } = bbox;

    try {
      const rows = await db.execute(sql`
        SELECT e.id, e.type, e.severity, e.occurred_at AS "occurredAt",
               e.lat, e.lon, e.speed_kmh AS "speedKmh", e.segment_key AS "segmentKey",
               e.accuracy_m AS "accuracyM", e.location_quality AS "locationQuality",
               e.pothole_hotspot_id AS "potholeHotspotId"
        FROM road_events e
        JOIN journeys j ON j.id = e.journey_id
        WHERE j.accepted_at IS NOT NULL
          AND j.quality_status IN ('LEGACY_APPROVED', 'APPROVED')
          AND e.lat BETWEEN ${minLat} AND ${maxLat}
          AND e.lon BETWEEN ${minLon} AND ${maxLon}
          ${from ? sql`AND e.occurred_at >= ${from}::date` : sql``}
          ${to ? sql`AND e.occurred_at < (${to}::date + interval '1 day')` : sql``}
          ${type ? sql`AND e.type = ${type.toUpperCase()}` : sql``}
        ORDER BY e.occurred_at DESC
        LIMIT ${MAX_ROWS}
      `);

      return c.json({ ok: true, events: rows }, 200, CACHE);
    } catch (err) {
      console.error('[public/events] query error:', err);
      return c.json({ ok: false, error: 'Failed to load events.' }, 500);
    }
  },
);

// ─── GET /hotspots?bbox…[&at=YYYY-MM-DD][&zoom=…] ───────────────────────────
// Stable pothole signals derived only from accepted automatic POTHOLE events.

router.get(
  '/hotspots',
  zValidator('query', z.object({ ...bboxSchema, at: dayString.optional(), zoom: z.coerce.number().min(0).max(24).default(10) })),
  async (c) => {
    const { at, zoom, ...requested } = c.req.valid('query');
    const bbox = clampBboxToIndia(requested);
    if (!bbox) return c.json({ ok: true, at: at ?? null, aggregate: zoom < 8, hotspots: [], truncated: false }, 200, CACHE);
    const { minLat, maxLat, minLon, maxLon } = bbox;
    try {
      if (zoom < 8) {
        const rows = await db.execute(sql`
          WITH accepted AS (
            SELECT e.* FROM road_events e JOIN journeys j ON j.id=e.journey_id
            WHERE e.type='POTHOLE' AND e.pothole_hotspot_id IS NOT NULL
              AND j.accepted_at IS NOT NULL AND j.quality_status IN ('LEGACY_APPROVED','APPROVED')
              AND e.lat BETWEEN ${minLat} AND ${maxLat} AND e.lon BETWEEN ${minLon} AND ${maxLon}
              ${at ? sql`AND e.occurred_at < (${at}::date + interval '1 day')` : sql``}
          ), hotspot_rollup AS (
            SELECT pothole_hotspot_id, min(lat) lat, min(lon) lon, count(*)::int detections,
                   count(DISTINCT journey_id)::int journeys, min(occurred_at) first_at, max(occurred_at) last_at,
                   avg(severity) avg_severity, max(severity) max_severity, max(accuracy_m) accuracy_m
            FROM accepted GROUP BY pothole_hotspot_id
          )
          SELECT ('region:' || floor(lat)::text || ':' || floor(lon)::text) AS id,
                 avg(lat)::float AS lat, avg(lon)::float AS lon,
                 count(*)::int AS "aggregateCount", sum(detections)::int AS "detectionCount",
                 sum(journeys)::int AS "distinctJourneyCount", min(first_at)::text AS "firstDetectedAt",
                 max(last_at)::text AS "lastDetectedAt", avg(avg_severity)::float AS "averageSeverity",
                 max(max_severity)::float AS "maximumSeverity", max(accuracy_m)::float AS "accuracyM",
                 'regional' AS confidence
          FROM hotspot_rollup GROUP BY floor(lat), floor(lon)
          ORDER BY count(*) DESC LIMIT ${MAX_ROWS}
        `);
        return c.json({ ok: true, at: at ?? null, aggregate: true, hotspots: rows, truncated: rows.length === MAX_ROWS }, 200, CACHE);
      }
      const rows = await db.execute(sql`
        SELECT ph.id, ph.center_lat AS lat, ph.center_lon AS lon,
               count(e.id)::int AS "detectionCount", count(DISTINCT e.journey_id)::int AS "distinctJourneyCount",
               min(e.occurred_at)::text AS "firstDetectedAt", max(e.occurred_at)::text AS "lastDetectedAt",
               avg(e.severity)::float AS "averageSeverity", max(e.severity)::float AS "maximumSeverity",
               max(e.accuracy_m)::float AS "accuracyM",
               CASE WHEN count(DISTINCT e.journey_id) >= 2 THEN 'repeated' ELSE 'possible' END AS confidence
        FROM pothole_hotspots ph JOIN road_events e ON e.pothole_hotspot_id=ph.id
        JOIN journeys j ON j.id=e.journey_id
        WHERE e.type='POTHOLE' AND j.accepted_at IS NOT NULL AND j.quality_status IN ('LEGACY_APPROVED','APPROVED')
          AND ph.center_lat BETWEEN ${minLat} AND ${maxLat} AND ph.center_lon BETWEEN ${minLon} AND ${maxLon}
          ${at ? sql`AND e.occurred_at < (${at}::date + interval '1 day')` : sql``}
        GROUP BY ph.id, ph.center_lat, ph.center_lon
        ORDER BY max(e.occurred_at) DESC LIMIT ${MAX_ROWS}
      `);
      return c.json({ ok: true, at: at ?? null, aggregate: false, hotspots: rows, truncated: rows.length === MAX_ROWS }, 200, CACHE);
    } catch (err) {
      console.error('[public/hotspots] query error:', err);
      return c.json({ ok: false, error: 'Failed to load pothole signals.' }, 500);
    }
  },
);

// ─── GET /timeline ────────────────────────────────────────────────────────────
// Bounds + per-day aggregates for the slider (range, tick marks, sparkline).

router.get('/timeline', async (c) => {
  try {
    const rows = (await db.execute(sql`
      WITH snapshot_changes AS (
        SELECT day, segment_key, rqi,
               lag(rqi) OVER (PARTITION BY segment_key ORDER BY day) previous_rqi,
               row_number() OVER (PARTITION BY segment_key ORDER BY day) sequence
        FROM segment_snapshots
      ), roads_by_day AS (
        SELECT day, count(*)::int AS segments_updated,
               count(*) FILTER (WHERE sequence=1)::int AS sections_new,
               count(*) FILTER (WHERE previous_rqi IS NOT NULL AND round(previous_rqi) <> round(rqi))::int AS condition_changes,
               round(avg(rqi))::int AS avg_rqi
        FROM snapshot_changes GROUP BY day
      ), potholes_by_day AS (
        SELECT e.occurred_at::date day, count(*)::int pothole_signals
        FROM road_events e JOIN journeys j ON j.id=e.journey_id
        WHERE e.type='POTHOLE' AND j.accepted_at IS NOT NULL AND j.quality_status IN ('LEGACY_APPROVED','APPROVED')
        GROUP BY e.occurred_at::date
      ), all_days AS (SELECT day FROM roads_by_day UNION SELECT day FROM potholes_by_day)
      SELECT d.day::text day, coalesce(r.segments_updated,0)::int AS "segmentsUpdated",
             coalesce(r.sections_new,0)::int AS "sectionsNew", coalesce(r.condition_changes,0)::int AS "conditionChanges",
             r.avg_rqi AS "avgRqi", coalesce(p.pothole_signals,0)::int AS "potholeSignals",
             coalesce(p.pothole_signals,0)::int AS "eventCount"
      FROM all_days d LEFT JOIN roads_by_day r USING(day) LEFT JOIN potholes_by_day p USING(day)
      ORDER BY d.day ASC
    `)) as unknown as Array<{ day: string }>;

    return c.json(
      {
        ok: true,
        earliest: rows[0]?.day ?? null,
        latest: rows[rows.length - 1]?.day ?? null,
        days: rows,
      },
      200,
      CACHE,
    );
  } catch (err) {
    console.error('[public/timeline] query error:', err);
    return c.json({ ok: false, error: 'Failed to load timeline.' }, 500);
  }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
// Headline aggregates for the public panel: how much road India has scored.
// Only non-identifying totals — nothing device- or journey-specific.

router.get('/stats', async (c) => {
  try {
    const rows = (await db.execute(sql`
      SELECT (SELECT count(*) FROM road_segments)::int              AS "segments",
             (SELECT count(*) FROM road_events e JOIN journeys j ON j.id=e.journey_id WHERE j.accepted_at IS NOT NULL AND j.quality_status IN ('LEGACY_APPROVED', 'APPROVED'))::int AS "events",
             (SELECT count(*) FROM journeys WHERE accepted_at IS NOT NULL AND quality_status IN ('LEGACY_APPROVED', 'APPROVED'))::int AS "journeys",
             (SELECT count(DISTINCT day) FROM segment_snapshots)::int AS "daysOfData",
             (SELECT round(avg(current_rqi))::int FROM road_segments) AS "avgRqi",
             (SELECT coalesce(round(sum(distance_m) / 1000)::int, 0) FROM journeys WHERE accepted_at IS NOT NULL AND quality_status IN ('LEGACY_APPROVED', 'APPROVED'))
                                                                    AS "kmRidden",
             (SELECT max(last_updated_at) FROM road_segments)::text AS "lastUpdatedAt"
    `)) as unknown as Array<Record<string, unknown>>;

    return c.json({ ok: true, stats: rows[0] ?? null }, 200, CACHE);
  } catch (err) {
    console.error('[public/stats] query error:', err);
    return c.json({ ok: false, error: 'Failed to load stats.' }, 500);
  }
});

router.get(
  '/leaderboard',
  zValidator('query', z.object({ period: z.enum(['monthly', 'lifetime']).default('monthly'), limit: z.coerce.number().int().min(1).max(100).default(50) })),
  async (c) => {
    const { period, limit } = c.req.valid('query');
    try {
      const rows = await db.execute(sql`
        SELECT u.id, u.name,
               round(sum(mapped.distance_m) / 1000.0, 2)::float AS "mappedKm",
               count(j.id)::int AS "journeyCount",
               min(j.started_at)::text AS "contributingSince",
               max(j.ended_at)::text AS "lastContributionAt"
        FROM users u
        JOIN journeys j ON j.user_id = u.id
        JOIN LATERAL (
          SELECT coalesce(sum((segment->>'lengthM')::numeric), 0) AS distance_m
          FROM journey_raw jr
          LEFT JOIN LATERAL jsonb_array_elements(coalesce(jr.payload->'segments', '[]'::jsonb)) segment ON true
          WHERE jr.journey_id = j.id AND segment ? 'lengthM'
        ) mapped ON true
        WHERE u.public_leaderboard = true
          AND j.accepted_at IS NOT NULL
          ${period === 'monthly' ? sql`AND j.ended_at >= date_trunc('month', now())` : sql``}
        GROUP BY u.id, u.name
        HAVING sum(mapped.distance_m) > 0
        ORDER BY sum(mapped.distance_m) DESC, u.id ASC
        LIMIT ${limit}
      `);
      return c.json({ ok: true, period, contributors: rows }, 200, CACHE);
    } catch (err) {
      console.error('[public/leaderboard]', err);
      return c.json({ ok: false, error: 'Failed to load leaderboard.' }, 500);
    }
  },
);

router.get('/contributors/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) return c.json({ ok: false, error: 'Invalid contributor.' }, 400);
  const rows = await db.execute(sql`
    SELECT u.id, u.name,
           round(sum(mapped.distance_m) / 1000.0, 2)::float AS "mappedKm",
           count(j.id)::int AS "journeyCount",
           min(j.started_at)::text AS "contributingSince",
           max(j.ended_at)::text AS "lastContributionAt"
    FROM users u JOIN journeys j ON j.user_id = u.id
    JOIN LATERAL (
      SELECT coalesce(sum((segment->>'lengthM')::numeric), 0) AS distance_m
      FROM journey_raw jr
      LEFT JOIN LATERAL jsonb_array_elements(coalesce(jr.payload->'segments', '[]'::jsonb)) segment ON true
      WHERE jr.journey_id = j.id AND segment ? 'lengthM'
    ) mapped ON true
    WHERE u.id = ${id} AND u.public_leaderboard = true AND j.accepted_at IS NOT NULL
    GROUP BY u.id, u.name
  `);
  if (!rows[0]) return c.json({ ok: false, error: 'Contributor not found.' }, 404);
  return c.json({ ok: true, contributor: rows[0] }, 200, CACHE);
});

router.get('/contributors', zValidator('query', z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })), async (c) => {
  const rows = await db.execute(sql`
    SELECT u.id, u.name,
           round(sum(mapped.distance_m) / 1000.0, 2)::float AS "mappedKm",
           count(j.id)::int AS "journeyCount",
           min(j.started_at)::text AS "contributingSince",
           max(j.ended_at)::text AS "lastContributionAt"
    FROM users u JOIN journeys j ON j.user_id = u.id
    JOIN LATERAL (
      SELECT coalesce(sum((segment->>'lengthM')::numeric), 0) AS distance_m
      FROM journey_raw jr
      LEFT JOIN LATERAL jsonb_array_elements(coalesce(jr.payload->'segments', '[]'::jsonb)) segment ON true
      WHERE jr.journey_id = j.id AND segment ? 'lengthM'
    ) mapped ON true
    WHERE u.public_leaderboard = true AND j.accepted_at IS NOT NULL
    GROUP BY u.id, u.name
    HAVING sum(mapped.distance_m) > 0
    ORDER BY sum(mapped.distance_m) DESC, u.id ASC
    LIMIT ${c.req.valid('query').limit}
  `);
  return c.json({ ok: true, contributors: rows }, 200, CACHE);
});

router.post('/feedback', feedbackRateLimitMiddleware, zValidator('json', z.object({
  name: z.string().max(80).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  category: z.string().min(1).max(50),
  description: z.string().min(1).max(2000),
  source: z.enum(['website', 'mobile']),
  deviceOs: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
})), async (c) => {
  const body = c.req.valid('json');
  
  // Combine client-provided location with server-detected IP country
  const clientLocation = body.location?.trim() || null;
  const ipCountry = c.req.header('cf-ipcountry') || c.req.header('x-vercel-ip-country') || null;
  const finalLocation = clientLocation && ipCountry ? `${clientLocation} (${ipCountry})` : (clientLocation || ipCountry || null);

  await db.insert(feedbacks).values({
    name: body.name?.trim() || null,
    email: body.email?.trim() || null,
    category: body.category.trim(),
    description: body.description.trim(),
    source: body.source,
    deviceOs: body.deviceOs?.trim() || null,
    location: finalLocation,
  });
  return c.json({ ok: true });
});

router.get('/contracts', async (c) => {
  try {
    const rows = await db.execute(sql`
      SELECT rc.id, rc.road_name AS "roadName", rc.city, rc.ward,
             rc.tender_reference AS "tenderReference", rc.details,
             rc.start_date::text AS "startDate", rc.end_date::text AS "endDate",
             rc.budget, rc.status, rc.guarantee_until::text AS "guaranteeUntil",
             rc.notes, rc.geometry, rc.published_at::text AS "publishedAt",
             c.id AS "contractorId", c.name AS "contractorName",
             c.registration_number AS "contractorRegistrationNumber"
      FROM road_contracts rc JOIN contractors c ON c.id = rc.contractor_id
      WHERE rc.published = true
      ORDER BY rc.published_at DESC NULLS LAST, rc.id DESC
      LIMIT 1000
    `);
    return c.json({ ok: true, contracts: rows }, 200, CACHE);
  } catch (err) {
    console.error('[public/contracts]', err);
    return c.json({ ok: false, error: 'Failed to load contracts.' }, 500);
  }
});

export { router as publicRoadsRouter };
