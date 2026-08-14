import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRqi, haversineM } from './sensorEngine';

test('RQI is bounded and penalizes roughness and events', () => {
  assert.equal(computeRqi(0, 0), 100);
  assert.ok(computeRqi(2, 0) < 100);
  assert.ok(computeRqi(2, 2) < computeRqi(2, 0));
  assert.equal(computeRqi(100, 100), 10);
});

test('haversine distance is zero for the same point and plausible for one degree', () => {
  assert.equal(haversineM(20, 70, 20, 70), 0);
  assert.ok(Math.abs(haversineM(0, 0, 0, 1) - 111_195) < 100);
});
