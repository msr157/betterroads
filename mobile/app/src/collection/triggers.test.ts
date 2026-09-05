import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrientedAcceleration } from './orientation';
import { CandidateTriggerDetector } from './triggers';
import { profileFor } from './vehicleProfiles';

function sample(t: number, verticalMs2: number, dynamicMagnitudeMs2 = Math.abs(verticalMs2), mountStable = true): OrientedAcceleration {
  return {
    t,
    raw: { x: 0, y: 0, z: 9.80665 + verticalMs2 },
    gravity: { x: 0, y: 0, z: 9.80665 },
    dynamic: { x: 0, y: 0, z: verticalMs2 },
    gravityMagnitude: 9.80665,
    verticalMs2,
    horizontalMs2: 0,
    dynamicMagnitudeMs2,
    mountStable,
    calibrated: mountStable,
  };
}

test('never emits candidates while motion or mount eligibility is false', () => {
  const detector = new CandidateTriggerDetector(profileFor('CAR'));
  detector.add(sample(0, 0), false);
  assert.equal(detector.add(sample(20, 20), false), null);
  assert.equal(detector.add(sample(40, 20, 20, false), true), null);
});

test('emits neutral trigger reasons without assigning a pothole class', () => {
  const detector = new CandidateTriggerDetector(profileFor('CAR'));
  for (let t = 0; t < 1_000; t += 20) detector.add(sample(t, 0.05), true);
  const result = detector.add(sample(1_000, 7), true);
  assert.ok(result);
  assert.ok(result.reasons.includes('Z_DIFF'));
  assert.ok(result.reasons.includes('DYNAMIC_MAGNITUDE'));
  assert.equal('type' in result, false);
});

test('vehicle detectors use their matching versioned profile', () => {
  const car = new CandidateTriggerDetector(profileFor('CAR'));
  const bike = new CandidateTriggerDetector(profileFor('BIKE'));
  assert.notEqual((car as any).profile.profileVersion, (bike as any).profile.profileVersion);
});

