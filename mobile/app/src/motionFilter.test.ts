import assert from 'node:assert/strict';
import test from 'node:test';
import { MotionFilter } from './motionFilter';

const base = { lat: 19.076, lon: 72.8777, accuracyM: 8, speedKmh: 0 };

test('parked jitter never becomes moving', () => {
  const filter = new MotionFilter();
  for (let i = 0; i < 20; i++) {
    const update = filter.add({ ...base, t: 1_700_000_000_000 + i * 2_000, lat: base.lat + (i % 2) * 0.00001 });
    assert.equal(update.committed.length, 0);
  }
  assert.equal(filter.state, 'stationary');
});

test('slow consistent displacement commits buffered fixes', () => {
  const filter = new MotionFilter();
  let committed = 0;
  for (let i = 0; i < 6; i++) {
    committed += filter.add({ ...base, t: 1_700_000_000_000 + i * 5_000, lat: base.lat + i * 0.00006, speedKmh: 3 }).committed.length;
  }
  assert.equal(filter.state, 'moving');
  assert.ok(committed >= 3);
});

test('rejects out-of-order, inaccurate, and impossible fixes', () => {
  const filter = new MotionFilter();
  filter.add({ ...base, t: 1_700_000_000_000 });
  assert.equal(filter.add({ ...base, t: 1_699_999_999_000 }).rejectedReason, 'out-of-order');
  assert.equal(filter.add({ ...base, t: 1_700_000_001_000, accuracyM: 80 }).rejectedReason, 'weak-accuracy');
  assert.equal(filter.add({ ...base, t: 1_700_000_002_000, lat: base.lat + 0.1 }).rejectedReason, 'impossible-jump');
});

test('pauses at a long traffic signal and resumes through the movement gate', () => {
  const filter = new MotionFilter();
  const start = 1_700_000_000_000;
  for (let i = 0; i < 4; i++) {
    filter.add({ ...base, t: start + i * 3_000, lat: base.lat + i * 0.00008, speedKmh: 8 });
  }
  assert.equal(filter.state, 'moving');

  const stoppedLat = base.lat + 0.00024;
  for (let i = 1; i <= 7; i++) {
    filter.add({ ...base, t: start + 9_000 + i * 3_000, lat: stoppedLat, speedKmh: 0 });
  }
  assert.equal(filter.state, 'temporary-stop');

  let resumedPoints = 0;
  for (let i = 1; i <= 4; i++) {
    resumedPoints += filter.add({ ...base, t: start + 30_000 + i * 3_000, lat: stoppedLat + i * 0.00008, speedKmh: 8 }).committed.length;
  }
  assert.equal(filter.state, 'moving');
  assert.ok(resumedPoints >= 3);
});

test('weak fixes never become scoring points', () => {
  const filter = new MotionFilter();
  for (let i = 0; i < 8; i++) {
    const result = filter.add({ ...base, t: 1_700_000_000_000 + i * 3_000, lat: base.lat + i * 0.0001, speedKmh: 10, accuracyM: 40 });
    assert.equal(result.committed.length, 0);
  }
});
