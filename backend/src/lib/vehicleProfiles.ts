export const VEHICLE_CLASSES = ['CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK', 'OTHER'] as const;
export type VehicleClass = typeof VEHICLE_CLASSES[number];

export type ServerVehicleProfile = {
  vehicleClass: VehicleClass;
  profileVersion: string;
  triggerVersion: string;
  featureVersion: 'features-v1';
  collectionEligible: boolean;
  trainingEligibility: 'ENABLED' | 'EXPERIMENTAL_ONLY' | 'UNSUPPORTED';
  calibrationMs: number;
  targetSensorHz: 50;
  mountPositions: readonly string[];
  subtypes: readonly string[];
  candidateCap: number;
  normalWindowCap: number;
};

export const SERVER_VEHICLE_PROFILES: Record<VehicleClass, ServerVehicleProfile> = {
  CAR: profile('CAR', 'car-collector-v1', 3_000, ['DASHBOARD', 'WINDSCREEN', 'RIGID_CONSOLE'], ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'OTHER_CAR']),
  BIKE: profile('BIKE', 'bike-collector-v1', 5_000, ['HANDLEBAR', 'STEM', 'MIRROR_BASE', 'RIGID_BODY'], ['MOTORCYCLE', 'SCOOTER', 'ELECTRIC_MOTORCYCLE', 'ELECTRIC_SCOOTER']),
  AUTO_RICKSHAW: profile('AUTO_RICKSHAW', 'auto-collector-v1', 8_000, ['DASHBOARD', 'RIGID_FRAME', 'FIXED_TRAY'], ['PETROL_AUTO', 'CNG_AUTO', 'ELECTRIC_AUTO', 'OTHER_AUTO']),
  BUS: profile('BUS', 'bus-experimental-v1', 8_000, ['FIXED_CABIN'], ['CITY_BUS', 'COACH', 'MINIBUS', 'ELECTRIC_BUS', 'OTHER_BUS'], 'EXPERIMENTAL_ONLY'),
  TRUCK: profile('TRUCK', 'truck-experimental-v1', 8_000, ['FIXED_CABIN'], ['LIGHT_TRUCK', 'MEDIUM_TRUCK', 'HEAVY_TRUCK', 'OTHER_TRUCK'], 'EXPERIMENTAL_ONLY'),
  OTHER: {
    vehicleClass: 'OTHER', profileVersion: 'unsupported-v1', triggerVersion: 'candidate-v1', featureVersion: 'features-v1',
    collectionEligible: false, trainingEligibility: 'UNSUPPORTED', calibrationMs: 3_000, targetSensorHz: 50,
    mountPositions: [], subtypes: ['OTHER'], candidateCap: 0, normalWindowCap: 0,
  },
};

function profile(
  vehicleClass: VehicleClass,
  profileVersion: string,
  calibrationMs: number,
  mountPositions: readonly string[],
  subtypes: readonly string[],
  trainingEligibility: ServerVehicleProfile['trainingEligibility'] = 'ENABLED',
): ServerVehicleProfile {
  return {
    vehicleClass, profileVersion, triggerVersion: 'candidate-v1', featureVersion: 'features-v1',
    collectionEligible: true, trainingEligibility, calibrationMs, targetSensorHz: 50,
    mountPositions, subtypes, candidateCap: 200, normalWindowCap: 120,
  };
}

export function serverProfileFor(vehicleClass: VehicleClass): ServerVehicleProfile {
  return SERVER_VEHICLE_PROFILES[vehicleClass];
}

