import type { OrientedAcceleration } from './orientation';
import { TimeRingBuffer } from './ringBuffer';
import type { VehicleProfile } from './vehicleProfiles';

export type CandidateTriggerReason = 'Z_DIFF' | 'WINDOW_RMS' | 'DYNAMIC_MAGNITUDE';

export type CandidateTriggerResult = {
  at: number;
  reasons: CandidateTriggerReason[];
  measurements: {
    zDiffMs2: number;
    rmsMs2: number;
    dynamicMagnitudeMs2: number;
    rollingMedianMs2: number;
    rollingMadMs2: number;
  };
};

type MagnitudeSample = { t: number; vertical: number; magnitude: number };

/** High-recall, neutral candidate gate. It deliberately does not classify road defects. */
export class CandidateTriggerDetector {
  private readonly shortWindow: TimeRingBuffer<MagnitudeSample>;
  private readonly baselineWindow = new TimeRingBuffer<MagnitudeSample>(10_000);
  private previousVertical: number | null = null;

  constructor(private readonly profile: VehicleProfile) {
    this.shortWindow = new TimeRingBuffer<MagnitudeSample>(profile.thresholds.rmsWindowMs);
  }

  add(sample: OrientedAcceleration, eligible: boolean): CandidateTriggerResult | null {
    const current = { t: sample.t, vertical: sample.verticalMs2, magnitude: sample.dynamicMagnitudeMs2 };
    const previousVertical = this.previousVertical;
    this.previousVertical = sample.verticalMs2;
    this.shortWindow.push(current);
    this.baselineWindow.push(current);

    if (!eligible || !sample.mountStable || previousVertical === null) return null;

    const short = this.shortWindow.between(sample.t - this.profile.thresholds.rmsWindowMs, sample.t);
    const baseline = this.baselineWindow.between(sample.t - 10_000, sample.t - this.profile.thresholds.rmsWindowMs);
    const rmsMs2 = rms(short.map((value) => value.vertical));
    const baselineMagnitudes = baseline.map((value) => value.magnitude);
    const rollingMedianMs2 = median(baselineMagnitudes);
    const rollingMadMs2 = median(baselineMagnitudes.map((value) => Math.abs(value - rollingMedianMs2)));
    const robustThreshold = rollingMedianMs2 + this.profile.thresholds.rollingMadMultiplier * rollingMadMs2;
    const dynamicThreshold = Math.max(this.profile.thresholds.fixedDynamicMagnitudeMs2, robustThreshold);
    const zDiffMs2 = Math.abs(sample.verticalMs2 - previousVertical);
    const reasons: CandidateTriggerReason[] = [];
    if (zDiffMs2 >= this.profile.thresholds.zDiffMs2) reasons.push('Z_DIFF');
    if (rmsMs2 >= this.profile.thresholds.rmsMs2) reasons.push('WINDOW_RMS');
    if (sample.dynamicMagnitudeMs2 >= dynamicThreshold) reasons.push('DYNAMIC_MAGNITUDE');
    if (reasons.length === 0) return null;

    return {
      at: sample.t,
      reasons,
      measurements: {
        zDiffMs2,
        rmsMs2,
        dynamicMagnitudeMs2: sample.dynamicMagnitudeMs2,
        rollingMedianMs2,
        rollingMadMs2,
      },
    };
  }
}

function rms(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

