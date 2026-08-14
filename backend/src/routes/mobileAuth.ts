import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { devices, journeys, userSessions, users } from '../db/schema.js';
import { createUserSession, hashToken, bearerToken, resolveUserSession } from '../lib/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';

const router = new Hono();
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GENDERS = ['male', 'female', 'non-binary', 'self-described', 'prefer-not-to-say'] as const;

type GoogleClaims = { sub: string; email: string; name?: string; aud: string; iss: string; exp: string; email_verified: string };
type TokenVerifier = (idToken: string) => Promise<GoogleClaims>;

let tokenVerifier: TokenVerifier | null = null;

export function setGoogleTokenVerifierForTests(verifier: TokenVerifier | null): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Test verifier is unavailable in production.');
  tokenVerifier = verifier;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  if (tokenVerifier) return tokenVerifier(idToken);
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new Error('Google rejected the ID token.');
  const claims = (await response.json()) as GoogleClaims;
  const allowed = (process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_ANDROID_CLIENT_IDS ?? process.env.GOOGLE_ANDROID_CLIENT_ID ?? '')
    .split(',').map((v) => v.trim()).filter(Boolean);
  if (allowed.length === 0) throw new Error('Google OAuth is not configured.');
  if (!allowed.includes(claims.aud) || !GOOGLE_ISSUERS.has(claims.iss) || claims.email_verified !== 'true' || Number(claims.exp) * 1000 <= Date.now()) {
    throw new Error('Invalid Google ID token claims.');
  }
  if (!claims.sub || !claims.email) throw new Error('Google token is missing identity claims.');
  return claims;
}

function publicUser(user: typeof users.$inferSelect) {
  let age: number | null = null;
  if (user.dateOfBirth) {
    const [year, month, day] = user.dateOfBirth.split('-').map(Number);
    const now = new Date();
    age = now.getUTCFullYear() - year;
    if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age--;
  }
  return { id: user.id, name: user.name, email: user.email, dateOfBirth: user.dateOfBirth, age, gender: user.gender,
    genderSelfDescription: user.genderSelfDescription, city: user.city, publicLeaderboard: user.publicLeaderboard };
}

router.post('/auth/google', rateLimitMiddleware, zValidator('json', z.object({ idToken: z.string().min(100).max(10_000) })), async (c) => {
  try {
    const claims = await verifyGoogleIdToken(c.req.valid('json').idToken);
    const email = claims.email.trim().toLowerCase();
    const [existingBySubject] = await db.select().from(users).where(eq(users.googleSubject, claims.sub)).limit(1);
    if (existingBySubject && existingBySubject.email !== email) {
      return c.json({ ok: false, error: 'The Google account email no longer matches this account.' }, 409);
    }
    let user = existingBySubject;
    if (!user) {
      const [emailOwner] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (emailOwner) return c.json({ ok: false, error: 'This email is already linked to another Google account.' }, 409);
      [user] = await db.insert(users).values({ googleSubject: claims.sub, email, name: (claims.name || email.split('@')[0]).trim() }).returning();
    }
    const session = await createUserSession(user.id, c.req.header('user-agent'));
    return c.json({ ok: true, ...session, user: publicUser(user) });
  } catch (error) {
    console.error('[mobile/auth/google]', error);
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Google sign-in failed.' }, 401);
  }
});

router.use('*', async (c, next) => {
  const auth = await resolveUserSession(c.req.header('authorization'));
  if (!auth) return c.json({ ok: false, error: 'Invalid or expired session.' }, 401);
  c.set('auth' as never, auth as never);
  await next();
});

router.get('/me', async (c) => {
  const auth = c.get('auth' as never) as Awaited<ReturnType<typeof resolveUserSession>>;
  return c.json({ ok: true, user: publicUser(auth!.user) });
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().date().nullable().optional(),
  gender: z.enum(GENDERS).nullable().optional(),
  genderSelfDescription: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  publicLeaderboard: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.dateOfBirth && Date.parse(value.dateOfBirth) > Date.now()) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth cannot be in the future.' });
  if (value.gender === 'self-described' && !value.genderSelfDescription) ctx.addIssue({ code: 'custom', path: ['genderSelfDescription'], message: 'Please describe your gender.' });
});

router.put('/me', zValidator('json', profileSchema), async (c) => {
  const auth = c.get('auth' as never) as NonNullable<Awaited<ReturnType<typeof resolveUserSession>>>;
  const value = c.req.valid('json');
  const [user] = await db.update(users).set({ ...value, city: value.city || null, genderSelfDescription: value.gender === 'self-described' ? value.genderSelfDescription : null, updatedAt: sql`now()` }).where(eq(users.id, auth.user.id)).returning();
  return c.json({ ok: true, user: publicUser(user) });
});

router.post('/auth/logout', async (c) => {
  const token = bearerToken(c.req.header('authorization'))!;
  await db.update(userSessions).set({ revokedAt: sql`now()` }).where(and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt)));
  return c.json({ ok: true });
});

router.get('/sessions', async (c) => {
  const auth = c.get('auth' as never) as NonNullable<Awaited<ReturnType<typeof resolveUserSession>>>;
  const rows = await db.select({ id: userSessions.id, createdAt: userSessions.createdAt, lastUsedAt: userSessions.lastUsedAt, expiresAt: userSessions.expiresAt, userAgent: userSessions.userAgent })
    .from(userSessions).where(and(eq(userSessions.userId, auth.user.id), isNull(userSessions.revokedAt)));
  return c.json({ ok: true, sessions: rows });
});

router.delete('/sessions/:id', async (c) => {
  const auth = c.get('auth' as never) as NonNullable<Awaited<ReturnType<typeof resolveUserSession>>>;
  await db.update(userSessions).set({ revokedAt: sql`now()` }).where(and(eq(userSessions.id, c.req.param('id')), eq(userSessions.userId, auth.user.id)));
  return c.json({ ok: true });
});

router.post('/sessions/revoke-all', async (c) => {
  const auth = c.get('auth' as never) as NonNullable<Awaited<ReturnType<typeof resolveUserSession>>>;
  await db.update(userSessions).set({ revokedAt: sql`now()` }).where(and(eq(userSessions.userId, auth.user.id), isNull(userSessions.revokedAt)));
  return c.json({ ok: true });
});

router.delete('/me', zValidator('json', z.object({ confirmation: z.literal('DELETE') })), async (c) => {
  const auth = c.get('auth' as never) as NonNullable<Awaited<ReturnType<typeof resolveUserSession>>>;
  // Keep non-identifying road measurements, but erase all profile, session,
  // and ownership links. De-accepted rows no longer contribute to rankings.
  await db.transaction(async (tx) => {
    await tx.update(journeys).set({ userId: null, acceptedAt: null }).where(eq(journeys.userId, auth.user.id));
    await tx.update(devices).set({ userId: null }).where(eq(devices.userId, auth.user.id));
    await tx.delete(userSessions).where(eq(userSessions.userId, auth.user.id));
    await tx.delete(users).where(eq(users.id, auth.user.id));
  });
  return c.json({ ok: true });
});

export { router as mobileAuthRouter };
