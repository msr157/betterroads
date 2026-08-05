import { cors } from 'hono/cors';

/**
 * CORS origins that are permitted to call this API.
 *
 * Reads from CORS_ORIGINS (comma-separated), falling back to a safe
 * default that allows local Vite dev + production domains.
 */
function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  // Safe default: local dev only. In production always set CORS_ORIGINS.
  return ['http://localhost:5173', 'http://localhost:4173'];
}

export const corsMiddleware = cors({
  origin: allowedOrigins(),
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
});
