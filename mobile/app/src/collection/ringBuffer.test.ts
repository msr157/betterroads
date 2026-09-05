import assert from 'node:assert/strict';
import test from 'node:test';
import { EncounterWindowManager, TimeRingBuffer } from './ringBuffer';

test('ring buffer keeps time-bounded ordered history', () => {
  const buffer = new TimeRingBuffer<{ t: number; value: number }>(100);
  assert.equal(buffer.push({ t: 100, value: 1 }), true);
  assert.equal(buffer.push({ t: 150, value: 2 }), true);
  assert.equal(buffer.push({ t: 150, value: 3 }), false);
  assert.equal(buffer.push({ t: 220, value: 4 }), true);
  assert.deepEqual(buffer.between(100, 300).map((x) => x.value), [2, 4]);
});

test('candidate encounters include pre/post time and merge close triggers', () => {
  const windows = new EncounterWindowManager();
  const first = windows.trigger(10_000, ['Z_DIFF']);
  assert.deepEqual(first, {
    startedAt: 8_500,
    triggerAt: 10_000,
    endsAt: 12_000,
    triggerReasons: ['Z_DIFF'],
  });
  const merged = windows.trigger(12_500, ['DYNAMIC_MAGNITUDE']);
  assert.equal(merged.startedAt, 8_500);
  assert.equal(merged.endsAt, 14_500);
  assert.deepEqual(merged.triggerReasons, ['DYNAMIC_MAGNITUDE', 'Z_DIFF']);
  assert.equal(windows.complete(14_499), null);
  assert.ok(windows.complete(14_500));
});

