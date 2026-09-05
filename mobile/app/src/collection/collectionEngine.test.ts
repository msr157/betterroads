import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectionEngine } from './collectionEngine';
import { STANDARD_GRAVITY_MS2 } from './orientation';
import { profileFor } from './vehicleProfiles';

function feed(engine: CollectionEngine, from: number, to: number, dynamicZ = 0) {
  for (let t = from; t <= to; t += 20) {
    engine.addGyroscope(t, t * 1_000, { x: 0, y: 0, z: 0 });
    engine.addAccelerometer(t, t * 1_000, { x: 0, y: 0, z: STANDARD_GRAVITY_MS2 + dynamicZ });
  }
}

test('stationary collection calibrates but creates no candidate or normal windows', () => {
  const engine = new CollectionEngine(profileFor('CAR'), (() => { let id = 0; return () => `id-${++id}`; })(), () => 0.5);
  feed(engine, 0, 10_000);
  assert.equal(engine.snapshot().mountCalibrated, true);
  assert.equal(engine.snapshot().candidateCount, 0);
  assert.equal(engine.completed.length, 0);
});

test('moving impact creates a neutral candidate with pre and post samples', () => {
  const engine = new CollectionEngine(profileFor('CAR'), (() => { let id = 0; return () => `id-${++id}`; })(), () => 0.5);
  feed(engine, 0, 3_200);
  engine.setMoving(true);
  feed(engine, 3_220, 4_000);
  feed(engine, 4_020, 4_020, 8);
  feed(engine, 4_040, 6_500);
  const candidate = engine.completed.find((entry) => entry.window.kind === 'CANDIDATE');
  assert.ok(candidate);
  assert.equal(candidate.window.startedAt, 2_520);
  // The 400 ms RMS gate remains active briefly after the peak, so those
  // adjacent triggers correctly merge and extend the post-trigger window.
  assert.ok(candidate.window.endedAt >= 6_020 && candidate.window.endedAt <= 6_500);
  assert.ok(candidate.rawAccel[0]!.t <= 2_540);
  assert.ok(candidate.rawAccel[candidate.rawAccel.length - 1]!.t >= 6_000);
  assert.equal(JSON.stringify(candidate.window).includes('POTHOLE'), false);
});

test('car and bike engines retain their own profile versions', () => {
  assert.notEqual(profileFor('CAR').profileVersion, profileFor('BIKE').profileVersion);
});
