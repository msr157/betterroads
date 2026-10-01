import { Platform, PermissionsAndroid } from 'react-native';
import { getCurrentUserId } from '@/auth';
import { drainJournal, replaySensor, type JournalPage, type JournalRow } from '@/collection/journalReplay';
import { hasQueuedCollection } from '@/collection/queue';
import { nativeRecorder, nativeSession, type NativeSession } from '@/collection/nativeRecording';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import { CollectionEngine } from '@/collection/collectionEngine';
import { SensorClock } from '@/collection/clock';
import { STANDARD_GRAVITY_MS2 } from '@/collection/orientation';
import { profileFor, validateVehicleSelection, type VehicleProfile } from '@/collection/vehicleProfiles';
import { encodeRawWindows, type PreparedCollection } from '@/collection/rawEncoding';
import { MotionFilter, MOTION_ALGORITHM_VERSION, type MotionState, type QualityFix } from '@/motionFilter';
import { haversineM } from '@/sensorEngine';
import { getDeviceUuid } from '@/deviceId';
import { APP_VERSION } from '@/config';
import type { CollectionMarkerV1, CollectionMode, CollectionSessionV3, FeatureWindowV1, LocationPoint, VehicleClass } from '@/types';

const SENSOR_INTERVAL_MS = 20;
export const COLLECTION_CONSENT_VERSION = 'collection-consent-v1';

export type CollectionStartConfig = {
  mode: CollectionMode;
  vehicleClass: VehicleClass;
  vehicleSubtype: string;
  vehicleMetadata: Record<string, string | number | boolean | null>;
  mountPosition: string;
};

export type CollectionRecorderSnapshot = {
  distanceM: number;
  candidateCount: number;
  normalWindowCount: number;
  suppressedCandidateCount: number;
  isStableMount: boolean;
  mountCalibrated: boolean;
  motionState: MotionState;
};

/** Journal-backed Android collector; foreground fallback on other platforms. It records neutral feature windows, never road labels or RQI. */
export class JourneyRecorder {
  private readonly profile: VehicleProfile;
  private readonly collector: CollectionEngine;
  private readonly motion = new MotionFilter();
  private readonly accelClock = new SensorClock();
  private readonly gyroClock = new SensorClock();
  private accelSub: EventSubscription | null = null;
  private gyroSub: EventSubscription | null = null;
  private locationSub: Location.LocationSubscription | null = null;
  private startedAt = 0;
  private native: NativeSession | null = null;
  private journalOffset = 0;
  private syncing: Promise<void> | null = null;
  private prepared: PreparedCollection | null = null;

  static async recover(): Promise<JourneyRecorder | null> {
    const session = await nativeSession();
    if (!session) return null;
    if (session.config.ownerId !== await getCurrentUserId()) {
      // Do not leave an account's recorder running after a logout or account
      // switch. Keep its journal intact so the owner can finish it later.
      if (session.running) await nativeRecorder().stop();
      throw new Error('A saved journey belongs to another account. Sign in to that account to finish it.');
    }
    if (!session.running && hasQueuedCollection(session.id)) {
      await nativeRecorder().clear(session.id);
      return null;
    }
    const recorder = new JourneyRecorder(session.config);
    recorder.native = session;
    recorder.startedAt = session.startedAt;
    await recorder.syncNative();
    return recorder;
  }

