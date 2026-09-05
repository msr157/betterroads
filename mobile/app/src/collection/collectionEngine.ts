import type { FeatureWindowV1, WindowKind } from '../types';
import { extractFeatureVectorV1, type FeatureAccelSample, type FeatureGyroSample } from './features';
import { magnitude, OrientationProcessor, type Vector3 } from './orientation';
import { EncounterWindowManager, TimeRingBuffer, type CandidateEncounter } from './ringBuffer';
import { CandidateTriggerDetector, type CandidateTriggerResult } from './triggers';
import type { VehicleProfile } from './vehicleProfiles';

const SENSOR_RETENTION_MS = 7_000;
const NORMAL_WINDOW_MS = 5_000;

export type RawAccelSample = FeatureAccelSample & {
  monotonicUs: number;
  x: number;
  y: number;
  z: number;
};

export type RawGyroSample = FeatureGyroSample & { monotonicUs: number };

export type CompletedCollectionWindow = {
  window: FeatureWindowV1;
  rawAccel: RawAccelSample[];
  rawGyro: RawGyroSample[];
};

export type CollectionEngineSnapshot = {
  mountCalibrated: boolean;
  mountStable: boolean;
  mountStableRatio: number;
  candidateCount: number;
  suppressedCandidateCount: number;
  normalWindowCount: number;
};

/** Pure sensor-window collector. It emits features and raw research windows, never road labels. */
export class CollectionEngine {
  private readonly orientation: OrientationProcessor;
  private readonly triggerDetector: CandidateTriggerDetector;
  private readonly encounters = new EncounterWindowManager();
  private readonly accel = new TimeRingBuffer<RawAccelSample>(SENSOR_RETENTION_MS);
  private readonly gyro = new TimeRingBuffer<RawGyroSample>(SENSOR_RETENTION_MS);
  private latestGyroMagnitude = 0;
  private moving = false;
  private nextNormalAt: number | null = null;
  private activeTrigger: CandidateTriggerResult | null = null;
  private candidateCount = 0;
  private suppressedCandidateCount = 0;
  private normalWindowCount = 0;
  private speedKmh: number | undefined;
  private headingChangeDeg: number | undefined;

  readonly completed: CompletedCollectionWindow[] = [];

  constructor(
    private readonly profile: VehicleProfile,
    private readonly makeId: () => string,
    private readonly random: () => number = Math.random,
  ) {
    this.orientation = new OrientationProcessor(profile.calibrationMs);
    this.triggerDetector = new CandidateTriggerDetector(profile);
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
    if (!moving) this.nextNormalAt = null;
  }

  setGpsContext(speedKmh?: number, headingChangeDeg?: number): void {
    this.speedKmh = speedKmh;
    this.headingChangeDeg = headingChangeDeg;
  }

  addGyroscope(t: number, monotonicUs: number, value: Vector3): void {
    if (![t, monotonicUs, value.x, value.y, value.z].every(Number.isFinite)) return;
    this.latestGyroMagnitude = magnitude(value);
    this.gyro.push({ t, monotonicUs, ...value });
  }

  addAccelerometer(t: number, monotonicUs: number, valueMs2: Vector3): void {
    const oriented = this.orientation.add(t, valueMs2, this.latestGyroMagnitude);
    if (!oriented) return;
    this.accel.push({
      t,
      monotonicUs,
      ...valueMs2,
      verticalMs2: oriented.verticalMs2,
      horizontalMs2: oriented.horizontalMs2,
      dynamicMagnitudeMs2: oriented.dynamicMagnitudeMs2,
      mountStable: oriented.mountStable,
    });

    const eligible = this.moving && oriented.mountStable;
    const trigger = this.triggerDetector.add(oriented, eligible);
    if (trigger) this.openCandidate(trigger);

    const completed = this.encounters.complete(t);
    if (completed) this.completeCandidate(completed);

    if (!eligible) {
      this.nextNormalAt = null;
      return;
    }
    this.nextNormalAt ??= t + this.nextNormalDelayMs();
    if (t >= this.nextNormalAt && this.normalWindowCount < this.profile.normalWindowCap) {
      this.completeWindow('RANDOM_NORMAL', {
        startedAt: t - NORMAL_WINDOW_MS,
        triggerAt: t,
        endsAt: t,
        triggerReasons: [],
      });
      this.normalWindowCount += 1;
      this.nextNormalAt = t + this.nextNormalDelayMs();
    }
  }

  snapshot(): CollectionEngineSnapshot {
    const mount = this.orientation.snapshot();
    return {
      mountCalibrated: mount.calibrated,
      mountStable: mount.stable,
      mountStableRatio: mount.stableRatio,
      candidateCount: this.candidateCount,
      suppressedCandidateCount: this.suppressedCandidateCount,
      normalWindowCount: this.normalWindowCount,
    };
  }

  finish(now: number): void {
    const pending = this.encounters.forceComplete(now);
    if (pending && this.activeTrigger) this.completeCandidate(pending);
  }

  private openCandidate(trigger: CandidateTriggerResult): void {
    if (this.candidateCount >= this.profile.candidateCap) {
      this.suppressedCandidateCount += 1;
      return;
    }
    this.activeTrigger = trigger;
    this.encounters.trigger(trigger.at, trigger.reasons);
  }

  private completeCandidate(encounter: CandidateEncounter): void {
    if (!this.activeTrigger) return;
    this.completeWindow('CANDIDATE', encounter, this.activeTrigger);
    this.activeTrigger = null;
    this.candidateCount += 1;
  }

  private completeWindow(kind: WindowKind, encounter: CandidateEncounter, trigger?: CandidateTriggerResult): void {
    const rawAccel = this.accel.between(encounter.startedAt, encounter.endsAt);
    const rawGyro = this.gyro.between(encounter.startedAt, encounter.endsAt);
    if (rawAccel.length < 2) return;
    const windowId = this.makeId();
    this.completed.push({
      window: {
        windowId,
        encounterId: this.makeId(),
        kind,
        startedAt: encounter.startedAt,
        triggerAt: kind === 'CANDIDATE' ? encounter.triggerAt : undefined,
        endedAt: encounter.endsAt,
        triggerReasons: [...encounter.triggerReasons],
        triggerMeasurements: trigger ? { ...trigger.measurements } : undefined,
        featureVersion: 'features-v1',
        features: extractFeatureVectorV1(rawAccel, rawGyro, {
          startedAt: encounter.startedAt,
          endedAt: encounter.endsAt,
          speedKmh: this.speedKmh,
          headingChangeDeg: this.headingChangeDeg,
        }),
      },
      rawAccel,
      rawGyro,
    });
  }

  private nextNormalDelayMs(): number {
    const boundedRandom = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, this.random()));
    const exponential = -Math.log(1 - boundedRandom) * this.profile.normalIntervalMeanMs;
    return Math.min(60_000, Math.max(5_000, exponential));
  }
}
