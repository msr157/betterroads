/**
 * Travel-data contract, schemaVersion 1.
 * Mirror of docs/api-contracts/traveldata.md and the backend Zod schema in
 * backend/src/routes/traveldata.ts — keep the three in lockstep.
 */

export type VehicleType = 'CAR' | 'BIKE' | 'AUTO_RICKSHAW' | 'BUS' | 'TRUCK' | 'OTHER';

export type RoadEventType = 'POTHOLE' | 'BUMP' | 'SPEED_BREAKER' | 'SWERVE' | 'MANUAL_REPORT';

export type JourneySegment = {
  segmentIndex: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  lengthM: number;
  /** 0–100 as scored on-device. */
  rqiScore: number;
  eventCount: number;
  /** m/s² windowed RMS after the vehicle floor is subtracted. */
  avgRms: number;
};

export type RoadEvent = {
  id: string;
  type: RoadEventType;
  /** 0.0–1.0. */
  severity: number;
  /** Epoch ms. */
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

export type TravelDataPayload = {
  schemaVersion: 1;
  device: {
    /** Install-time UUID — see deviceId.ts. Never a MAC address. */
    uuid: string;
    platform: 'android' | 'ios';
    model?: string;
    appVersion?: string;
  };
  journey: {
    /** Client-minted UUID; the server's idempotency key for retries. */
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
  segments: JourneySegment[];
  events: RoadEvent[];
  /** Downsampled GPS trace: [lat, lon, epochMs]. */
  path?: [number, number, number][];
};
