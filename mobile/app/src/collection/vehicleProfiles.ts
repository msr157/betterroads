import type { VehicleClass } from '../types';

export type VehicleProfile = {
  vehicleClass: VehicleClass;
  profileVersion: string;
  triggerVersion: string;
  collectionEligible: boolean;
  trainingEligibility: 'ENABLED' | 'EXPERIMENTAL_ONLY' | 'UNSUPPORTED';
  targetSensorHz: 50;
  calibrationMs: number;
  requiresEngineBaseline: boolean;
  mountPositions: readonly string[];
  subtypes: readonly string[];
  requiredMetadata: readonly string[];
  optionalMetadata: readonly string[];
  candidateCap: number;
  normalWindowCap: number;
  normalIntervalMeanMs: number;
  thresholds: {
    zDiffMs2: number;
    rmsMs2: number;
    rmsWindowMs: number;
    fixedDynamicMagnitudeMs2: number;
    rollingMadMultiplier: number;
  };
};

const COMMON_THRESHOLDS = {
  zDiffMs2: 1.96133,
  rmsMs2: 1.2,
  rmsWindowMs: 400,
  fixedDynamicMagnitudeMs2: 6,
  rollingMadMultiplier: 6,
} as const;

export const VEHICLE_PROFILES: Record<VehicleClass, VehicleProfile> = {
  CAR: {
    vehicleClass: 'CAR', profileVersion: 'car-collector-v1', triggerVersion: 'candidate-v1',
    collectionEligible: true, trainingEligibility: 'ENABLED', targetSensorHz: 50, calibrationMs: 3_000,
    requiresEngineBaseline: false,
    mountPositions: ['DASHBOARD', 'WINDSCREEN', 'RIGID_CONSOLE'],
    subtypes: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'OTHER_CAR'],
    requiredMetadata: ['vehicleAgeBand'], optionalMetadata: ['suspensionCategory', 'loadBand'],
    candidateCap: 200, normalWindowCap: 120, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
  BIKE: {
    vehicleClass: 'BIKE', profileVersion: 'bike-collector-v1', triggerVersion: 'candidate-v1',
    collectionEligible: true, trainingEligibility: 'ENABLED', targetSensorHz: 50, calibrationMs: 5_000,
    requiresEngineBaseline: true,
    mountPositions: ['HANDLEBAR', 'STEM', 'MIRROR_BASE', 'RIGID_BODY'],
    subtypes: ['MOTORCYCLE', 'SCOOTER', 'ELECTRIC_MOTORCYCLE', 'ELECTRIC_SCOOTER'],
    requiredMetadata: ['powertrain'], optionalMetadata: ['engineDisplacementBand', 'loadBand', 'tyreType'],
    candidateCap: 200, normalWindowCap: 120, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
  AUTO_RICKSHAW: {
    vehicleClass: 'AUTO_RICKSHAW', profileVersion: 'auto-collector-v1', triggerVersion: 'candidate-v1',
    collectionEligible: true, trainingEligibility: 'ENABLED', targetSensorHz: 50, calibrationMs: 8_000,
    requiresEngineBaseline: true,
    mountPositions: ['DASHBOARD', 'RIGID_FRAME', 'FIXED_TRAY'],
    subtypes: ['PETROL_AUTO', 'CNG_AUTO', 'ELECTRIC_AUTO', 'OTHER_AUTO'],
    requiredMetadata: ['powertrain'], optionalMetadata: ['vehicleAgeBand', 'loadBand'],
    candidateCap: 200, normalWindowCap: 120, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
  BUS: {
    vehicleClass: 'BUS', profileVersion: 'bus-experimental-v1', triggerVersion: 'candidate-v1',
    collectionEligible: true, trainingEligibility: 'EXPERIMENTAL_ONLY', targetSensorHz: 50, calibrationMs: 8_000,
    requiresEngineBaseline: true, mountPositions: ['FIXED_CABIN'],
    subtypes: ['CITY_BUS', 'COACH', 'MINIBUS', 'ELECTRIC_BUS', 'OTHER_BUS'],
    requiredMetadata: ['loadBand'], optionalMetadata: ['axleBand', 'suspensionCategory'],
    candidateCap: 200, normalWindowCap: 120, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
  TRUCK: {
    vehicleClass: 'TRUCK', profileVersion: 'truck-experimental-v1', triggerVersion: 'candidate-v1',
    collectionEligible: true, trainingEligibility: 'EXPERIMENTAL_ONLY', targetSensorHz: 50, calibrationMs: 8_000,
    requiresEngineBaseline: true, mountPositions: ['FIXED_CABIN'],
    subtypes: ['LIGHT_TRUCK', 'MEDIUM_TRUCK', 'HEAVY_TRUCK', 'OTHER_TRUCK'],
    requiredMetadata: ['loadBand'], optionalMetadata: ['axleBand', 'suspensionCategory'],
    candidateCap: 200, normalWindowCap: 120, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
  OTHER: {
    vehicleClass: 'OTHER', profileVersion: 'unsupported-v1', triggerVersion: 'candidate-v1',
    collectionEligible: false, trainingEligibility: 'UNSUPPORTED', targetSensorHz: 50, calibrationMs: 3_000,
    requiresEngineBaseline: false, mountPositions: [], subtypes: ['OTHER'], requiredMetadata: [], optionalMetadata: [],
    candidateCap: 0, normalWindowCap: 0, normalIntervalMeanMs: 20_000,
    thresholds: COMMON_THRESHOLDS,
  },
};

export function profileFor(vehicleClass: VehicleClass): VehicleProfile {
  return VEHICLE_PROFILES[vehicleClass];
}

export function validateVehicleSelection(
  profile: VehicleProfile,
  subtype: string,
  mountPosition: string,
  metadata: Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  if (!profile.collectionEligible) reasons.push('UNSUPPORTED_VEHICLE_CLASS');
  if (!profile.subtypes.includes(subtype)) reasons.push('UNSUPPORTED_VEHICLE_SUBTYPE');
  if (!profile.mountPositions.includes(mountPosition)) reasons.push('UNSUPPORTED_MOUNT_POSITION');
  for (const key of profile.requiredMetadata) {
    if (metadata[key] === undefined || metadata[key] === null || metadata[key] === '') reasons.push(`MISSING_METADATA_${key}`);
  }
  return reasons;
}

