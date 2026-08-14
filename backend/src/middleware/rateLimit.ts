import type { Context, Next } from 'hono';

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Maximum number of distinct IPs tracked simultaneously per bucket.
 * If exceeded, stale entries are pruned. If still flooded after purging
 * (active attack with rotating IPs) the map is cleared entirely to prevent
 * unbounded memory growth.
 */
const MAX_TRACKED = 10_000;

// ─── Per-bucket sliding-window limiter ───────────────────────────────────────

class SlidingWindowLimiter {
  /** Maps IP → sorted array of request timestamps within the current window. */
  private hits = new Map<string, number[]>();

  constructor(
    private maxHits: number,
    private windowMs: number,
  ) {}

  private purgeStale(now: number): void {
    for (const [ip, timestamps] of this.hits) {
      const fresh = timestamps.filter((t) => now - t < this.windowMs);
      if (fresh.length === 0) this.hits.delete(ip);
      else this.hits.set(ip, fresh);
    }
  }

  isRateLimited(ip: string): boolean {
    const now = Date.now();

    if (this.hits.size >= MAX_TRACKED) {
      this.purgeStale(now);
      // Still at capacity after purge — under active IP-rotation attack; reset.
      if (this.hits.size >= MAX_TRACKED) this.hits.clear();
    }

    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.hits.set(ip, recent);
    return recent.length > this.maxHits;
  }
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

function makeMiddleware(limiter: SlidingWindowLimiter) {
  return async function rateLimit(c: Context, next: Next): Promise<Response | void> {
    const ip = clientIp(c);
    if (limiter.isRateLimited(ip)) {
      return c.json({ ok: false, error: 'Too many attempts. Please wait a minute.' }, 429);
    }
    return next();
  };
}

/**
 * Strict limiter for human-triggered mutations (waitlist join, admin login):
 * 6 requests per IP per minute.
 */
export const rateLimitMiddleware = makeMiddleware(new SlidingWindowLimiter(6, 60_000));

/**
 * Ingestion limiter for the mobile upload endpoint — its own bucket with
 * headroom for the app's offline queue flushing many journeys at once on
 * reconnect, and for carrier CGNAT putting many riders behind one IP.
 */
export const ingestRateLimitMiddleware = makeMiddleware(new SlidingWindowLimiter(60, 60_000));

/** Global baseline spam protection for all APIs: 100 requests per IP per minute. */
export const globalApiRateLimitMiddleware = makeMiddleware(new SlidingWindowLimiter(100, 60_000));

/** Ultra-strict limiter for public feedback to prevent database spamming: 3 requests per IP per minute. */
export const feedbackRateLimitMiddleware = makeMiddleware(new SlidingWindowLimiter(3, 60_000));
