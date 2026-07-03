import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

/**
 * Raw postgres.js client.
 * max: 10 — conservative pool ceiling for a landing-page API.
 * idle_timeout: 20s — reclaim idle connections quickly.
 * connect_timeout: 10s — fail fast if Postgres is unreachable on boot.
 */
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/** Drizzle ORM instance shared across the app. */
export const db = drizzle(client, { schema });

export type Database = typeof db;
