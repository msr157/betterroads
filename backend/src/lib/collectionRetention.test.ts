import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRetentionDays, shouldDeleteRawObject } from './collectionRetention.js';

const now = new Date('2026-09-01T00:00:00Z');
const candidate = (changes: Partial<Parameters<typeof shouldDeleteRawObject>[0]> = {}) => ({
  id: 'x', objectKey: 'sensor-data/car/v1/s/o.json.gz', state: 'VERIFIED',
  createdAt: new Date('2026-01-01T00:00:00Z'), completedAt: new Date('2026-01-02T00:00:00Z'), ...changes,
});

test('deletes expired or explicitly pending raw objects but retains metadata', () => {
  assert.equal(shouldDeleteRawObject(candidate(), now, 90), true);
  assert.equal(shouldDeleteRawObject(candidate({ completedAt: new Date('2026-08-20T00:00:00Z') }), now, 90), false);
  assert.equal(shouldDeleteRawObject(candidate({ state: 'DELETE_PENDING', completedAt: null }), now, 90), true);
  assert.equal(shouldDeleteRawObject(candidate({ state: 'DELETED' }), now, 90), false);
});

test('validates retention configuration', () => {
  assert.equal(parseRetentionDays(undefined), 90);
  assert.throws(() => parseRetentionDays('0'));
  assert.throws(() => parseRetentionDays('forever'));
});
