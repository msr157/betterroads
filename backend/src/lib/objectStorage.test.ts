import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRawObjectKey, buildRawUploadHeaders } from './objectStorage.js';

test('generates physically vehicle-separated server object keys', () => {
  const base = {
    profileVersion: 'collector-v1',
    sessionId: '10000000-0000-4000-8000-000000000001',
    objectId: '20000000-0000-4000-8000-000000000002',
  };
  assert.match(buildRawObjectKey({ ...base, vehicleClass: 'CAR' }), /^sensor-data\/car\//);
  assert.match(buildRawObjectKey({ ...base, vehicleClass: 'BIKE' }), /^sensor-data\/bike\//);
  assert.match(buildRawObjectKey({ ...base, vehicleClass: 'AUTO_RICKSHAW' }), /^sensor-data\/auto-rickshaw\//);
});

test('rejects path injection in profile or identifiers', () => {
  assert.throws(() => buildRawObjectKey({
    vehicleClass: 'CAR', profileVersion: '../bike', sessionId: '10000000-0000-4000-8000-000000000001',
    objectId: '20000000-0000-4000-8000-000000000002',
  }));
});

test('upload contract includes every integrity/content header the client must send', () => {
  assert.deepEqual(buildRawUploadHeaders({ byteSize: 132, sha256: 'a'.repeat(64) }), {
    'content-type': 'application/json',
    'content-encoding': 'gzip',
    'content-length': '132',
    'x-amz-meta-sha256': 'a'.repeat(64),
  });
});
