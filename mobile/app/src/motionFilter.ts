import { haversineM, type GpsFix } from '@/sensorEngine';

export type MotionState = 'acquiring' | 'stationary' | 'moving' | 'temporary-stop';

export const MOTION_ALGORITHM_VERSION = 'motion-v2.0';
export const MAX_FIX_ACCURACY_M = 50;
export const SCORING_ACCURACY_M = 25;
const MAX_SPEED_KMH = 180;
const MOVING_SPEED_KMH = 5;
const STOP_SPEED_KMH = 2;
const STOP_AFTER_MS = 15_000;
const EVIDENCE_WINDOW_MS = 45_000;
const SLOW_MOVE_DISTANCE_M = 30;

export type QualityFix = GpsFix & { accuracyM: number };

export type MotionUpdate = {
  state: MotionState;
  committed: QualityFix[];
  rejectedReason?: 'out-of-order' | 'weak-accuracy' | 'impossible-jump';
};

/** Pure GPS motion gate. Buffers uncertain points and never bridges a rejected gap. */
export class MotionFilter {
  private _state: MotionState = 'acquiring';
  private lastObserved: QualityFix | null = null;
  private lastCommitted: QualityFix | null = null;
  private buffer: QualityFix[] = [];
  private belowStopSince: number | null = null;
  private resumptionStarted = false;
  reliableFixCount = 0;
  rejectedFixCount = 0;
  accuracySum = 0;
  bestAccuracyM = Number.POSITIVE_INFINITY;
  worstAccuracyM = 0;

  get state(): MotionState { return this._state; }

  add(fix: QualityFix): MotionUpdate {
    if (this.lastObserved && fix.t <= this.lastObserved.t) return this.reject('out-of-order');
    if (!Number.isFinite(fix.accuracyM) || fix.accuracyM > MAX_FIX_ACCURACY_M) {
      return this.reject('weak-accuracy');
    }
    if (this.lastObserved) {
      const dtS = (fix.t - this.lastObserved.t) / 1000;
      const impliedKmh = dtS > 0
        ? haversineM(this.lastObserved.lat, this.lastObserved.lon, fix.lat, fix.lon) / dtS * 3.6
        : Infinity;
      if (impliedKmh > MAX_SPEED_KMH) {
        this.buffer = [];
        return this.reject('impossible-jump');
      }
    }

    this.lastObserved = fix;
    this.reliableFixCount += 1;
    this.accuracySum += fix.accuracyM;
    this.bestAccuracyM = Math.min(this.bestAccuracyM, fix.accuracyM);
    this.worstAccuracyM = Math.max(this.worstAccuracyM, fix.accuracyM);
    // A traffic-stop buffer is diagnostic only. Start fresh when motion
    // returns so the accepted path cannot bridge across the pause.
    if (this._state === 'temporary-stop' && fix.speedKmh >= STOP_SPEED_KMH && !this.resumptionStarted) {
      this.buffer = [];
      this.resumptionStarted = true;
    } else if (this._state === 'temporary-stop' && fix.speedKmh < STOP_SPEED_KMH && this.resumptionStarted) {
      this.buffer = [];
      this.resumptionStarted = false;
    }
    this.buffer.push(fix);
    this.trimBuffer(fix.t);

    if (this._state === 'moving') {
      const previous = this.lastCommitted;
      const displacement = previous
        ? haversineM(previous.lat, previous.lon, fix.lat, fix.lon)
        : 0;
      if (fix.speedKmh < STOP_SPEED_KMH && displacement < Math.max(5, fix.accuracyM)) {
        this.belowStopSince ??= fix.t;
        if (fix.t - this.belowStopSince >= STOP_AFTER_MS) {
          this._state = 'temporary-stop';
          this.resumptionStarted = false;
          this.buffer = [fix];
          return { state: this._state, committed: [] };
        }
      } else {
        this.belowStopSince = null;
      }
      if (fix.accuracyM <= SCORING_ACCURACY_M) {
        this.buffer = [];
        this.lastCommitted = fix;
        return { state: this._state, committed: [fix] };
      }
      return { state: this._state, committed: [] };
    }

    if (this.hasMovementEvidence()) {
      this._state = 'moving';
      this.resumptionStarted = false;
      this.belowStopSince = null;
      const committed = this.buffer.filter((f) => f.accuracyM <= SCORING_ACCURACY_M);
      this.buffer = [];
      if (committed.length) this.lastCommitted = committed[committed.length - 1]!;
      return { state: this._state, committed };
    }

    this._state = this.reliableFixCount < 3 ? 'acquiring' : this._state === 'temporary-stop' ? 'temporary-stop' : 'stationary';
    return { state: this._state, committed: [] };
  }

  private hasMovementEvidence(): boolean {
    if (this.buffer.length < 3) return false;
    const first = this.buffer[0]!;
    const last = this.buffer[this.buffer.length - 1]!;
    const displacement = haversineM(first.lat, first.lon, last.lat, last.lon);
    const accuracyAllowance = Math.max(first.accuracyM, last.accuracyM);
    const fastFixes = this.buffer.filter((f) => f.speedKmh >= MOVING_SPEED_KMH).length;
    const sustainedSpeed = fastFixes >= 3 && displacement >= Math.max(10, accuracyAllowance);
    const consistentSlowMove = displacement >= SLOW_MOVE_DISTANCE_M && this.pathLength() <= displacement * 2.25;
    return sustainedSpeed || consistentSlowMove;
  }

  private pathLength(): number {
    let total = 0;
    for (let i = 1; i < this.buffer.length; i++) {
      const a = this.buffer[i - 1]!;
      const b = this.buffer[i]!;
      total += haversineM(a.lat, a.lon, b.lat, b.lon);
    }
    return total;
  }

  private trimBuffer(now: number): void {
    while (this.buffer.length > 1 && this.buffer[0]!.t < now - EVIDENCE_WINDOW_MS) this.buffer.shift();
  }

  private reject(reason: MotionUpdate['rejectedReason']): MotionUpdate {
    this.rejectedFixCount += 1;
    return { state: this._state, committed: [], rejectedReason: reason };
  }
}
