import { SensorClock } from './clock';
import type { Vector3 } from './orientation';

export type SensorRow = ['a' | 'g', number, number, number, number, number];
export type LocationRow = ['l', number, number, number, number, number, number | null, number | null];
export type MarkerRow = ['m', number, string, string];
export type JournalRow = SensorRow | LocationRow | MarkerRow;
export type JournalPage = { offset: number; rows: JournalRow[] };

/** Native accelerometer values already use m/s². Never apply Expo's g conversion here. */
export function replaySensor(row: SensorRow, clock: SensorClock, accept: (epochMs: number, monotonicUs: number, value: Vector3) => void): void {
  if (row.length !== 6 || (row[0] !== 'a' && row[0] !== 'g')) {
    throw new Error(`Invalid sensor row format: ${JSON.stringify(row)}`);
  }
  const [, epoch, timestamp, x, y, z] = row;
  if (![epoch, timestamp, x, y, z].every(Number.isFinite)) {
    throw new Error('Saved sensor data is invalid.');
  }
  const clocked = clock.map(timestamp, epoch);
  if (clocked) accept(clocked.epochMs, clocked.monotonicUs, { x, y, z });
}

/** Advance only after a full page was consumed; prevent corrupt/non-progressing bridge responses. */
export async function drainJournal(
  offset: number,
  read: (offset: number) => Promise<JournalPage>,
  consume: (row: JournalRow) => void,
  checkpoint: (offset: number) => void,
): Promise<void> {
  while (true) {
    const page = await read(offset);
    if (!Number.isSafeInteger(page.offset) || page.offset < offset || (page.rows.length > 0 && page.offset === offset)) {
      throw new Error('Saved journey could not be read. Its recording journal has been retained.');
    }
    for (const row of page.rows) consume(row);
    offset = page.offset;
    checkpoint(offset);
    if (page.rows.length < 1000) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
