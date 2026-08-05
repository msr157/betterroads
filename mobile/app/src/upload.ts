import { Directory, File, Paths } from 'expo-file-system';
import { TRAVELDATA_ENDPOINT } from '@/config';
import type { TravelDataPayload } from '@/types';

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

async function post(payload: TravelDataPayload): Promise<boolean> {
  const res = await fetch(TRAVELDATA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  // 400 = the server rejected the payload as invalid; retrying the same bytes
  // can never succeed, so treat it as terminal and drop from the queue.
  if (res.status === 400) return true;
  return res.ok;
}

export type UploadResult = 'uploaded' | 'queued';

/** Upload now if possible; otherwise persist for a later flush. */
export async function uploadOrQueue(payload: TravelDataPayload): Promise<UploadResult> {
  try {
    if (await post(payload)) return 'uploaded';
  } catch {
    // Offline — fall through to queueing.
  }
  const file = new File(queueDir(), `${payload.journey.id}.json`);
  file.write(JSON.stringify(payload));
  return 'queued';
}

/** Retry everything in the queue; returns how many are still pending. */
export async function flushQueue(): Promise<number> {
  let pending = 0;
  for (const entry of queueDir().list()) {
    if (!(entry instanceof File)) continue;
    try {
      const payload = JSON.parse(await entry.text()) as TravelDataPayload;
      if (await post(payload)) {
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
