import assert from 'node:assert/strict';
import test from 'node:test';
import { associateHotspots, recoveredEventAccuracy } from './potholeHotspots.js';

const event = (id: string, journeyId: string, lon: number) => ({ id, journeyId, lat: 19, lon, occurredAt: `2026-01-0${id}T00:00:00Z` });

test('groups accepted detections inside 20 metres and preserves first stable id', () => {
  const grouped = associateHotspots([event('1', 'a', 72), event('2', 'b', 72.0001)]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].id, 'ph:1');
  assert.equal(grouped[0].journeyIds.size, 2);
});

test('keeps detections outside the 20 metre boundary separate', () => {
  assert.equal(associateHotspots([event('1', 'a', 72), event('2', 'b', 72.00025)]).length, 2);
});

test('two detections from one journey do not become repeated evidence', () => {
  const [hotspot] = associateHotspots([event('1', 'a', 72), event('2', 'a', 72.0001)]);
  assert.equal(hotspot.eventIds.length, 2);
  assert.equal(hotspot.journeyIds.size, 1);
});

test('accuracy recovery requires a nearby timestamped GPS fix', () => {
  const detection = { lat: 19, lon: 72, timestamp: 10_000 };
  assert.equal(recoveredEventAccuracy(detection, [{ ...detection, timestamp: 14_999, accuracyM: 8 }])?.accuracyM, 8);
  assert.equal(recoveredEventAccuracy(detection, [{ ...detection, timestamp: 15_001, accuracyM: 8 }]), null);
});
