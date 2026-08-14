import type { JourneySegment, RoadEvent, RoadEventType, VehicleType } from '@/types';
import { baselineFor } from '@/vehicles';

/**
 * Pure detection/scoring engine — the production implementation of the
 * original Android sensing formulas. No React/Expo imports: it is fed samples and emits
 * events/segments, so the same math can run under Jest, a replay harness, or
 * the AI engine's reprocessing pipeline.
 *
 * All thresholds are field-tuned values; move them to shared remote
 * configuration when server-managed calibration is introduced.
 */

// ── Tuning constants (from the Kotlin prototype) ────────────────────────────

/** Gravity low-pass smoothing factor. */
const GRAVITY_ALPHA = 0.8;
/** Sliding RMS window length. */
const RMS_WINDOW_MS = 500;
/** Peak vertical acceleration (m/s², after floor subtraction) → BUMP. */
const BUMP_THRESHOLD = 12;
/** …and above this → POTHOLE. */
const POTHOLE_THRESHOLD = 22;
/** Ignore jolts below this speed — parking-lot noise, phone handling. */
const MIN_EVENT_SPEED_KMH = 8;
/** Yaw rate (rad/s) → SWERVE, gated to real riding speed. */
const SWERVE_THRESHOLD_RAD_S = 0.6;
const MIN_SWERVE_SPEED_KMH = 15;
/** Minimum gap between detected events. */
const EVENT_COOLDOWN_MS = 1000;
/** Segment length for RQI aggregation. */
const SEGMENT_LENGTH_M = 300;
/**
 * Mount stability: total gravity magnitude must be earth-like and mostly on
 * the z-axis, else the phone is in a hand/pocket and jolts are meaningless.
 */
const GRAVITY_MIN = 8;
const GRAVITY_MAX = 12;
const MIN_VERTICALITY_RATIO = 0.4;

export type AccelSample = {
  /** Epoch ms. */
  t: number;
  x: number;
  y: number;
  z: number;
};

export type GpsFix = {
  t: number;
  lat: number;
  lon: number;
  speedKmh: number;
  altitudeM?: number;
  heading?: number;
};

export type EngineSnapshot = {
  /** Current windowed RMS after floor subtraction (m/s²). */
  liveRms: number;
  /** RQI of the segment being accumulated right now. */
  liveSegmentRqi: number;
  distanceM: number;
  eventCount: number;
  segmentCount: number;
  isStableMount: boolean;
};

export class SensorEngine {
  private readonly baselineRms: number;

  private gravity: [number, number, number] = [0, 0, 9.81];
  private window: { t: number; value: number }[] = [];
  private lastEventAt = 0;
  private lastFix: GpsFix | null = null;
  private isStableMount = true;

  private distanceM = 0;
  private segmentIndex = 0;
  private segmentStartFix: GpsFix | null = null;
  private segmentRmsSum = 0;
  private segmentRmsCount = 0;
  private segmentEventCount = 0;

  readonly events: RoadEvent[] = [];
  readonly segments: JourneySegment[] = [];

  constructor(
    readonly vehicleType: VehicleType,
    private readonly makeId: () => string,
  ) {
    this.baselineRms = baselineFor(vehicleType);
  }

  get baseFloorRms(): number {
    return this.baselineRms;
  }

  /** Feed a raw accelerometer sample (device coordinates, m/s²). */
  addAccelSample(s: AccelSample): void {
    // Isolate gravity with a low-pass filter; the remainder is dynamic force.
    const g = this.gravity;
    g[0] = GRAVITY_ALPHA * g[0] + (1 - GRAVITY_ALPHA) * s.x;
    g[1] = GRAVITY_ALPHA * g[1] + (1 - GRAVITY_ALPHA) * s.y;
    g[2] = GRAVITY_ALPHA * g[2] + (1 - GRAVITY_ALPHA) * s.z;

    const gravityMag = Math.hypot(g[0], g[1], g[2]);
    const verticalityRatio = gravityMag > 0 ? Math.abs(g[2]) / gravityMag : 0;
    this.isStableMount =
      gravityMag >= GRAVITY_MIN && gravityMag <= GRAVITY_MAX && verticalityRatio >= MIN_VERTICALITY_RATIO;

    // Dynamic vertical force with the vehicle's own vibration floor removed.
    const dynamicZ = Math.abs(s.z - g[2]);
    const clean = Math.max(0, dynamicZ - this.baselineRms);

    this.window.push({ t: s.t, value: clean });
    const cutoff = s.t - RMS_WINDOW_MS;
    while (this.window.length > 0 && this.window[0]!.t < cutoff) this.window.shift();

    if (!this.isStableMount) return;

    const speedKmh = this.lastFix?.speedKmh ?? 0;
    if (clean > BUMP_THRESHOLD && speedKmh > MIN_EVENT_SPEED_KMH) {
      this.recordEvent(clean > POTHOLE_THRESHOLD ? 'POTHOLE' : 'BUMP', s, clean);
    }
  }

