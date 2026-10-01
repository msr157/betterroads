import assert from 'node:assert/strict';
import test from 'node:test';
import { SensorClock } from './clock';
import { drainJournal, replaySensor, type JournalPage } from './journalReplay';

test('replays native SI-unit samples without applying Expo gravity conversion', () => {
  const clock = new SensorClock();
  let received: { x: number; y: number; z: number } | undefined;
  replaySensor(['a', 1_700_000_000_000, 42, 9.81, -1.25, 0.5], clock, (_epoch, _monotonic, value) => {
    received = value;
  });
  assert.deepEqual(received, { x: 9.81, y: -1.25, z: 0.5 });
});

test('drains complete pages and leaves a partial final line for a later retry', async () => {
  const pages: JournalPage[] = [
    { rows: Array.from({ length: 1000 }, () => ['a', 1_000, 1, 0, 0, 9.81]), offset: 32 },
    { rows: [], offset: 32 },
  ];
  const consumed: unknown[] = [];
  let calls = 0;
  await drainJournal(0, async () => pages[calls++]!, (row) => consumed.push(row), () => undefined);
  assert.equal(calls, 2);
  assert.equal(consumed.length, 1000);
});

test('rejects a native reader that does not advance its offset', async () => {
  await assert.rejects(
    drainJournal(4, async () => ({ rows: [['g', 1_000, 1, 0, 0, 0]], offset: 4 }), () => undefined, () => undefined),
    /could not be read/,
  );
});
