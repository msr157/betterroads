import type { CollectionSessionV3 } from './collectionSchema.js';

const baseDistribution = {
  min: -1, max: 1, mean: 0, standardDeviation: 0.5, rms: 0.5, peakToPeak: 2,
  median: 0, mad: 0.25, p05: -0.9, p25: -0.5, p75: 0.5, p95: 0.9,
  crestFactor: 2, zeroCrossings: 5,
};

export function validCollectionPayload(): CollectionSessionV3 {
  const startedAt = 1_750_000_000_000;
  const locationSamples = Array.from({ length: 10 }, (_, index) => ({
    timestamp: startedAt + index * 3_000,
    lat: 19 + index * 0.0001,
    lon: 72.8,
    accuracyM: 8,
    speedKmh: 13.3,
  }));
  return {
    schemaVersion: 3,
    sessionId: '10000000-0000-4000-8000-000000000001',
    device: {
      uuid: '20000000-0000-4000-8000-000000000002',
      platform: 'android', model: 'Test Phone', osVersion: '16', appVersion: '2.0.0',
    },
    collection: {
      mode: 'STANDARD', vehicleClass: 'CAR', vehicleSubtype: 'SEDAN', vehicleMetadata: { vehicleAgeBand: '0_5_YEARS' },
      mountPosition: 'DASHBOARD', profileVersion: 'car-collector-v1', featureVersion: 'features-v1',
      triggerVersion: 'candidate-v1', motionAlgorithmVersion: 'motion-v2.0', consentVersion: 'collection-consent-v1',
    },
    timing: {
      startedAt, endedAt: startedAt + 30_000, movingDurationMs: 27_000, stationaryDurationMs: 3_000,
      sensorEpochOffsetMs: startedAt - 1_000_000, estimatedClockDriftPpm: 10,
    },
    journey: {
      acceptedDistanceM: 100.08, averageMovingSpeedKmh: 13.34,
      start: locationSamples[0]!, end: locationSamples[locationSamples.length - 1]!,
    },
    quality: {
      accelerometerSampleCount: 1_500, gyroscopeSampleCount: 1_500, effectiveAccelHz: 50, effectiveGyroHz: 50,
      accelMissingRatio: 0, gyroMissingRatio: 0, reliableFixCount: 10, rejectedFixCount: 0, meanAccuracyM: 8,
      mountStableRatio: 0.95, candidateCount: 1, suppressedCandidateCount: 0, normalWindowCount: 0, reasons: [],
    },
    locationSamples,
    featureWindows: [{
      windowId: '30000000-0000-4000-8000-000000000003', encounterId: '40000000-0000-4000-8000-000000000004',
      kind: 'CANDIDATE', startedAt: startedAt + 8_500, triggerAt: startedAt + 10_000, endedAt: startedAt + 12_000,
      triggerReasons: ['Z_DIFF'], triggerMeasurements: { zDiffMs2: 3 }, featureVersion: 'features-v1',
      features: {
        vertical: baseDistribution, horizontal: baseDistribution, dynamicMagnitude: baseDistribution,
        jerk: baseDistribution, gyroMagnitude: baseDistribution,
        frequency: { energy2To5Hz: 1, energy5To10Hz: 0.5, energy10To20Hz: 0.25, dominantFrequencyHz: 4, spectralEntropy: 0.5 },
        context: {
          durationMs: 3_500, speedKmh: 15, movementState: 'moving', mountStableRatio: 1,
          accelerometerSampleCount: 176, gyroscopeSampleCount: 176,
          accelerometerMissingRatio: 0, gyroscopeMissingRatio: 0,
        },
      },
    }],
    rawObjects: [],
    markers: [],
  };
}
