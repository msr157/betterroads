import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clampBboxToIndia } from '../lib/india.js';

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
                   s.event_count     AS "eventCount"
            FROM road_segments s
            JOIN LATERAL (
              SELECT rqi, sample_count
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
                   event_count  AS "eventCount"
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
        SELECT id, type, severity, occurred_at AS "occurredAt",
               lat, lon, speed_kmh AS "speedKmh", segment_key AS "segmentKey"
        FROM road_events
        WHERE lat BETWEEN ${minLat} AND ${maxLat}
          AND lon BETWEEN ${minLon} AND ${maxLon}
          ${from ? sql`AND occurred_at >= ${from}::date` : sql``}
          ${to ? sql`AND occurred_at < (${to}::date + interval '1 day')` : sql``}
          ${type ? sql`AND type = ${type.toUpperCase()}` : sql``}
        ORDER BY occurred_at DESC
        LIMIT ${MAX_ROWS}
      `);

      return c.json({ ok: true, events: rows }, 200, CACHE);
    } catch (err) {
      console.error('[public/events] query error:', err);
      return c.json({ ok: false, error: 'Failed to load events.' }, 500);
    }
  },
);

// ─── GET /timeline ────────────────────────────────────────────────────────────
// Bounds + per-day aggregates for the slider (range, tick marks, sparkline).

router.get('/timeline', async (c) => {
  try {
    const rows = (await db.execute(sql`
      SELECT day::text AS day,
             count(*)::int          AS "segmentsUpdated",
             round(avg(rqi))::int   AS "avgRqi",
             sum(event_count)::int  AS "eventCount"
      FROM segment_snapshots
      GROUP BY day
      ORDER BY day ASC
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
             (SELECT count(*) FROM road_events)::int                AS "events",
             (SELECT count(*) FROM journeys)::int                   AS "journeys",
             (SELECT count(DISTINCT day) FROM segment_snapshots)::int AS "daysOfData",
             (SELECT round(avg(current_rqi))::int FROM road_segments) AS "avgRqi",
             (SELECT coalesce(round(sum(distance_m) / 1000)::int, 0) FROM journeys)
                                                                    AS "kmRidden",
             (SELECT max(last_updated_at) FROM road_segments)::text AS "lastUpdatedAt"
    `)) as unknown as Array<Record<string, unknown>>;

    return c.json({ ok: true, stats: rows[0] ?? null }, 200, CACHE);
  } catch (err) {
    console.error('[public/stats] query error:', err);
    return c.json({ ok: false, error: 'Failed to load stats.' }, 500);
  }
});

export { router as publicRoadsRouter };
