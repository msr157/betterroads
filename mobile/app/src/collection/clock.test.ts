import assert from 'node:assert/strict';
import test from 'node:test';
import { SensorClock } from './clock';

test('maps Expo seconds to epoch while preserving sensor intervals', () => {
  const clock = new SensorClock();
  const first = clock.map(100, 1_700_000_000_000);
  const second = clock.map(100.02, 1_700_000_000_021);
  assert.deepEqual(first, { monotonicUs: 100_000_000, epochMs: 1_700_000_000_000 });
  assert.equal(second?.monotonicUs, 100_020_000);
  assert.equal(second?.epochMs, 1_700_000_000_020);
  assert.ok(Math.abs(clock.snapshot().effectiveHz - 50) < 1e-6);
});

test('rejects duplicate, out-of-order, and invalid sensor timestamps', () => {
  const clock = new SensorClock();
  assert.ok(clock.map(10, 1_000));
  assert.equal(clock.map(10, 1_001), null);
  assert.equal(clock.map(9, 1_002), null);
  assert.equal(clock.map(Number.NaN, 1_003), null);
  assert.deepEqual(clock.snapshot(), {
    acceptedCount: 1,
    rejectedCount: 3,
    duplicateCount: 1,
    outOfOrderCount: 1,
    effectiveHz: 0,
    jitterMs: 0,
    estimatedClockDriftPpm: 0,
  });
});

test('reports cadence jitter and arrival-clock drift without changing sample time', () => {
  const clock = new SensorClock();
  clock.map(20, 10_000);
  clock.map(20.02, 10_021);
  clock.map(20.042, 10_044);
  const stats = clock.snapshot();
  assert.ok(stats.effectiveHz > 47 && stats.effectiveHz < 48);
  assert.ok(stats.jitterMs > 0);
  assert.ok(stats.estimatedClockDriftPpm > 0);
});

