import type { VehicleType } from '@/types';

/**
 * Per-vehicle vibration floor (m/s² RMS) subtracted from readings before
 * event detection — an auto-rickshaw on glass-smooth tarmac still shakes more
 * than a sedan, so the same jolt threshold can't serve both.
 *
 * Values carried over from the validated Kotlin prototype
 * (mobile/android-prototype/.../data/model/Models.kt).
 */
export const VEHICLES: { type: VehicleType; label: string; baselineRms: number }[] = [
  { type: 'CAR', label: 'Car / Sedan', baselineRms: 0.35 },
  { type: 'BIKE', label: 'Bike / Scooter', baselineRms: 0.6 },
  { type: 'AUTO_RICKSHAW', label: 'Auto Rickshaw', baselineRms: 1.1 },
  { type: 'BUS', label: 'Bus', baselineRms: 0.7 },
  { type: 'TRUCK', label: 'Truck', baselineRms: 0.8 },
  { type: 'OTHER', label: 'Other', baselineRms: 0.5 },
];

export function baselineFor(type: VehicleType): number {
  return VEHICLES.find((v) => v.type === type)?.baselineRms ?? 0.5;
}
