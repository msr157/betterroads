import assert from 'node:assert/strict';
import test from 'node:test';
import { distribution, extractFeatureVectorV1, type FeatureAccelSample, type FeatureGyroSample } from './features';

test('distribution statistics are deterministic', () => {
  const stats = distribution([-2, -1, 0, 1, 2]);
  assert.equal(stats.mean, 0);
  assert.equal(stats.median, 0);
  assert.equal(stats.peakToPeak, 4);
  assert.equal(stats.zeroCrossings, 1);
  assert.ok(Math.abs(stats.rms - Math.sqrt(2)) < 1e-12);
});

test('extracts dominant frequency and contains no identity or absolute location', () => {
  const start = 1_000;
  const accel: FeatureAccelSample[] = [];
  const gyro: FeatureGyroSample[] = [];
  for (let index = 0; index <= 100; index += 1) {
    const t = start + index * 20;
    const wave = Math.sin(2 * Math.PI * 5 * index / 50);
    accel.push({ t, verticalMs2: wave, horizontalMs2: 0.2, dynamicMagnitudeMs2: Math.abs(wave), mountStable: true });
    gyro.push({ t, x: 0.01, y: 0.02, z: 0.03 });
  }
  const features = extractFeatureVectorV1(accel, gyro, { startedAt: start, endedAt: start + 2_000, speedKmh: 25 });
  assert.ok(Math.abs(features.frequency.dominantFrequencyHz - 5) < 0.5);
  assert.ok(features.frequency.energy5To10Hz > features.frequency.energy10To20Hz);
  const serialized = JSON.stringify(features);
  for (const forbidden of ['latitude', 'longitude', 'deviceUuid', 'userId', 'routeId', 'sessionId']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('reports missingness instead of fabricating across long sensor gaps', () => {
  const accel: FeatureAccelSample[] = [
    { t: 0, verticalMs2: 0, horizontalMs2: 0, dynamicMagnitudeMs2: 0, mountStable: true },
    { t: 20, verticalMs2: 0, horizontalMs2: 0, dynamicMagnitudeMs2: 0, mountStable: true },
    { t: 1_000, verticalMs2: 0, horizontalMs2: 0, dynamicMagnitudeMs2: 0, mountStable: true },
  ];
  const features = extractFeatureVectorV1(accel, [], { startedAt: 0, endedAt: 1_000 });
  assert.ok(features.context.accelerometerMissingRatio > 0.8);
  assert.equal(features.context.gyroscopeMissingRatio, 1);
});
