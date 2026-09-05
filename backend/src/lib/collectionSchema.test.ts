import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionSessionV3Schema } from './collectionSchema.js';
import { validCollectionPayload } from './collectionTestFixture.js';

test('accepts a valid standard car collection payload', () => {
  assert.equal(collectionSessionV3Schema.safeParse(validCollectionPayload()).success, true);
});

test('rejects cross-vehicle profile, subtype, and mount combinations', () => {
  const payload = validCollectionPayload();
  payload.collection.vehicleClass = 'BIKE';
  const result = collectionSessionV3Schema.safeParse(payload);
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /Profile does not match vehicle class/);
    assert.match(messages, /Unsupported subtype/);
    assert.match(messages, /Unsupported mount/);
  }
});

test('rejects raw sensor object references in standard mode', () => {
  const payload = validCollectionPayload();
  payload.rawObjects.push({
    objectId: '50000000-0000-4000-8000-000000000005',
    windowId: payload.featureWindows[0]!.windowId,
    byteSize: 100,
    sha256: 'a'.repeat(64),
    contentType: 'application/json', contentEncoding: 'gzip', formatVersion: 1,
  });
  const result = collectionSessionV3Schema.safeParse(payload);
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error.issues.map((issue) => issue.message).join(' '), /STANDARD sessions cannot/);
});

test('requires vehicle-specific metadata and matching summary counts', () => {
  const payload = validCollectionPayload();
  delete payload.collection.vehicleMetadata.vehicleAgeBand;
  payload.quality.candidateCount = 0;
  const result = collectionSessionV3Schema.safeParse(payload);
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /vehicleAgeBand/);
    assert.match(messages, /Candidate count/);
  }
});

