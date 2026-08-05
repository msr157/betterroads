import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { corsMiddleware } from './middleware/cors.js';
import { waitlistRouter } from './routes/waitlist.js';
import { travelDataRouter } from './routes/traveldata.js';
import { publicRoadsRouter } from './routes/publicRoads.js';
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

/** Internal /health is used by Docker healthcheck, /api/health is used for debugging */
app.get('/health', (c) => {
  return c.json({ ok: true, service: 'betterroads-api', migrationError: String(migrationError) });
});
app.get('/api/health', (c) => {
  return c.json({ ok: true, service: 'betterroads-api', migrationError: String(migrationError) });
});

/** Waitlist endpoints under /api/waitlist */
app.route('/api/waitlist', waitlistRouter);

/**
 * Mobile ingestion — POST /user/mobile/traveldata (spec path) with an
 * /api-prefixed alias so it also works through the Traefik /api route.
 */
app.route('/user/mobile', travelDataRouter);
app.route('/api/user/mobile', travelDataRouter);

/** Public map + timeline read API */
app.route('/api/public', publicRoadsRouter);

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
    await migrate(db, {
      migrationsFolder: './migrations',
      migrationsSchema: 'public',
      migrationsTable: 'betterroads_drizzle_migrations',
    });
    console.log('[betterroads-api] migrations completed successfully.');
    migrationError = null;
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
