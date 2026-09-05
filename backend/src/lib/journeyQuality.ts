export type QualityStatus = 'LEGACY_APPROVED' | 'APPROVED' | 'QUARANTINED';

type Point = { lat: number; lon: number; timestamp: number; accuracyM?: number };
type PayloadLike = {
  schemaVersion: 1 | 2;
  journey: { startedAt: number; endedAt: number; distanceM: number; durationS: number; movingDurationS?: number };
  path?: [number, number, number][];
  locationSamples?: Point[];
  segments: { lengthM: number }[];
  events: { timestamp: number; lat: number; lon: number }[];
};

export type QualityEvaluation = {
  status: QualityStatus;
  reasons: string[];
  diagnostics: Record<string, number>;
};

const haversineM = (a: Pick<Point, 'lat' | 'lon'>, b: Pick<Point, 'lat' | 'lon'>) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
};

export function evaluateJourneyQuality(payload: PayloadLike): QualityEvaluation {
  const points: Point[] = payload.schemaVersion === 2
    ? (payload.locationSamples ?? [])
    : (payload.path ?? []).map(([lat, lon, timestamp]) => ({ lat, lon, timestamp }));
  const reasons: string[] = [];
  let pathDistanceM = 0;
  let maxImpliedSpeedKmh = 0;
  let ordered = true;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const dtS = (current.timestamp - previous.timestamp) / 1000;
    if (dtS <= 0) ordered = false;
    const leg = haversineM(previous, current);
    pathDistanceM += leg;
    if (dtS > 0) maxImpliedSpeedKmh = Math.max(maxImpliedSpeedKmh, leg / dtS * 3.6);
  }
  const spanM = points.length > 1 ? haversineM(points[0]!, points[points.length - 1]!) : 0;
  const segmentDistanceM = payload.segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  const durationDeltaS = Math.abs(payload.journey.durationS - (payload.journey.endedAt - payload.journey.startedAt) / 1000);
  const distanceDeltaRatio = Math.abs(payload.journey.distanceM - pathDistanceM) / Math.max(1, pathDistanceM);
  const segmentDeltaRatio = Math.abs(payload.journey.distanceM - segmentDistanceM) / Math.max(1, payload.journey.distanceM);

  if (!ordered) reasons.push('LOCATION_TIMESTAMPS_OUT_OF_ORDER');
  if (maxImpliedSpeedKmh > 180) reasons.push('IMPOSSIBLE_LOCATION_JUMP');
  if (durationDeltaS > Math.max(10, payload.journey.durationS * 0.1)) reasons.push('DURATION_MISMATCH');
  if (points.length > 1 && distanceDeltaRatio > 0.2) reasons.push('DISTANCE_PATH_MISMATCH');
  if (segmentDeltaRatio > 0.2) reasons.push('SEGMENT_DISTANCE_MISMATCH');
  for (const event of payload.events) {
    if (event.timestamp < payload.journey.startedAt || event.timestamp > payload.journey.endedAt) {
      reasons.push('EVENT_OUTSIDE_JOURNEY'); break;
    }
    let nearestM = Number.POSITIVE_INFINITY;
    for (const point of points) nearestM = Math.min(nearestM, haversineM(point, event));
    if (points.length && nearestM > 100) {
      reasons.push('EVENT_TOO_FAR_FROM_PATH'); break;
    }
  }

  if (payload.schemaVersion === 2) {
    if (payload.journey.distanceM < 100) reasons.push('INSUFFICIENT_DISTANCE');
    if ((payload.journey.movingDurationS ?? 0) < 20) reasons.push('INSUFFICIENT_MOVING_TIME');
    if (points.length < 5) reasons.push('INSUFFICIENT_RELIABLE_FIXES');
    if (points.some((point) => point.accuracyM === undefined || point.accuracyM > 25)) reasons.push('SCORING_FIX_TOO_INACCURATE');
  } else {
    if (points.length > 1 && spanM > pathDistanceM * 1.05 + 25) reasons.push('INVALID_MOVEMENT_SPAN');
    if (points.length > 1 && payload.journey.distanceM > Math.max(pathDistanceM * 1.5, pathDistanceM + 100)) reasons.push('CLAIMED_DISTANCE_EXCESSIVE');
  }

  return {
    status: reasons.length ? 'QUARANTINED' : payload.schemaVersion === 2 ? 'APPROVED' : 'LEGACY_APPROVED',
    reasons: [...new Set(reasons)],
    diagnostics: { pointCount: points.length, pathDistanceM, spanM, maxImpliedSpeedKmh, durationDeltaS, distanceDeltaRatio, segmentDistanceM, segmentDeltaRatio },
  };
}
