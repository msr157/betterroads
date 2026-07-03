import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { waitlistSignups } from '../db/schema.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { isDisposableEmail } from '../lib/disposableEmail.js';
import { CONTRIBUTION_VALUES } from '../lib/contributions.js';

const router = new Hono();

// ─── Validation schema ────────────────────────────────────────────────────────

const joinSchema = z.object({
  email: z
    .string()
    // Normalise FIRST (trim + lowercase) so validation and de-duplication both
    // operate on the canonical form: "  ASHA@Gmail.com " → "asha@gmail.com".
    .trim()
    .toLowerCase()
    .pipe(
      z
        .string()
        .email('Please enter a valid email address.')
        .max(254, 'Email address is too long.')
        // Reject throwaway / temporary inbox providers.
        .refine((email) => !isDisposableEmail(email), {
          message: 'Please use a permanent email address — temporary inboxes aren’t allowed.',
        }),
    ),
  // Name is required — must be a real, non-empty value.
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(80, 'Name is too long.'),
  city: z.string().max(80).trim().optional().default(''),
  /**
   * Optional way to contribute. Empty string = none. Any other value must be a
   * known contribution slug; unknown values are rejected.
   */
  contribution: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || CONTRIBUTION_VALUES.has(v), {
      message: 'Invalid contribution option.',
    }),
  /** Optional WhatsApp number. */
  whatsapp: z.string().trim().max(32, 'WhatsApp number is too long.').optional().default(''),
  /** Optional free-text message. */
  message: z.string().trim().max(1000, 'Message is too long.').optional().default(''),
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

    const { email, name, city, contribution, whatsapp, message, company } = c.req.valid('json');

    // Honeypot — bot filled the hidden field. Pretend success, store nothing.
    if (company) {
      return c.json({ ok: true, already: false, count: await getDisplayCount() });
    }

    // ── Duplicate blocking ──────────────────────────────────────────────────
    // One email = one signup. We check first for a clean "already joined"
    // response, and rely on the UNIQUE index (waitlist_signups_email_idx) as
    // the race-safe backstop for two concurrent requests slipping past this
    // check. Email is already normalised to lowercase by the schema.
    const existing = await db
      .select({ id: waitlistSignups.id })
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ ok: true, already: true, count: await getDisplayCount() });
    }

    try {
      await db.insert(waitlistSignups).values({
        email,
        name,
        city: city || null,
        contribution: contribution || null,
        whatsapp: whatsapp || null,
        message: message || null,
      });

      return c.json({ ok: true, already: false, count: await getDisplayCount() });
    } catch (err: unknown) {
      // Backstop: a concurrent request inserted the same email between our
      // check and this insert. The UNIQUE index rejects it → treat as duplicate.
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
