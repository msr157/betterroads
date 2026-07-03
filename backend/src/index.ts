import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { corsMiddleware } from './middleware/cors.js';
import { waitlistRouter } from './routes/waitlist.js';

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono();

// ─── Global middleware ────────────────────────────────────────────────────────

// Structured request logging.
app.use('*', logger());

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.).
app.use('*', secureHeaders());

// CORS — configured via CORS_ORIGINS env var.
app.use('*', corsMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Health probe — Traefik / Docker healthcheck hits this. */
app.get('/health', (c) => c.json({ ok: true, service: 'betterroads-api' }));

/** Waitlist endpoints under /api/waitlist */
app.route('/api/waitlist', waitlistRouter);

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ ok: false, error: 'Not found.' }, 404));

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ ok: false, error: 'Internal server error.' }, 500);
});

// ─── Server ───────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3000', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[betterroads-api] listening on http://localhost:${info.port}`);
});

export default app;
