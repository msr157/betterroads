import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { administrators, adminSessions, userSessions, users } from '../db/schema.js';

const scrypt = promisify(scryptCallback);
const USER_SESSION_DAYS = 90;
const ADMIN_SESSION_HOURS = 24;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production.');
  return 'betterroads-local-development-only';
}
export const hashToken = (token: string) => createHmac('sha256', sessionSecret()).update(token).digest('hex');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function newCredential() {
  return { id: randomUUID(), token: randomBytes(32).toString('base64url') };
}

export async function createUserSession(userId: number, userAgent?: string) {
  const credential = newCredential();
  const expiresAt = new Date(Date.now() + USER_SESSION_DAYS * 86_400_000);
  await db.insert(userSessions).values({
    id: credential.id,
    userId,
    tokenHash: hashToken(credential.token),
    expiresAt,
    userAgent: userAgent?.slice(0, 500) ?? null,
  });
  return { token: credential.token, expiresAt };
}

export async function createAdminSession(administratorId: number, userAgent?: string, ipAddress?: string) {
  const activeSessions = await db.select({ id: adminSessions.id })
    .from(adminSessions)
    .where(and(
      eq(adminSessions.administratorId, administratorId),
      isNull(adminSessions.revokedAt),
      gt(adminSessions.expiresAt, new Date())
    ))
    .orderBy(desc(adminSessions.createdAt));

  if (activeSessions.length >= 2) {
    const toRevoke = activeSessions.slice(1).map(s => s.id);
    if (toRevoke.length > 0) {
      await db.update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(inArray(adminSessions.id, toRevoke));
    }
  }

  const credential = newCredential();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 3_600_000);
  await db.insert(adminSessions).values({
    id: credential.id,
    administratorId,
    tokenHash: hashToken(credential.token),
    expiresAt,
    userAgent: userAgent?.slice(0, 500) ?? null,
    ipAddress: ipAddress?.slice(0, 100) ?? null,
  });
  return { token: credential.token, expiresAt };
}

export function bearerToken(header?: string): string | null {
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

export async function resolveUserSession(header?: string) {
  const token = bearerToken(header);
  if (!token) return null;
  const [row] = await db
    .select({ session: userSessions, user: users })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  await db.update(userSessions).set({ lastUsedAt: sql`now()` }).where(eq(userSessions.id, row.session.id));
  return row;
}

export async function resolveAdminSession(header?: string) {
  const token = bearerToken(header);
  if (!token) return null;
  const [row] = await db
    .select({ session: adminSessions, administrator: administrators })
    .from(adminSessions)
    .innerJoin(administrators, eq(adminSessions.administratorId, administrators.id))
    .where(and(eq(adminSessions.tokenHash, hashToken(token)), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  await db.update(adminSessions).set({ lastUsedAt: sql`now()` }).where(eq(adminSessions.id, row.session.id));
  return row;
}

export async function bootstrapAdministrator(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(administrators);
  if (count > 0) return;
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    throw new Error('No administrator exists; set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD.');
  }
  if (password.length < 12) throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
  await db.insert(administrators).values({
    username: username.trim(),
    displayName: (process.env.ADMIN_BOOTSTRAP_NAME ?? username).trim(),
    email: process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || null,
    passwordHash: await hashPassword(password),
  }).onConflictDoNothing();
  console.log(`[auth] bootstrapped administrator ${username}`);
}
