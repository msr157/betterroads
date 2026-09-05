import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCollectionQuality } from './collectionQuality.js';
import { validCollectionPayload } from './collectionTestFixture.js';

test('receives a valid quality-passing collection', () => {
  const result = evaluateCollectionQuality(validCollectionPayload());
  assert.equal(result.status, 'RECEIVED');
  assert.equal(result.hardFailure, undefined);
});

test('quarantines insufficient movement, cadence, and mount quality', () => {
  const payload = validCollectionPayload();
  payload.timing.movingDurationMs = 10_000;
  payload.journey.acceptedDistanceM = 50;
  payload.quality.effectiveAccelHz = 20;
  payload.quality.mountStableRatio = 0.2;
  const result = evaluateCollectionQuality(payload);
  assert.equal(result.status, 'QUARANTINED');
  assert.ok(result.reasons.includes('MOVING_DURATION_BELOW_20_SECONDS'));
  assert.ok(result.reasons.includes('ACCEPTED_DISTANCE_BELOW_100_METRES'));
  assert.ok(result.reasons.includes('ACCELEROMETER_CADENCE_OUTSIDE_40_60_HZ'));
  assert.ok(result.reasons.includes('MOUNT_STABLE_RATIO_BELOW_80_PERCENT'));
});

test('hard-rejects impossible location continuity', () => {
  const payload = validCollectionPayload();
  payload.locationSamples[2] = { ...payload.locationSamples[2]!, lat: 25 };
  assert.equal(evaluateCollectionQuality(payload).hardFailure, 'IMPOSSIBLE_LOCATION_JUMP');
});

test('hard-rejects feature windows outside session time', () => {
  const payload = validCollectionPayload();
  payload.featureWindows[0]!.startedAt = payload.timing.startedAt - 1;
  assert.equal(evaluateCollectionQuality(payload).hardFailure, 'WINDOW_OUTSIDE_SESSION_TIME');
});