  /** Feed a gyroscope sample (rad/s). */
  addGyroSample(t: number, zRotation: number): void {
    const speedKmh = this.lastFix?.speedKmh ?? 0;
    if (
      this.isStableMount &&
      Math.abs(zRotation) > SWERVE_THRESHOLD_RAD_S &&
      speedKmh > MIN_SWERVE_SPEED_KMH
    ) {
      this.recordEvent('SWERVE', { t, x: 0, y: 0, z: 0 }, undefined, Math.abs(zRotation));
    }
  }

  /** Feed a GPS fix; drives distance accumulation and segment boundaries. */
  addGpsFix(fix: GpsFix): void {
    if (this.lastFix) {
      this.distanceM += haversineM(this.lastFix.lat, this.lastFix.lon, fix.lat, fix.lon);
    }
    this.segmentStartFix ??= fix;
    this.lastFix = fix;

    if (this.distanceM > 0 && Math.floor(this.distanceM / SEGMENT_LENGTH_M) > this.segmentIndex) {
      this.closeSegment(fix);
    }
  }

  /** Current live telemetry for the recording UI. */
  snapshot(): EngineSnapshot {
    const rms = this.windowRms();
    return {
      liveRms: rms,
      liveSegmentRqi: computeRqi(rms, this.segmentEventCount),
      distanceM: this.distanceM,
      eventCount: this.events.length,
      segmentCount: this.segments.length,
      isStableMount: this.isStableMount,
    };
  }

  /** Close out the in-progress segment (call once when the journey ends). */
  finish(): void {
    if (this.lastFix && this.segmentStartFix && this.segmentRmsCount > 0) {
      this.closeSegment(this.lastFix);
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private recordEvent(
    type: RoadEventType,
    s: AccelSample,
    peakZ?: number,
    gyroZ?: number,
  ): void {
    if (s.t - this.lastEventAt < EVENT_COOLDOWN_MS) return;
    const fix = this.lastFix;
    if (!fix) return; // No location yet — an unplottable event helps nobody.
    this.lastEventAt = s.t;
    this.segmentEventCount += 1;

    // Severity: how far past the detection threshold the reading landed.
    const severity =
      type === 'SWERVE'
        ? clamp01((gyroZ ?? SWERVE_THRESHOLD_RAD_S) / (SWERVE_THRESHOLD_RAD_S * 3))
        : clamp01(((peakZ ?? BUMP_THRESHOLD) - BUMP_THRESHOLD) / (POTHOLE_THRESHOLD * 1.5 - BUMP_THRESHOLD));

    this.events.push({
      id: this.makeId(),
      type,
      severity,
      timestamp: s.t,
      lat: fix.lat,
      lon: fix.lon,
      altitudeM: fix.altitudeM,
      speedKmh: fix.speedKmh,
      accelX: s.x,
      accelY: s.y,
      accelZ: s.z,
      gyroZ,
      heading: fix.heading,
    });
  }

  private closeSegment(endFix: GpsFix): void {
    const start = this.segmentStartFix ?? endFix;
    const avgRms = this.segmentRmsCount > 0 ? this.segmentRmsSum / this.segmentRmsCount : this.windowRms();

    this.segments.push({
      segmentIndex: this.segmentIndex,
      startLat: start.lat,
      startLon: start.lon,
      endLat: endFix.lat,
      endLon: endFix.lon,
      lengthM: SEGMENT_LENGTH_M,
      rqiScore: computeRqi(avgRms, this.segmentEventCount),
      eventCount: this.segmentEventCount,
      avgRms,
    });

    this.segmentIndex = Math.floor(this.distanceM / SEGMENT_LENGTH_M);
    this.segmentStartFix = endFix;
    this.segmentRmsSum = 0;
    this.segmentRmsCount = 0;
    this.segmentEventCount = 0;
  }

  private windowRms(): number {
    if (this.window.length === 0) return 0;
    const sumSq = this.window.reduce((acc, w) => acc + w.value * w.value, 0);
    const rms = Math.sqrt(sumSq / this.window.length);
    // Segment average accumulates on read cadence (UI tick ~1 Hz), matching
    // the prototype's periodic sampling of live RMS.
    this.segmentRmsSum += rms;
    this.segmentRmsCount += 1;
    return rms;
  }
}

/**
 * Segment RQI, 0–100: perfect road minus a roughness penalty (sustained
 * vibration) minus an event penalty (discrete jolts). Floors at 10 so a
 * horror stretch still renders as "very poor" rather than vanishing to 0.
 */
export function computeRqi(avgRms: number, eventCount: number): number {
  const roughnessPenalty = Math.min(40, avgRms * 10);
  const eventPenalty = Math.min(50, eventCount * 12);
  return Math.min(100, Math.max(10, 100 - roughnessPenalty - eventPenalty));
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
