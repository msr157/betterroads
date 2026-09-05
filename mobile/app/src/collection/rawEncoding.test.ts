import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync, strFromU8 } from 'fflate';
import { gzipSync, strToU8 } from 'fflate';

test('deterministic gzip contains delta timestamps and no identity/location', () => {
  const body = { formatVersion: 1, windowId: 'window', timeBaseUs: 100, accelerometer: [[0, 1, 2, 3]], gyroscope: [[20, .1, .2, .3]] };
  const first = gzipSync(strToU8(JSON.stringify(body)), { level: 6, mtime: 0 });
  const second = gzipSync(strToU8(JSON.stringify(body)), { level: 6, mtime: 0 });
  assert.deepEqual(first, second);
  const decoded = strFromU8(gunzipSync(first));
  assert.deepEqual(JSON.parse(decoded), body);
  for (const forbidden of ['deviceUuid', 'userId', 'latitude', 'longitude', 'sessionId']) assert.equal(decoded.includes(forbidden), false);
});
