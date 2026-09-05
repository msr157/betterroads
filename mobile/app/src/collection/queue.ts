import { Directory, File, Paths } from 'expo-file-system';
import { COLLECTION_ENDPOINT } from '@/config';
import { clearToken, getCurrentUserId, getToken } from '@/auth';
import { getDeviceUuid } from '@/deviceId';
import type { CollectionSessionV3, RawObjectManifest, VehicleClass } from '@/types';
import type { PreparedCollection } from './rawEncoding';

export type CollectionUploadResult = 'uploaded' | 'quarantined' | 'queued' | 'auth-expired' | 'rejected';
type PostResult = 'received' | 'quarantined' | 'retry' | 'auth-expired' | 'rejected';

type QueuedRawFile = { objectId: string; windowId: string; fileName: string };
type QueuedCollection = { ownerId: number | null; payload: CollectionSessionV3; rawFiles: QueuedRawFile[] };

function collectionQueueDir(): Directory {
  const directory = new Directory(Paths.document, 'pending-collections-v3');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

function rawSessionDir(sessionId: string): Directory {
  return new Directory(collectionQueueDir(), `${sessionId}.raw`);
}

export async function collectionProfileIsCurrent(vehicleClass: VehicleClass, localProfileVersion: string): Promise<boolean> {
  const token = await getToken();
  if (!token) return true;
  try {
    const deviceUuid = await getDeviceUuid();
    const response = await fetch(`${COLLECTION_ENDPOINT}/config?vehicleClass=${encodeURIComponent(vehicleClass)}&deviceUuid=${encodeURIComponent(deviceUuid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return true;
    const body = await response.json() as { profile?: { profileVersion?: string } };
    return !body.profile?.profileVersion || body.profile.profileVersion === localProfileVersion;
  } catch {
    return true;
  }
}

export async function controlledCollectionIsAuthorized(vehicleClass: VehicleClass): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const deviceUuid = await getDeviceUuid();
    const response = await fetch(`${COLLECTION_ENDPOINT}/config?vehicleClass=${encodeURIComponent(vehicleClass)}&deviceUuid=${encodeURIComponent(deviceUuid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const body = await response.json() as { controlledAuthorized?: boolean };
    return body.controlledAuthorized === true;
  } catch { return false; }
}

async function request(path: string, body: unknown): Promise<Response | null> {
  const token = await getToken();
  if (!token) return null;
  return fetch(`${COLLECTION_ENDPOINT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function initBody(payload: CollectionSessionV3) {
  return {
    sessionId: payload.sessionId, device: payload.device, mode: payload.collection.mode,
    vehicleClass: payload.collection.vehicleClass, vehicleSubtype: payload.collection.vehicleSubtype,
    vehicleMetadata: payload.collection.vehicleMetadata, mountPosition: payload.collection.mountPosition,
    profileVersion: payload.collection.profileVersion, featureVersion: payload.collection.featureVersion,
    triggerVersion: payload.collection.triggerVersion, motionAlgorithmVersion: payload.collection.motionAlgorithmVersion,
    consentVersion: payload.collection.consentVersion, startedAt: payload.timing.startedAt,
  };
}

const terminalStatus = (status: number) => [400, 403, 409, 413, 422, 426].includes(status);

async function uploadRawObjects(payload: CollectionSessionV3, rawFiles: QueuedRawFile[]): Promise<PostResult | null> {
  if (payload.collection.mode === 'STANDARD') return payload.rawObjects.length === 0 && rawFiles.length === 0 ? null : 'rejected';
  if (payload.rawObjects.length === 0 || payload.rawObjects.length !== rawFiles.length) return 'rejected';
  const response = await request(`/sessions/${payload.sessionId}/raw-uploads`, { objects: payload.rawObjects });
  if (!response) return 'auth-expired';
  if (response.status === 401) { await clearToken(); return 'auth-expired'; }
  if (terminalStatus(response.status)) return 'rejected';
  if (!response.ok) return 'retry';
  const body = await response.json() as { uploads: Array<{ objectId: string; url: string; headers: Record<string, string> }> };
  const fileByObject = new Map(rawFiles.map((raw) => [raw.objectId, raw]));
  for (const upload of body.uploads) {
    const stored = fileByObject.get(upload.objectId);
    if (!stored) return 'rejected';
    const file = new File(rawSessionDir(payload.sessionId), stored.fileName);
    if (!file.exists) return 'rejected';
    const bytes = await file.bytes();
    const put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: bytes as unknown as BodyInit });
    if (!put.ok) return put.status >= 400 && put.status < 500 ? 'rejected' : 'retry';
  }
  return null;
}

async function postCollection(queued: QueuedCollection): Promise<PostResult> {
  const { payload, rawFiles } = queued;
  const init = await request('/sessions/init', initBody(payload));
  if (!init) return 'auth-expired';
  if (init.status === 401) { await clearToken(); return 'auth-expired'; }
  if (terminalStatus(init.status)) return 'rejected';
  if (!init.ok) return 'retry';

  const rawResult = await uploadRawObjects(payload, rawFiles);
  if (rawResult) return rawResult;
  const complete = await request(`/sessions/${payload.sessionId}/complete`, payload);
  if (!complete) return 'auth-expired';
  if (complete.status === 401) { await clearToken(); return 'auth-expired'; }
  if (terminalStatus(complete.status)) return 'rejected';
  if (!complete.ok) return 'retry';
  const response = await complete.json().catch(() => ({})) as { status?: string };
  return response.status === 'quarantined' ? 'quarantined' : 'received';
}

function deleteQueuedFiles(file: File, payload: CollectionSessionV3): void {
  if (file.exists) file.delete();
  const rawDirectory = rawSessionDir(payload.sessionId);
  if (rawDirectory.exists) rawDirectory.delete();
}

export async function uploadCollectionOrQueue(prepared: PreparedCollection): Promise<CollectionUploadResult> {
  const { payload, rawObjects } = prepared;
  const rawDirectory = rawSessionDir(payload.sessionId);
  const rawFiles: QueuedRawFile[] = [];
  if (rawObjects.length > 0) {
    if (!rawDirectory.exists) rawDirectory.create({ intermediates: true });
    for (const raw of rawObjects) {
      const fileName = `${raw.manifest.objectId}.json.gz`;
      new File(rawDirectory, fileName).write(raw.bytes);
      rawFiles.push({ objectId: raw.manifest.objectId, windowId: raw.manifest.windowId, fileName });
    }
  }
  const queued: QueuedCollection = { ownerId: await getCurrentUserId(), payload, rawFiles };
  const file = new File(collectionQueueDir(), `${payload.sessionId}.json`);
  file.write(JSON.stringify(queued));
  let result: PostResult = 'retry';
  try { result = await postCollection(queued); } catch { result = 'retry'; }
  if (result === 'received' || result === 'quarantined' || result === 'rejected') deleteQueuedFiles(file, payload);
  if (result === 'received') return 'uploaded';
  if (result === 'quarantined') return 'quarantined';
  if (result === 'rejected') return 'rejected';
  if (result === 'auth-expired') return 'auth-expired';
  return 'queued';
}

export async function flushCollectionQueue(): Promise<number> {
  const ownerId = await getCurrentUserId();
  let pending = 0;
  for (const entry of collectionQueueDir().list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      const queued = JSON.parse(await entry.text()) as QueuedCollection;
      if (!ownerId || queued.ownerId !== ownerId || queued.payload.schemaVersion !== 3) { pending += 1; continue; }
      const result = await postCollection(queued);
      if (result === 'received' || result === 'quarantined' || result === 'rejected') deleteQueuedFiles(entry, queued.payload);
      else pending += 1;
    } catch { pending += 1; }
  }
  return pending;
}

export function pendingCollectionCount(): number {
  return collectionQueueDir().list().filter((entry) => entry instanceof File && entry.name.endsWith('.json')).length;
}

export type { RawObjectManifest };
