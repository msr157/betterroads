import type { Context, Next } from 'hono';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Maximum requests per IP per window. */
const MAX_HITS = 6;

/** Sliding window duration in milliseconds (1 minute). */
const WINDOW_MS = 60_000;

/**
 * Maximum number of distinct IPs tracked simultaneously.
 * If exceeded, stale entries are pruned. If still flooded after purging
 * (active attack with rotating IPs) the map is cleared entirely to prevent
 * unbounded memory growth.
 */
const MAX_TRACKED = 10_000;

// ─── In-memory store ─────────────────────────────────────────────────────────

/** Maps IP → sorted array of request timestamps within the current window. */
const hits = new Map<string, number[]>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function purgeStale(now: number): void {
  for (const [ip, timestamps] of hits) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) hits.delete(ip);
    else hits.set(ip, fresh);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  if (hits.size >= MAX_TRACKED) {
    purgeStale(now);
    // Still at capacity after purge — under active IP-rotation attack; reset.
    if (hits.size >= MAX_TRACKED) hits.clear();
  }

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

/**
 * Extract the real client IP.
 *
 * When TRUST_PROXY=0 we ignore X-Forwarded-For so that callers cannot spoof
 * it to bypass rate limiting. Set TRUST_PROXY=1 (default) when Traefik or
 * another trusted reverse proxy sits in front and sets this header.
 */
function clientIp(c: Context): string {
  if (process.env.TRUST_PROXY === '0') return 'direct';
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'local'
  );
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Per-route rate-limiter middleware.
 * Apply only to mutation endpoints (POST /waitlist/join).
 */
export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  const ip = clientIp(c);
  if (isRateLimited(ip)) {
    return c.json({ ok: false, error: 'Too many attempts. Please wait a minute.' }, 429);
  }
  return next();
}

