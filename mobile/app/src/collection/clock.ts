export type ClockedTimestamp = {
  /** Original native monotonic sensor timestamp, normalized to integer microseconds. */
  monotonicUs: number;
  /** Epoch milliseconds derived from the first callback's clock offset. */
  epochMs: number;
};

export type SensorClockStats = {
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
  effectiveHz: number;
  jitterMs: number;
  estimatedClockDriftPpm: number;
};

/**
 * Maps Expo's monotonic sensor timestamp (seconds) to epoch time without
 * replacing the sample time with callback arrival time. One mapper is used
 * per physical sensor so cadence and dropouts remain independently auditable.
 */
export class SensorClock {
  private epochOffsetMs: number | null = null;
  private firstMonotonicUs: number | null = null;
  private lastMonotonicUs: number | null = null;
  private firstArrivalEpochMs: number | null = null;
  private lastArrivalEpochMs: number | null = null;
  private acceptedCount = 0;
  private rejectedCount = 0;
  private duplicateCount = 0;
  private outOfOrderCount = 0;
  private intervalsMs: number[] = [];

  map(timestampSeconds: number, arrivalEpochMs = Date.now()): ClockedTimestamp | null {
    if (!Number.isFinite(timestampSeconds) || timestampSeconds < 0 || !Number.isFinite(arrivalEpochMs)) {
      this.rejectedCount += 1;
      return null;
    }

    const monotonicUs = Math.round(timestampSeconds * 1_000_000);
    if (this.lastMonotonicUs !== null && monotonicUs <= this.lastMonotonicUs) {
      this.rejectedCount += 1;
      if (monotonicUs === this.lastMonotonicUs) this.duplicateCount += 1;
      else this.outOfOrderCount += 1;
      return null;
    }

    if (this.epochOffsetMs === null) {
      this.epochOffsetMs = arrivalEpochMs - monotonicUs / 1000;
      this.firstMonotonicUs = monotonicUs;
      this.firstArrivalEpochMs = arrivalEpochMs;
    } else if (this.lastMonotonicUs !== null) {
      const intervalMs = (monotonicUs - this.lastMonotonicUs) / 1000;
      this.intervalsMs.push(intervalMs);
      if (this.intervalsMs.length > 10_000) this.intervalsMs.shift();
    }

    this.lastMonotonicUs = monotonicUs;
    this.lastArrivalEpochMs = arrivalEpochMs;
    this.acceptedCount += 1;
    return {
      monotonicUs,
      epochMs: Math.round(this.epochOffsetMs + monotonicUs / 1000),
    };
  }

  get offsetMs(): number | null {
    return this.epochOffsetMs;
  }

  snapshot(): SensorClockStats {
    const elapsedSensorMs =
      this.firstMonotonicUs !== null && this.lastMonotonicUs !== null
        ? (this.lastMonotonicUs - this.firstMonotonicUs) / 1000
        : 0;
    const effectiveHz = elapsedSensorMs > 0 && this.acceptedCount > 1
      ? ((this.acceptedCount - 1) * 1000) / elapsedSensorMs
      : 0;
    const meanInterval = this.intervalsMs.length > 0
      ? this.intervalsMs.reduce((sum, value) => sum + value, 0) / this.intervalsMs.length
      : 0;
    const jitterMs = this.intervalsMs.length > 0
      ? Math.sqrt(
        this.intervalsMs.reduce((sum, value) => sum + (value - meanInterval) ** 2, 0) /
          this.intervalsMs.length,
      )
      : 0;
    const arrivalElapsedMs =
      this.firstArrivalEpochMs !== null && this.lastArrivalEpochMs !== null
        ? this.lastArrivalEpochMs - this.firstArrivalEpochMs
        : 0;
    const estimatedClockDriftPpm = elapsedSensorMs > 0
      ? ((arrivalElapsedMs - elapsedSensorMs) / elapsedSensorMs) * 1_000_000
      : 0;

    return {
      acceptedCount: this.acceptedCount,
      rejectedCount: this.rejectedCount,
      duplicateCount: this.duplicateCount,
      outOfOrderCount: this.outOfOrderCount,
      effectiveHz,
      jitterMs,
      estimatedClockDriftPpm,
    };
  }
}
