export type VehicleType = 'CAR' | 'BIKE' | 'AUTO_RICKSHAW' | 'BUS' | 'TRUCK' | 'OTHER';
export type VehicleClass = VehicleType;
export type CollectionMode = 'STANDARD' | 'CONTROLLED_RESEARCH';
export type WindowKind = 'CANDIDATE' | 'RANDOM_NORMAL' | 'CALIBRATION' | 'MANUAL_MARKER' | 'ARTIFACT';

export type LocationPoint = {
  timestamp: number;
  lat: number;
  lon: number;
  accuracyM: number;
  speedKmh?: number;
  headingDeg?: number;
  altitudeM?: number;
};

export type DistributionFeatures = {
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
  rms: number;
  peakToPeak: number;
  median: number;
  mad: number;
  p05: number;
  p25: number;
  p75: number;
  p95: number;
  crestFactor: number;
  zeroCrossings: number;
};

export type FeatureVectorV1 = {
  vertical: DistributionFeatures;
  horizontal: DistributionFeatures;
  dynamicMagnitude: DistributionFeatures;
  jerk: DistributionFeatures;
  gyroMagnitude: DistributionFeatures;
  frequency: {
    energy2To5Hz: number;
    energy5To10Hz: number;
    energy10To20Hz: number;
    dominantFrequencyHz: number;
    spectralEntropy: number;
  };
  context: {
    durationMs: number;
    speedKmh?: number;
    headingChangeDeg?: number;
    movementState: 'moving';
    mountStableRatio: number;
    accelerometerSampleCount: number;
    gyroscopeSampleCount: number;
    accelerometerMissingRatio: number;
    gyroscopeMissingRatio: number;
  };
};

export type FeatureWindowV1 = {
  windowId: string;
  encounterId: string;
  kind: WindowKind;
  startedAt: number;
  triggerAt?: number;
  endedAt: number;
  triggerReasons: string[];
  triggerMeasurements?: Record<string, number>;
  location?: LocationPoint & {
    quality: 'INTERPOLATED' | 'NEAREST' | 'UNUSABLE';
    bracketGapMs: number;
  };
  featureVersion: 'features-v1';
  features: FeatureVectorV1;
};

export type RawObjectManifest = {
  objectId: string;
  windowId: string;
  byteSize: number;
  sha256: string;
  contentType: 'application/json';
  contentEncoding: 'gzip';
  formatVersion: 1;
};

export type CollectionMarkerV1 = {
  markerId: string;
  markedAt: number;
  markerType: 'PASSENGER_ROAD_FEATURE' | 'KNOWN_NORMAL_SECTION' | 'HANDLING_ARTIFACT';
  location?: LocationPoint;
};

export type CollectionSessionV3 = {
  schemaVersion: 3;
  sessionId: string;
  device: {
    uuid: string;
    platform: 'android' | 'ios';
    model?: string;
    osVersion?: string;
    appVersion: string;
  };
  collection: {
    mode: CollectionMode;
    vehicleClass: VehicleClass;
    vehicleSubtype: string;
    vehicleMetadata: Record<string, string | number | boolean | null>;
    mountPosition: string;
    profileVersion: string;
    featureVersion: 'features-v1';
    triggerVersion: string;
    motionAlgorithmVersion: string;
    consentVersion: string;
  };
  timing: {
    startedAt: number;
    endedAt: number;
    movingDurationMs: number;
    stationaryDurationMs: number;
    sensorEpochOffsetMs: number;
    estimatedClockDriftPpm: number;
  };
  journey: {
    acceptedDistanceM: number;
    averageMovingSpeedKmh: number;
    start: LocationPoint;
    end: LocationPoint;
  };
  quality: {
    accelerometerSampleCount: number;
    gyroscopeSampleCount: number;
    effectiveAccelHz: number;
    effectiveGyroHz: number;
    accelMissingRatio: number;
    gyroMissingRatio: number;
    reliableFixCount: number;
    rejectedFixCount: number;
    meanAccuracyM: number;
    mountStableRatio: number;
    candidateCount: number;
    suppressedCandidateCount: number;
    normalWindowCount: number;
    reasons: string[];
  };
  locationSamples: LocationPoint[];
  featureWindows: FeatureWindowV1[];
  rawObjects: RawObjectManifest[];
  markers: CollectionMarkerV1[];
};

export type CollectionIngestionStatus = 'received' | 'quarantined' | 'duplicate';

export type CollectionCompleteResponse = {
  ok: true;
  status: CollectionIngestionStatus;
  sessionId: string;
  quarantineReasons?: string[];
};

export type {
  JourneySegment,
  RoadEvent,
  RoadEventType,
  TravelDataPayload,
  TravelDataV1,
  TravelDataV2,
} from './legacyTravelData';
