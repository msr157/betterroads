import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { waitlistSignups } from '../db/schema.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';

const router = new Hono();

// ─── Validation schema ────────────────────────────────────────────────────────

const joinSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address.')
    .max(254, 'Email address is too long.')
    .transform((v) => v.toLowerCase().trim()),
  name: z.string().max(80).trim().optional().default(''),
  city: z.string().max(80).trim().optional().default(''),
  /** Honeypot field — bots fill it, humans leave it empty. */
  company: z.string().optional().default(''),
});

// ─── Body size guard ─────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 4_096;

// ─── Helper: get display count ────────────────────────────────────────────────

async function getDisplayCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(waitlistSignups);
  const real = result[0]?.count ?? 0;
  const baseline = parseInt(process.env.SIGNUP_BASELINE ?? '0', 10) || 0;
  return real + baseline;
}

// ─── POST /join ───────────────────────────────────────────────────────────────

router.post(
  '/join',
  rateLimitMiddleware,
  zValidator('json', joinSchema, (result, c) => {
    if (!result.success) {
      const first = result.error.issues[0];
      return c.json({ ok: false, error: first?.message ?? 'Invalid request.' }, 400);
    }
  }),
  async (c) => {
    // Body size check (content-length header is advisory — check it early).
    const bodyLength = Number(c.req.header('content-length') ?? 0);
    if (!bodyLength || bodyLength > MAX_BODY_BYTES) {
      return c.json({ ok: false, error: 'Invalid request.' }, 413);
    }

    const { email, name, city, company } = c.req.valid('json');

    // Honeypot — bot filled the hidden field. Pretend success, store nothing.
    if (company) {
      return c.json({ ok: true, already: false, count: await getDisplayCount() });
    }

    try {
      await db.insert(waitlistSignups).values({
        email,
        name: name || null,
        city: city || null,
      });

      return c.json({ ok: true, already: false, count: await getDisplayCount() });
    } catch (err: unknown) {
      // Unique constraint violation = duplicate email.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        return c.json({ ok: true, already: true, count: await getDisplayCount() });
      }
      console.error('[waitlist/join] DB error:', err);
      return c.json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  },
);

// ─── GET /count ───────────────────────────────────────────────────────────────

router.get('/count', async (c) => {
  try {
    const count = await getDisplayCount();
    return c.json(
      { count },
      200,
      // Allow CDN/Cloudflare to cache the count for 30s; serve stale for 60s.
      { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    );
  } catch (err) {
    console.error('[waitlist/count] DB error:', err);
    return c.json({ count: 0 }, 500);
  }
});

export { router as waitlistRouter };
