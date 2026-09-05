import type { VehicleType } from './types';

/** Frozen v1/v2 upload types. New recordings use CollectionSessionV3. */
export type RoadEventType = 'POTHOLE' | 'BUMP' | 'SPEED_BREAKER' | 'SWERVE' | 'MANUAL_REPORT';

export type JourneySegment = {
  segmentIndex: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  lengthM: number;
  rqiScore: number;
  eventCount: number;
  avgRms: number;
};

export type RoadEvent = {
  id: string;
  type: RoadEventType;
  severity: number;
  timestamp: number;
  lat: number;
  lon: number;
  altitudeM?: number;
  speedKmh?: number;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroZ?: number;
  heading?: number;
};

type DeviceInfo = {
  uuid: string;
  platform: 'android' | 'ios';
  model?: string;
  appVersion?: string;
};

type JourneyInfo = {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  durationS: number;
  avgSpeedKmh: number;
  vehicleType: VehicleType;
  phoneMountPosition?: string;
  baseFloorRms?: number;
  rqiScore: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
};

export type TravelDataV1 = {
  schemaVersion: 1;
  device: DeviceInfo;
  journey: JourneyInfo;
  segments: JourneySegment[];
  events: RoadEvent[];
  path?: [number, number, number][];
};

export type TravelDataV2 = Omit<TravelDataV1, 'schemaVersion' | 'journey'> & {
  schemaVersion: 2;
  journey: JourneyInfo & {
    movingDurationS: number;
    stationaryDurationS: number;
    detectionAlgorithmVersion: string;
    fixQuality: {
      reliableFixCount: number;
      rejectedFixCount: number;
      meanAccuracyM: number;
      bestAccuracyM: number;
      worstAccuracyM: number;
    };
  };
  locationSamples: Array<{
    lat: number;
    lon: number;
    timestamp: number;
    accuracyM: number;
    speedKmh?: number;
  }>;
};

export type TravelDataPayload = TravelDataV1 | TravelDataV2;