  async syncNative(): Promise<void> {
    if (!this.native) return;
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      await drainJournal(this.journalOffset,
        async (offset) => JSON.parse(await nativeRecorder().read(offset)) as JournalPage,
        (row) => this.replay(row),
        (offset) => { this.journalOffset = offset; });
      this.native = await nativeSession();
    })();
    try { await this.syncing; } finally { this.syncing = null; }
  }

  private replay(row: JournalRow): void {
    this.lastReplayAt = Math.max(this.lastReplayAt, row[1]);
    if (row[0] === 'a') {
      replaySensor(row, this.accelClock, (t, us, value) => this.collector.addAccelerometer(t, us, value));
    } else if (row[0] === 'g') {
      replaySensor(row, this.gyroClock, (t, us, value) => this.collector.addGyroscope(t, us, value));
    } else if (row[0] === 'l') {
      this.addLocation({ timestamp: row[1], coords: {
        latitude: row[2], longitude: row[3], accuracy: row[4], speed: row[5],
        heading: row[6], altitude: row[7], altitudeAccuracy: null,
      } });
    } else if (row[0] === 'm') {
      this.markers.push({ markerId: row[2], markedAt: row[1], markerType: row[3] as CollectionMarkerV1['markerType'] });
    }
  }

  get startConfig(): CollectionStartConfig { return this.config; }

  recordingNotice(): string | null {
    if (!this.native) return null;
    if (!this.native.running) return this.native.error ?? 'Recording has stopped. Tap Stop to finish the saved journey.';
    if (Date.now() - this.native.lastLocationAt > 15_000) return 'Waiting for GPS. Motion data is being saved.';
    return null;
  }

  async acknowledgeSaved(): Promise<void> {
    if (this.native) await nativeRecorder().clear(this.native.id);
  }

  private distanceM = 0;
  private movingDurationMs = 0;
  private lastAcceptedAt: number | null = null;
  private lastAcceptedFix: QualityFix | null = null;
  private locationSamples: LocationPoint[] = [];
  private markers: CollectionMarkerV1[] = [];

  constructor(private readonly config: CollectionStartConfig) {
    this.profile = profileFor(config.vehicleClass);
    const selectionErrors = validateVehicleSelection(
      this.profile,
      config.vehicleSubtype,
      config.mountPosition,
      config.vehicleMetadata,
    );
    if (selectionErrors.length > 0) throw new Error(selectionErrors.join(', '));
    this.collector = new CollectionEngine(this.profile, () => Crypto.randomUUID());
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const notification = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (notification !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();
    if (Platform.OS === 'android') {
      const ownerId = await getCurrentUserId();
      this.native = JSON.parse(await nativeRecorder().start(JSON.stringify({ ...this.config, ownerId }))) as NativeSession;
      this.startedAt = this.native.startedAt;
      for (let attempt = 0; attempt < 50; attempt++) {
        const session = await nativeSession();
        if (session?.running) { this.native = session; return; }
        if (session?.error) {
          await nativeRecorder().clear(session.id);
          this.native = null;
          throw new Error(session.error);
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      await nativeRecorder().stop();
      throw new Error('Recording did not start. Reopen the app to recover the saved session.');
    }
    try {
      Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      this.accelSub = Accelerometer.addListener(({ x, y, z, timestamp }) => {
        const clocked = this.accelClock.map(timestamp);
        if (!clocked) return;
        this.collector.addAccelerometer(clocked.epochMs, clocked.monotonicUs, {
          x: x * STANDARD_GRAVITY_MS2,
          y: y * STANDARD_GRAVITY_MS2,
          z: z * STANDARD_GRAVITY_MS2,
        });
      });
    } catch {
      // Sensor availability is represented by zero cadence and quarantined by the server.
    }
    try {
      Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);
      this.gyroSub = Gyroscope.addListener(({ x, y, z, timestamp }) => {
        const clocked = this.gyroClock.map(timestamp);
        if (!clocked) return;
        this.collector.addGyroscope(clocked.epochMs, clocked.monotonicUs, { x, y, z });
      });
    } catch {
      // Sensor availability is represented by zero cadence and quarantined by the server.
    }

    try {
      this.locationSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1_000, distanceInterval: 5 },
        (location) => this.addLocation(location),
      );
    } catch {
      // No synthetic fallback: stop() returns null when no accepted path exists.
    }
  }

  snapshot(): CollectionRecorderSnapshot {
    const collection = this.collector.snapshot();
    return {
      distanceM: this.distanceM,
      candidateCount: collection.candidateCount,
      normalWindowCount: collection.normalWindowCount,
      suppressedCandidateCount: collection.suppressedCandidateCount,
      isStableMount: collection.mountStable,
      mountCalibrated: collection.mountCalibrated,
      motionState: this.motion.state,
    };
  }

  /** Passenger/research-operator marker. Drivers must not operate this while moving. */
  async markRoadFeature(markerType: CollectionMarkerV1['markerType'] = 'PASSENGER_ROAD_FEATURE'): Promise<boolean> {
    if (this.config.mode !== 'CONTROLLED_RESEARCH') return false;
    if (this.native) {
      await nativeRecorder().mark(markerType);
      await this.syncNative();
      return true;
    }
    const markedAt = Date.now();
    const nearest = [...this.locationSamples]
      .sort((a, b) => Math.abs(a.timestamp - markedAt) - Math.abs(b.timestamp - markedAt))[0];
    this.markers.push({ markerId: Crypto.randomUUID(), markedAt, markerType, location: nearest });
    return true;
  }

  async stop(): Promise<PreparedCollection | null> {
    if (this.prepared) return this.prepared;
    if (this.native) {
      await nativeRecorder().stop();
      if (this.syncing) await this.syncing;
      await this.syncNative();
    }
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.locationSub?.remove();
    const endedAt = this.native?.endedAt ?? (this.native ? this.lastRecordedAt() : Date.now());
    this.collector.finish(endedAt);

    const start = this.locationSamples[0];
    const end = this.locationSamples[this.locationSamples.length - 1];
    if (!start || !end) return null;
    if (this.config.mode === 'STANDARD' && (this.distanceM < 100 || this.movingDurationMs < 20_000 || this.motion.reliableFixCount < 5)) {
      return null;
    }

    const accel = this.accelClock.snapshot();
    const gyro = this.gyroClock.snapshot();
    const collection = this.collector.snapshot();
    const durationMs = Math.max(0, endedAt - this.startedAt);
    const expectedSamples = durationMs / SENSOR_INTERVAL_MS;
    const featureWindows = this.collector.completed.map(({ window }) => this.attachLocation(window));
    const candidateCount = featureWindows.filter((window) => window.kind === 'CANDIDATE').length;
    const normalWindowCount = featureWindows.filter((window) => window.kind === 'RANDOM_NORMAL').length;

    const sessionId = this.native?.id ?? Crypto.randomUUID();
    const rawObjects = this.config.mode === 'CONTROLLED_RESEARCH'
      ? await encodeRawWindows(this.collector.completed)
      : [];
    const payload: CollectionSessionV3 = {
      schemaVersion: 3,
      sessionId,
      device: {
        uuid: await getDeviceUuid(),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        model: Device.modelName ?? undefined,
        osVersion: Device.osVersion ?? undefined,
        appVersion: APP_VERSION,
      },
      collection: {
        mode: this.config.mode,
        vehicleClass: this.config.vehicleClass,
        vehicleSubtype: this.config.vehicleSubtype,
        vehicleMetadata: this.config.vehicleMetadata,
        mountPosition: this.config.mountPosition,
        profileVersion: this.profile.profileVersion,
        featureVersion: 'features-v1',
        triggerVersion: this.profile.triggerVersion,
        motionAlgorithmVersion: MOTION_ALGORITHM_VERSION,
        consentVersion: COLLECTION_CONSENT_VERSION,
      },
      timing: {
        startedAt: this.startedAt,
        endedAt,
        movingDurationMs: this.movingDurationMs,
        stationaryDurationMs: Math.max(0, durationMs - this.movingDurationMs),
        sensorEpochOffsetMs: this.accelClock.offsetMs ?? this.gyroClock.offsetMs ?? 0,
        estimatedClockDriftPpm: averageAvailable(accel.estimatedClockDriftPpm, gyro.estimatedClockDriftPpm),
      },
      journey: {
        acceptedDistanceM: this.distanceM,
        averageMovingSpeedKmh: this.movingDurationMs > 0 ? (this.distanceM / 1000) / (this.movingDurationMs / 3_600_000) : 0,
        start,
        end,
      },
      quality: {
        accelerometerSampleCount: accel.acceptedCount,
        gyroscopeSampleCount: gyro.acceptedCount,
        effectiveAccelHz: accel.effectiveHz,
        effectiveGyroHz: gyro.effectiveHz,
        accelMissingRatio: expectedSamples > 0 ? clamp01(1 - accel.acceptedCount / expectedSamples) : 1,
        gyroMissingRatio: expectedSamples > 0 ? clamp01(1 - gyro.acceptedCount / expectedSamples) : 1,
        reliableFixCount: this.motion.reliableFixCount,
        rejectedFixCount: this.motion.rejectedFixCount,
        meanAccuracyM: this.motion.reliableFixCount > 0 ? this.motion.accuracySum / this.motion.reliableFixCount : 1_000,
        mountStableRatio: collection.mountStableRatio,
        candidateCount,
        suppressedCandidateCount: collection.suppressedCandidateCount,
        normalWindowCount,
        reasons: [],
      },
      locationSamples: this.locationSamples,
      featureWindows,
      rawObjects: rawObjects.map(({ manifest }) => manifest),
      markers: this.markers.map((marker) => {
        const nearest = this.locationSamples.reduce<LocationPoint | undefined>((best, sample) =>
          !best || Math.abs(sample.timestamp - marker.markedAt) < Math.abs(best.timestamp - marker.markedAt) ? sample : best, undefined);
        return { ...marker, location: nearest && Math.abs(nearest.timestamp - marker.markedAt) <= 2000 ? nearest : undefined };
      }),
    };
    this.prepared = { payload, rawObjects };
    return this.prepared;
  }

  private lastRecordedAt(): number {
    // After process death use the last persisted sample, not the time the user reopened the app.
    return this.lastReplayAt || this.startedAt;
  }

  private lastReplayAt = 0;

  private addLocation(location: Location.LocationObject): void {
    const fix: QualityFix = {
      t: location.timestamp,
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      speedKmh: Math.max(0, (location.coords.speed ?? 0) * 3.6),
      altitudeM: location.coords.altitude ?? undefined,
      heading: location.coords.heading ?? undefined,
      accuracyM: location.coords.accuracy ?? Number.POSITIVE_INFINITY,
    };
    const update = this.motion.add(fix);
    this.collector.setMoving(update.state === 'moving');
    if (update.state !== 'moving') this.lastAcceptedAt = null;
    for (const accepted of update.committed) {
      const headingChange = this.lastAcceptedFix?.heading !== undefined && accepted.heading !== undefined
        ? shortestHeadingDelta(this.lastAcceptedFix.heading, accepted.heading)
        : undefined;
      this.collector.setGpsContext(accepted.speedKmh, headingChange);
      if (this.lastAcceptedFix) this.distanceM += haversineM(
        this.lastAcceptedFix.lat,
        this.lastAcceptedFix.lon,
        accepted.lat,
        accepted.lon,
      );
      if (this.lastAcceptedAt !== null) {
        this.movingDurationMs += Math.min(15_000, Math.max(0, accepted.t - this.lastAcceptedAt));
      }
      this.lastAcceptedAt = accepted.t;
      this.lastAcceptedFix = accepted;
      this.locationSamples.push({
        timestamp: accepted.t,
        lat: accepted.lat,
        lon: accepted.lon,
        accuracyM: accepted.accuracyM,
        speedKmh: accepted.speedKmh,
        headingDeg: accepted.heading,
        altitudeM: accepted.altitudeM,
      });
    }
  }

  private attachLocation(window: FeatureWindowV1): FeatureWindowV1 {
    const at = window.triggerAt ?? (window.startedAt + window.endedAt) / 2;
    let rightIndex = this.locationSamples.findIndex((sample) => sample.timestamp >= at);
    if (rightIndex < 0) rightIndex = this.locationSamples.length;
    const left = this.locationSamples[rightIndex - 1];
    const right = this.locationSamples[rightIndex];
    if (left && right && left.accuracyM <= 25 && right.accuracyM <= 25 && right.timestamp - left.timestamp <= 10_000) {
      const fraction = right.timestamp === left.timestamp ? 0 : (at - left.timestamp) / (right.timestamp - left.timestamp);
      return {
        ...window,
        location: {
          timestamp: at,
          lat: left.lat + (right.lat - left.lat) * fraction,
          lon: left.lon + (right.lon - left.lon) * fraction,
          accuracyM: Math.max(left.accuracyM, right.accuracyM),
          speedKmh: interpolateOptional(left.speedKmh, right.speedKmh, fraction),
          headingDeg: left.headingDeg,
          altitudeM: interpolateOptional(left.altitudeM, right.altitudeM, fraction),
          quality: 'INTERPOLATED',
          bracketGapMs: right.timestamp - left.timestamp,
        },
      };
    }
    const nearest = [left, right].filter((sample): sample is LocationPoint => Boolean(sample))
      .sort((a, b) => Math.abs(a.timestamp - at) - Math.abs(b.timestamp - at))[0];
    if (nearest && nearest.accuracyM <= 25 && Math.abs(nearest.timestamp - at) <= 2_000) {
      return { ...window, location: { ...nearest, quality: 'NEAREST', bracketGapMs: Math.abs(nearest.timestamp - at) } };
    }
    return window;
  }
}

function averageAvailable(a: number, b: number): number {
  const values = [a, b].filter(Number.isFinite);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function interpolateOptional(a: number | undefined, b: number | undefined, fraction: number): number | undefined {
  return a !== undefined && b !== undefined ? a + (b - a) * fraction : a ?? b;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
