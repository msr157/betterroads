import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { VehicleClass } from './vehicleProfiles.js';

const PREFIX: Record<VehicleClass, string> = {
  CAR: 'car', BIKE: 'bike', AUTO_RICKSHAW: 'auto-rickshaw', BUS: 'bus', TRUCK: 'truck', OTHER: 'unsupported',
};

type RawUploadSpec = {
  vehicleClass: VehicleClass;
  profileVersion: string;
  sessionId: string;
  objectId: string;
  byteSize: number;
  sha256: string;
};

let singleton: S3Client | null = null;

function config() {
  const endpoint = process.env.COLLECTION_S3_ENDPOINT?.trim();
  const bucket = process.env.COLLECTION_S3_BUCKET?.trim();
  const accessKeyId = process.env.COLLECTION_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.COLLECTION_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Collection object storage is not configured.');
  }
  return {
    endpoint, bucket, accessKeyId, secretAccessKey,
    region: process.env.COLLECTION_S3_REGION?.trim() || 'us-east-1',
    expiresS: Math.min(3_600, Math.max(60, Number(process.env.COLLECTION_S3_PRESIGN_TTL_S ?? 900))),
  };
}

function client(): S3Client {
  if (singleton) return singleton;
  const value = config();
  singleton = new S3Client({
    endpoint: value.endpoint,
    region: value.region,
    forcePathStyle: true,
    credentials: { accessKeyId: value.accessKeyId, secretAccessKey: value.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return singleton;
}

export function collectionObjectStorageConfigured(): boolean {
  try { config(); return true; } catch { return false; }
}

export function buildRawObjectKey(spec: Pick<RawUploadSpec, 'vehicleClass' | 'profileVersion' | 'sessionId' | 'objectId'>): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(spec.sessionId) || !uuid.test(spec.objectId)) throw new Error('Invalid raw-object identifier.');
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(spec.profileVersion)) throw new Error('Invalid profile version.');
  return `sensor-data/${PREFIX[spec.vehicleClass]}/${spec.profileVersion}/${spec.sessionId}/${spec.objectId}.json.gz`;
}

export function buildRawUploadHeaders(spec: Pick<RawUploadSpec, 'byteSize' | 'sha256'>): Record<string, string> {
  return {
    'content-type': 'application/json',
    'content-encoding': 'gzip',
    'content-length': String(spec.byteSize),
    'x-amz-meta-sha256': spec.sha256,
  };
}

export async function presignRawUpload(spec: RawUploadSpec): Promise<{
  objectKey: string;
  url: string;
  expiresInS: number;
  headers: Record<string, string>;
}> {
  const value = config();
  const objectKey = buildRawObjectKey(spec);
  const headers = buildRawUploadHeaders(spec);
  const command = new PutObjectCommand({
    Bucket: value.bucket,
    Key: objectKey,
    ContentLength: spec.byteSize,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Metadata: { sha256: spec.sha256 },
  });
  return {
    objectKey,
    url: await getSignedUrl(client(), command, {
      expiresIn: value.expiresS,
      signableHeaders: new Set(['content-type']),
      unhoistableHeaders: new Set(['x-amz-meta-sha256']),
    }),
    expiresInS: value.expiresS,
    headers,
  };
}

export async function verifyRawObject(objectKey: string, expectedSize: number, sha256: string): Promise<number> {
  const value = config();
  const response = await client().send(new HeadObjectCommand({ Bucket: value.bucket, Key: objectKey }));
  const observedSize = response.ContentLength ?? -1;
  if (observedSize !== expectedSize) throw new Error('RAW_OBJECT_SIZE_MISMATCH');
  if (response.Metadata?.sha256 !== sha256) throw new Error('RAW_OBJECT_CHECKSUM_METADATA_MISMATCH');
  if (response.ContentType !== 'application/json' || response.ContentEncoding !== 'gzip') {
    throw new Error('RAW_OBJECT_CONTENT_METADATA_MISMATCH');
  }
  return observedSize;
}

export async function deleteRawObject(objectKey: string): Promise<void> {
  const value = config();
  await client().send(new DeleteObjectCommand({ Bucket: value.bucket, Key: objectKey }));
}
