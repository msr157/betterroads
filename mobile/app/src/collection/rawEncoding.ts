import * as Crypto from 'expo-crypto';
import { gzipSync, strToU8 } from 'fflate';
import type { CompletedCollectionWindow } from './collectionEngine';
import type { CollectionSessionV3, RawObjectManifest } from '../types';

export const MAX_RAW_OBJECT_BYTES = 1_048_576;

export type EncodedRawObject = { manifest: RawObjectManifest; bytes: Uint8Array };
export type PreparedCollection = { payload: CollectionSessionV3; rawObjects: EncodedRawObject[] };

/** Deterministic, identity-free raw window encoding for controlled research only. */
export async function encodeRawWindows(windows: CompletedCollectionWindow[]): Promise<EncodedRawObject[]> {
  const encoded: EncodedRawObject[] = [];
  for (const completed of windows) {
    const objectId = Crypto.randomUUID();
    const timeBaseUs = Math.min(
      completed.rawAccel[0]?.monotonicUs ?? Number.POSITIVE_INFINITY,
      completed.rawGyro[0]?.monotonicUs ?? Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(timeBaseUs)) continue;
    const body = {
      formatVersion: 1,
      windowId: completed.window.windowId,
      timeBaseUs,
      // Integer microsecond deltas preserve cadence without account, device,
      // route, or absolute geographic identity inside the sensor object.
      accelerometer: completed.rawAccel.map((sample) => [
        sample.monotonicUs - timeBaseUs, sample.x, sample.y, sample.z,
        sample.verticalMs2, sample.horizontalMs2, sample.dynamicMagnitudeMs2,
        sample.mountStable ? 1 : 0,
      ]),
      gyroscope: completed.rawGyro.map((sample) => [
        sample.monotonicUs - timeBaseUs, sample.x, sample.y, sample.z,
      ]),
    };
    const bytes = gzipSync(strToU8(JSON.stringify(body)), { level: 6, mtime: 0 });
    if (bytes.byteLength > MAX_RAW_OBJECT_BYTES) {
      throw new Error(`Raw sensor window ${completed.window.windowId} exceeds the 1 MiB controlled-upload limit.`);
    }
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes).buffer);
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    encoded.push({
      manifest: {
        objectId, windowId: completed.window.windowId, byteSize: bytes.byteLength, sha256,
        contentType: 'application/json', contentEncoding: 'gzip', formatVersion: 1,
      },
      bytes,
    });
  }
  return encoded;
}
