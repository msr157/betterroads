import { Directory, File, Paths } from 'expo-file-system';
import { TRAVELDATA_ENDPOINT } from '@/config';
import type { TravelDataPayload } from '@/types';
import { clearToken, getCurrentUserId, getToken } from '@/auth';

/**
 * Journey upload with an on-disk retry queue. Payloads are written to files
 * (not AsyncStorage — a full trace can run to megabytes) and deleted only
 * after the server acknowledges. Uploads are idempotent on journey.id, so
 * retrying a payload the server already has is harmless.
 */

function queueDir(): Directory {
  const dir = new Directory(Paths.document, 'pending-journeys');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

type PostResult = 'accepted' | 'quarantined' | 'retry' | 'auth-expired' | 'rejected';
async function post(payload: TravelDataPayload): Promise<PostResult> {
  const token = await getToken();
  if (!token) return 'auth-expired';
  const res = await fetch(TRAVELDATA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  // Retain rejected payloads. In particular, a 409 may mean the journey ID
  // belongs to another account and must never be reported as uploaded.
  if (res.status === 400 || res.status === 409 || res.status === 422) return 'rejected';
  if (res.status === 401) { await clearToken(); return 'auth-expired'; }
  if (res.ok) {
    const body = await res.json().catch(() => ({})) as { status?: string };
    return body.status === 'quarantined' ? 'quarantined' : 'accepted';
  }
  return 'retry';
}

export type UploadResult = 'uploaded' | 'quarantined' | 'queued' | 'auth-expired' | 'rejected';

/** Upload now if possible; otherwise persist for a later flush. */
export async function uploadOrQueue(payload: TravelDataPayload): Promise<UploadResult> {
  const ownerId = await getCurrentUserId();
  let result: PostResult = 'retry';
  try {
    result = await post(payload);
    if (result === 'accepted') return 'uploaded';
    if (result === 'quarantined') return 'quarantined';
  } catch {
    // Offline — fall through to queueing.
  }
  const file = new File(queueDir(), `${payload.journey.id}.json`);
  file.write(JSON.stringify({ ownerId, payload }));
  if (result === 'auth-expired') return 'auth-expired';
  return result === 'rejected' ? 'rejected' : 'queued';
}

/** Retry everything in the queue; returns how many are still pending. */
export async function flushQueue(): Promise<number> {
  let pending = 0;
  const currentUserId = await getCurrentUserId();
  for (const entry of queueDir().list()) {
    if (!(entry instanceof File)) continue;
    try {
      const parsed = JSON.parse(await entry.text()) as { ownerId?: number; payload?: TravelDataPayload } | TravelDataPayload;
      const queued = 'payload' in parsed ? parsed : null;
      if (!queued || !queued.ownerId || queued.ownerId !== currentUserId) { pending += 1; continue; }
      const payload = queued.payload!;
      const result = await post(payload);
      if (result === 'accepted' || result === 'quarantined' || result === 'rejected') {
        entry.delete();
      } else {
        pending += 1;
      }
    } catch {
      pending += 1; // Still offline (or unreadable) — leave it for next time.
    }
  }
  return pending;
}

export async function pendingCount(): Promise<number> {
  return queueDir().list().filter((e) => e instanceof File).length;
}
