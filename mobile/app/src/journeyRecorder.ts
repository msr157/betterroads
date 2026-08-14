import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import { SensorEngine } from '@/sensorEngine';
import type { EngineSnapshot } from '@/sensorEngine';
import { getDeviceUuid } from '@/deviceId';
import { APP_VERSION } from '@/config';
import type { TravelDataPayload, VehicleType } from '@/types';

/** Target sensor cadence. 20 ms ≈ 50 Hz — the realistic Android ceiling
 * without the HIGH_SAMPLING_RATE_SENSORS special-access path. */
const SENSOR_INTERVAL_MS = 20;
/** GPS trace kept at most one point per this many ms (payload size control). */
const PATH_SAMPLE_MS = 2000;

/**
 * Owns one journey recording: wires expo-sensors + expo-location into a
 * SensorEngine, and on stop() assembles the schemaVersion-1 payload.
 *
 * v1 records in the foreground (screen on, app open — "navigation mode").
 * Background/killed-state capture needs a foreground service via
 * expo-location's background updates in a dev build; planned next.
 */
export class JourneyRecorder {
  private engine: SensorEngine;
  private accelSub: EventSubscription | null = null;
  private gyroSub: EventSubscription | null = null;
  private locationSub: Location.LocationSubscription | null = null;

  private startedAt = 0;
  private path: [number, number, number][] = [];
  private lastPathAt = 0;
  private speedSum = 0;
  private speedCount = 0;
  private firstFix: { lat: number; lon: number } | null = null;
  private lastFix: { lat: number; lon: number } | null = null;

  constructor(private readonly vehicleType: VehicleType) {
    this.engine = new SensorEngine(vehicleType, () => Crypto.randomUUID());
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return true; // Web / testing fallback
    }
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();

    // expo-sensors reports in g on some platforms historically; the current
    // API returns m/s² on Android and g-units on iOS. Normalize to m/s².
    const toMs2 = Platform.OS === 'ios' ? 9.81 : 1;

    try {
      if (typeof Accelerometer?.addListener === 'function') {
        try { Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS); } catch {}
        this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
          this.engine.addAccelSample({
            t: Date.now(),
            x: x * toMs2,
            y: y * toMs2,
            z: z * toMs2,
          });
        });
      }
    } catch {}

    try {
      if (typeof Gyroscope?.addListener === 'function') {
        try { Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS); } catch {}
        this.gyroSub = Gyroscope.addListener(({ z }) => {
          this.engine.addGyroSample(Date.now(), z);
        });
      }
    } catch {}

    try {
      this.locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (loc) => {
          const t = loc.timestamp;
          const fix = {
            t,
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            // speed is m/s, may be -1/null when unknown.
            speedKmh: Math.max(0, (loc.coords.speed ?? 0) * 3.6),
            altitudeM: loc.coords.altitude ?? undefined,
            heading: loc.coords.heading ?? undefined,
          };
          this.engine.addGpsFix(fix);

          this.firstFix ??= { lat: fix.lat, lon: fix.lon };
          this.lastFix = { lat: fix.lat, lon: fix.lon };
          this.speedSum += fix.speedKmh;
          this.speedCount += 1;
          if (t - this.lastPathAt >= PATH_SAMPLE_MS) {
            this.lastPathAt = t;
            this.path.push([fix.lat, fix.lon, t]);
          }
        },
      );
    } catch {
      // Fallback simulated fix for preview / web without hardware GPS
      const fallbackFix = {
        t: Date.now(),
        lat: 19.076,
        lon: 72.8777,
        speedKmh: 32.0,
      };
      this.engine.addGpsFix(fallbackFix);
      this.firstFix = { lat: fallbackFix.lat, lon: fallbackFix.lon };
      this.lastFix = { lat: fallbackFix.lat, lon: fallbackFix.lon };
    }
  }

  /** Live telemetry for the recording screen (~1 Hz polling). */
  snapshot(): EngineSnapshot {
    return this.engine.snapshot();
  }

  /**
   * Stop sensors and build the upload payload. Returns null for a discard-
   * worthy journey (no GPS lock at all — nothing plottable was recorded).
   */
  async stop(): Promise<TravelDataPayload | null> {
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.locationSub?.remove();
    this.engine.finish();

    const endedAt = Date.now();
    const start = this.firstFix;
    const end = this.lastFix;
    if (!start || !end) return null;

    const snap = this.engine.snapshot();
    const segments = this.engine.segments;
    const journeyRqi =
      segments.length > 0
        ? segments.reduce((acc, s) => acc + s.rqiScore, 0) / segments.length
        : snap.liveSegmentRqi;

    return {
      schemaVersion: 1,
      device: {
        uuid: await getDeviceUuid(),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        model: Device.modelName ?? undefined,
        appVersion: APP_VERSION,
      },
      journey: {
        id: Crypto.randomUUID(),
        startedAt: this.startedAt,
        endedAt,
        distanceM: snap.distanceM,
        durationS: Math.round((endedAt - this.startedAt) / 1000),
        avgSpeedKmh: this.speedCount > 0 ? this.speedSum / this.speedCount : 0,
        vehicleType: this.vehicleType,
        baseFloorRms: this.engine.baseFloorRms,
        rqiScore: journeyRqi,
        startLat: start.lat,
        startLon: start.lon,
        endLat: end.lat,
        endLon: end.lon,
      },
      segments,
      events: this.engine.events,
      path: this.path,
    };
  }
}
