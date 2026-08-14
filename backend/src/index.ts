import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { corsMiddleware } from './middleware/cors.js';
import { waitlistRouter } from './routes/waitlist.js';
import { travelDataRouter } from './routes/traveldata.js';
import { publicRoadsRouter } from './routes/publicRoads.js';
import { adminRouter } from './routes/admin.js';
import { mobileAuthRouter } from './routes/mobileAuth.js';
import { bootstrapAdministrator } from './lib/auth.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db/index.js';

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono();
const release = 'device-identity-v2';

// ─── Global middleware ────────────────────────────────────────────────────────

// Structured request logging.
app.use('*', logger());

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.).
app.use('*', secureHeaders());

// CORS — configured via CORS_ORIGINS env var.
app.use('*', corsMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Internal /health is used by Docker healthcheck, /api/health is used for debugging */
app.get('/health', (c) => {
  return c.json({ ok: true, service: 'betterroads-api', release });
});
app.get('/api/health', (c) => {
  return c.json({ ok: true, service: 'betterroads-api', release });
});

/** Waitlist endpoints under /api/waitlist */
app.route('/api/waitlist', waitlistRouter);

/**
 * Mobile ingestion — POST /user/mobile/traveldata (spec path) with an
 * /api-prefixed alias so it also works through the Traefik /api route.
 */
app.route('/user/mobile', travelDataRouter);
app.route('/api/user/mobile', travelDataRouter);
app.route('/api/mobile', mobileAuthRouter);

/** Public map + timeline read API */
app.route('/api/public', publicRoadsRouter);

/** Internal admin API (bearer-token protected, see routes/admin.ts) */
app.route('/api/admin', adminRouter);

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ ok: false, error: 'Not found.' }, 404));

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ ok: false, error: 'Internal server error.' }, 500);
});

// ─── Server ───────────────────────────────────────────────────────────────────

let startupError: string | null = null;

async function start() {
  console.log('[betterroads-api] running database migrations...');
  await migrate(db, {
    migrationsFolder: './migrations',
    migrationsSchema: 'public',
    migrationsTable: 'betterroads_drizzle_migrations',
  });
  console.log('[betterroads-api] migrations completed successfully.');
  await bootstrapAdministrator();
}

start().catch((err) => {
  console.error('[betterroads-api] startup failed:', err);
  startupError = err instanceof Error ? err.stack || err.message : String(err);
});

// Always serve, even if migrations failed, so we can see the error!
const port = parseInt(process.env.PORT ?? '3000', 10);
app.get('/api/debug/startup-error', (c) => c.json({ 
  error: startupError,
  databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') 
}));

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`[betterroads-api] listening on http://${info.address}:${info.port}`);
});

export default app;
