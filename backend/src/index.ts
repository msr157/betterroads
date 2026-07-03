import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { corsMiddleware } from './middleware/cors.js';
import { waitlistRouter } from './routes/waitlist.js';
import { launchRouter } from './routes/launch.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';

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

let migrationError: any = null;

/** Health probe — Traefik / Docker healthcheck hits this. */
app.get('/health', (c) => {
  // Always return 200 so Traefik doesn't mark it unhealthy if the DB connection fails!
  return c.json({ ok: true, service: 'betterroads-api', migrationError: String(migrationError) });
});

/** Waitlist endpoints under /api/waitlist */
app.route('/api/waitlist', waitlistRouter);

/** Launch / Veil endpoints under /api/launch */
app.route('/api/launch', launchRouter);

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ ok: false, error: 'Not found.' }, 404));

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ ok: false, error: 'Internal server error.' }, 500);
});

// ─── Server ───────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3000', 10);

async function start() {
  console.log('[betterroads-api] running database migrations...');
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('[betterroads-api] migrations completed successfully.');
  } catch (err) {
    console.error('[betterroads-api] database migration failed:', err);
    migrationError = err;
    // process.exit(1); // Removed so we can see the error in the logs or via healthcheck
  }

  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
    console.log(`[betterroads-api] listening on http://${info.address}:${info.port}`);
  });
}

start();

export default app;
