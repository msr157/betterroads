import type { CollectionSessionV3 } from './collectionSchema.js';

export type CollectionQualityResult = {
  status: 'RECEIVED' | 'QUARANTINED';
  reasons: string[];
  diagnostics: Record<string, number>;
  hardFailure?: string;
};

export function evaluateCollectionQuality(payload: CollectionSessionV3): CollectionQualityResult {
  const reasons: string[] = [];
  let hardFailure: string | undefined;
  const durationMs = payload.timing.endedAt - payload.timing.startedAt;
  const locationDistanceM = pathDistance(payload.locationSamples);

  for (let index = 1; index < payload.locationSamples.length; index += 1) {
    const previous = payload.locationSamples[index - 1]!;
    const current = payload.locationSamples[index]!;
    if (current.timestamp <= previous.timestamp) {
      hardFailure = 'LOCATION_TIMESTAMPS_OUT_OF_ORDER';
      break;
    }
    const elapsedS = (current.timestamp - previous.timestamp) / 1000;
    const impliedKmh = elapsedS > 0 ? haversineM(previous.lat, previous.lon, current.lat, current.lon) / elapsedS * 3.6 : Infinity;
    if (impliedKmh > 180) {
      hardFailure = 'IMPOSSIBLE_LOCATION_JUMP';
      break;
    }
  }

  if (payload.timing.movingDurationMs < 20_000) reasons.push('MOVING_DURATION_BELOW_20_SECONDS');
  if (payload.journey.acceptedDistanceM < 100) reasons.push('ACCEPTED_DISTANCE_BELOW_100_METRES');
  if (payload.quality.reliableFixCount < 5 || payload.locationSamples.length < 5) reasons.push('FEWER_THAN_FIVE_RELIABLE_FIXES');
  if (payload.quality.meanAccuracyM > 25) reasons.push('MEAN_GPS_ACCURACY_ABOVE_25_METRES');
  if (payload.quality.effectiveAccelHz < 40 || payload.quality.effectiveAccelHz > 60) reasons.push('ACCELEROMETER_CADENCE_OUTSIDE_40_60_HZ');
  if (payload.quality.effectiveGyroHz < 40 || payload.quality.effectiveGyroHz > 60) reasons.push('GYROSCOPE_CADENCE_OUTSIDE_40_60_HZ');
  if (payload.quality.accelMissingRatio > 0.2) reasons.push('ACCELEROMETER_MISSING_RATIO_ABOVE_20_PERCENT');
  if (payload.quality.gyroMissingRatio > 0.2) reasons.push('GYROSCOPE_MISSING_RATIO_ABOVE_20_PERCENT');
  if (payload.quality.mountStableRatio < 0.8) reasons.push('MOUNT_STABLE_RATIO_BELOW_80_PERCENT');
  if (payload.collection.mode === 'STANDARD' && payload.rawObjects.length > 0) hardFailure = 'STANDARD_SESSION_CONTAINS_RAW_OBJECTS';
  const claimedDifference = Math.abs(payload.journey.acceptedDistanceM - locationDistanceM);
  const allowedDifference = Math.max(50, locationDistanceM * 0.1);
  if (claimedDifference > allowedDifference) reasons.push('CLAIMED_DISTANCE_DIFFERS_FROM_ACCEPTED_PATH');
  for (const window of payload.featureWindows) {
    if (window.startedAt < payload.timing.startedAt || window.endedAt > payload.timing.endedAt || window.endedAt <= window.startedAt) {
      hardFailure = 'WINDOW_OUTSIDE_SESSION_TIME';
      break;
    }
    if (window.featureVersion !== payload.collection.featureVersion) {
      hardFailure = 'WINDOW_FEATURE_VERSION_MISMATCH';
      break;
    }
  }

  return {
    status: reasons.length > 0 ? 'QUARANTINED' : 'RECEIVED',
    reasons,
    diagnostics: {
      durationMs,
      acceptedPathDistanceM: locationDistanceM,
      claimedDistanceDifferenceM: claimedDifference,
      featureWindowCount: payload.featureWindows.length,
      rawObjectCount: payload.rawObjects.length,
    },
    hardFailure,
  };
}

function pathDistance(points: CollectionSessionV3['locationSamples']): number {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    distance += haversineM(previous.lat, previous.lon, current.lat, current.lon);
  }
  return distance;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusM = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusM * Math.asin(Math.sqrt(a));
}

