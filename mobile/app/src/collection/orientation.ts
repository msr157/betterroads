export const STANDARD_GRAVITY_MS2 = 9.80665;

export type Vector3 = { x: number; y: number; z: number };

export type OrientedAcceleration = {
  t: number;
  raw: Vector3;
  gravity: Vector3;
  dynamic: Vector3;
  gravityMagnitude: number;
  verticalMs2: number;
  horizontalMs2: number;
  dynamicMagnitudeMs2: number;
  mountStable: boolean;
  calibrated: boolean;
};

export type MountSnapshot = {
  calibrated: boolean;
  stable: boolean;
  stableRatio: number;
  abruptOrientationChanges: number;
};

const GRAVITY_ALPHA = 0.96;
const GRAVITY_MIN_MS2 = 7.5;
const GRAVITY_MAX_MS2 = 12.5;
const MAX_CALIBRATION_ROTATION_RAD_S = 0.35;
const MAX_STABLE_ROTATION_RAD_S = 1.5;
const MAX_GRAVITY_DIRECTION_STEP_DEG = 12;
const REQUIRED_STABLE_CALIBRATION_MS = 3_000;

/** Gravity-aligns acceleration without assuming a portrait or landscape mount. */
export class OrientationProcessor {
  private gravity: Vector3 | null = null;
  private stableSince: number | null = null;
  private totalSamples = 0;
  private stableSamples = 0;
  private abruptOrientationChanges = 0;
  private lastStable = false;
  private lastCalibrated = false;
  private hasCalibratedOnce = false;

  constructor(private readonly requiredStableCalibrationMs = REQUIRED_STABLE_CALIBRATION_MS) {}

  add(t: number, raw: Vector3, gyroMagnitudeRadS = 0): OrientedAcceleration | null {
    if (![t, raw.x, raw.y, raw.z, gyroMagnitudeRadS].every(Number.isFinite)) return null;

    const previousGravity = this.gravity;
    if (!this.gravity) this.gravity = { ...raw };
    else {
      this.gravity = {
        x: GRAVITY_ALPHA * this.gravity.x + (1 - GRAVITY_ALPHA) * raw.x,
        y: GRAVITY_ALPHA * this.gravity.y + (1 - GRAVITY_ALPHA) * raw.y,
        z: GRAVITY_ALPHA * this.gravity.z + (1 - GRAVITY_ALPHA) * raw.z,
      };
    }

    const gravity = this.gravity;
    const gravityMagnitude = magnitude(gravity);
    const directionStepDeg = previousGravity ? angleDeg(previousGravity, gravity) : 0;
    const earthLike = gravityMagnitude >= GRAVITY_MIN_MS2 && gravityMagnitude <= GRAVITY_MAX_MS2;
    const abrupt = directionStepDeg > MAX_GRAVITY_DIRECTION_STEP_DEG;
    if (abrupt) this.abruptOrientationChanges += 1;

    const calibrationStable = earthLike && !abrupt && gyroMagnitudeRadS <= MAX_CALIBRATION_ROTATION_RAD_S;
    if (calibrationStable) this.stableSince ??= t;
    else this.stableSince = null;
    const calibrated = this.stableSince !== null && t - this.stableSince >= this.requiredStableCalibrationMs;
    if (calibrated) this.hasCalibratedOnce = true;
    const mountStable = calibrated && earthLike && !abrupt && gyroMagnitudeRadS <= MAX_STABLE_ROTATION_RAD_S;

    if (this.hasCalibratedOnce) {
      this.totalSamples += 1;
      if (mountStable) this.stableSamples += 1;
    }
    this.lastStable = mountStable;
    this.lastCalibrated = calibrated;

    const unitGravity = gravityMagnitude > 0
      ? { x: gravity.x / gravityMagnitude, y: gravity.y / gravityMagnitude, z: gravity.z / gravityMagnitude }
      : { x: 0, y: 0, z: 1 };
    const dynamic = { x: raw.x - gravity.x, y: raw.y - gravity.y, z: raw.z - gravity.z };
    const verticalMs2 = dot(dynamic, unitGravity);
    const dynamicMagnitudeMs2 = magnitude(dynamic);
    const horizontalMs2 = Math.sqrt(Math.max(0, dynamicMagnitudeMs2 ** 2 - verticalMs2 ** 2));

    return {
      t,
      raw,
      gravity: { ...gravity },
      dynamic,
      gravityMagnitude,
      verticalMs2,
      horizontalMs2,
      dynamicMagnitudeMs2,
      mountStable,
      calibrated,
    };
  }

  snapshot(): MountSnapshot {
    return {
      calibrated: this.lastCalibrated,
      stable: this.lastStable,
      stableRatio: this.totalSamples > 0 ? this.stableSamples / this.totalSamples : 0,
      abruptOrientationChanges: this.abruptOrientationChanges,
    };
  }
}

export function magnitude(v: Vector3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function angleDeg(a: Vector3, b: Vector3): number {
  const denominator = magnitude(a) * magnitude(b);
  if (denominator === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, dot(a, b) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}
