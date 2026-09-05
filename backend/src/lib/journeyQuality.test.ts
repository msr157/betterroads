import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateJourneyQuality } from './journeyQuality.js';

const t = 1_700_000_000_000;
const samples = Array.from({ length: 6 }, (_, i) => ({ lat: 19.076 + i * 0.0002, lon: 72.8777, timestamp: t + i * 5_000, accuracyM: 10 }));
const distanceM = 111;
const payload = {
  schemaVersion: 2 as const,
  journey: { startedAt: t, endedAt: t + 25_000, durationS: 25, movingDurationS: 25, distanceM },
  locationSamples: samples,
  segments: [{ lengthM: distanceM }],
  events: [],
};

test('approves consistent v2 evidence', () => {
  assert.equal(evaluateJourneyQuality(payload).status, 'APPROVED');
});

test('quarantines inaccurate v2 evidence', () => {
  const bad = { ...payload, locationSamples: samples.map((p) => ({ ...p, accuracyM: 30 })) };
  const result = evaluateJourneyQuality(bad);
  assert.equal(result.status, 'QUARANTINED');
  assert.ok(result.reasons.includes('SCORING_FIX_TOO_INACCURATE'));
});

test('legacy payloads remain eligible with conservative checks', () => {
  const result = evaluateJourneyQuality({ schemaVersion: 1, journey: payload.journey, segments: payload.segments, events: [] });
  assert.equal(result.status, 'LEGACY_APPROVED');
});
