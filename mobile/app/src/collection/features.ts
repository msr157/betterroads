import type { DistributionFeatures, FeatureVectorV1 } from '../types';

export const FEATURE_VERSION = 'features-v1' as const;
export const FEATURE_SAMPLE_HZ = 50;

export type FeatureAccelSample = {
  t: number;
  verticalMs2: number;
  horizontalMs2: number;
  dynamicMagnitudeMs2: number;
  mountStable: boolean;
};

export type FeatureGyroSample = { t: number; x: number; y: number; z: number };

export type FeatureContext = {
  startedAt: number;
  endedAt: number;
  speedKmh?: number;
  headingChangeDeg?: number;
};

/** Canonical v1 features. Keep in numeric lockstep with ai/betterroads_ai/features.py. */
export function extractFeatureVectorV1(
  accelSamples: FeatureAccelSample[],
  gyroSamples: FeatureGyroSample[],
  context: FeatureContext,
): FeatureVectorV1 {
  if (context.endedAt <= context.startedAt) throw new Error('Feature window must have positive duration');
  const accel = resample(
    accelSamples,
    context.startedAt,
    context.endedAt,
    (sample) => [sample.verticalMs2, sample.horizontalMs2, sample.dynamicMagnitudeMs2, sample.mountStable ? 1 : 0],
  );
  const gyro = resample(
    gyroSamples,
    context.startedAt,
    context.endedAt,
    (sample) => [sample.x, sample.y, sample.z],
  );
  const vertical = accel.values.map((row) => row[0]!);
  const horizontal = accel.values.map((row) => row[1]!);
  const dynamicMagnitude = accel.values.map((row) => row[2]!);
  const stableValues = accel.values.map((row) => row[3]!);
  const gyroMagnitude = gyro.values.map((row) => Math.hypot(row[0]!, row[1]!, row[2]!));
  const stepSeconds = 1 / FEATURE_SAMPLE_HZ;
  const jerk = vertical.slice(1).map((value, index) => (value - vertical[index]!) / stepSeconds);

  return {
    vertical: distribution(vertical),
    horizontal: distribution(horizontal),
    dynamicMagnitude: distribution(dynamicMagnitude),
    jerk: distribution(jerk),
    gyroMagnitude: distribution(gyroMagnitude),
    frequency: frequencyFeatures(vertical, FEATURE_SAMPLE_HZ),
    context: {
      durationMs: context.endedAt - context.startedAt,
      speedKmh: finiteOptional(context.speedKmh),
      headingChangeDeg: finiteOptional(context.headingChangeDeg),
      movementState: 'moving',
      mountStableRatio: stableValues.length > 0
        ? stableValues.reduce((sum, value) => sum + value, 0) / stableValues.length
        : 0,
      accelerometerSampleCount: accelSamples.length,
      gyroscopeSampleCount: gyroSamples.length,
      accelerometerMissingRatio: accel.missingRatio,
      gyroscopeMissingRatio: gyro.missingRatio,
    },
  };
}

function resample<T extends { t: number }>(
  samples: T[],
  startMs: number,
  endMs: number,
  values: (sample: T) => number[],
): { values: number[][]; missingRatio: number } {
  const valid = samples
    .filter((sample) => Number.isFinite(sample.t) && sample.t >= startMs - 100 && sample.t <= endMs + 100)
    .sort((a, b) => a.t - b.t);
  const stepMs = 1000 / FEATURE_SAMPLE_HZ;
  const expected = Math.floor((endMs - startMs) / stepMs) + 1;
  if (valid.length === 0) return { values: [], missingRatio: 1 };
  const output: number[][] = [];
  let cursor = 0;
  let missing = 0;
  for (let index = 0; index < expected; index += 1) {
    const t = startMs + index * stepMs;
    while (cursor + 1 < valid.length && valid[cursor + 1]!.t < t) cursor += 1;
    const left = valid[cursor];
    const right = valid[cursor + 1];
    if (!left || !right || t < left.t || t > right.t || right.t - left.t > stepMs * 3) {
      missing += 1;
      continue;
    }
    const leftValues = values(left);
    const rightValues = values(right);
    const fraction = right.t === left.t ? 0 : (t - left.t) / (right.t - left.t);
    output.push(leftValues.map((value, component) => value + (rightValues[component]! - value) * fraction));
  }
  return { values: output, missingRatio: expected > 0 ? missing / expected : 1 };
}

export function distribution(values: number[]): DistributionFeatures {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return {
      min: 0, max: 0, mean: 0, standardDeviation: 0, rms: 0, peakToPeak: 0,
      median: 0, mad: 0, p05: 0, p25: 0, p75: 0, p95: 0, crestFactor: 0, zeroCrossings: 0,
    };
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const rms = Math.sqrt(finite.reduce((sum, value) => sum + value ** 2, 0) / finite.length);
  const medianValue = percentileSorted(sorted, 0.5);
  const mad = percentileSorted(finite.map((value) => Math.abs(value - medianValue)).sort((a, b) => a - b), 0.5);
  let zeroCrossings = 0;
  for (let index = 1; index < finite.length; index += 1) {
    if ((finite[index - 1]! < 0 && finite[index]! >= 0) || (finite[index - 1]! > 0 && finite[index]! <= 0)) {
      zeroCrossings += 1;
    }
  }
  const maximumAbsolute = Math.max(...finite.map(Math.abs));
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean,
    standardDeviation: Math.sqrt(finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length),
    rms,
    peakToPeak: sorted[sorted.length - 1]! - sorted[0]!,
    median: medianValue,
    mad,
    p05: percentileSorted(sorted, 0.05),
    p25: percentileSorted(sorted, 0.25),
    p75: percentileSorted(sorted, 0.75),
    p95: percentileSorted(sorted, 0.95),
    crestFactor: rms > 0 ? maximumAbsolute / rms : 0,
    zeroCrossings,
  };
}

function frequencyFeatures(values: number[], sampleHz: number): FeatureVectorV1['frequency'] {
  const n = values.length;
  if (n < 4) {
    return { energy2To5Hz: 0, energy5To10Hz: 0, energy10To20Hz: 0, dominantFrequencyHz: 0, spectralEntropy: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const powers: Array<{ frequency: number; power: number }> = [];
  for (let k = 1; k <= Math.floor(n / 2); k += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < n; index += 1) {
      const angle = 2 * Math.PI * k * index / n;
      const centered = values[index]! - mean;
      real += centered * Math.cos(angle);
      imaginary -= centered * Math.sin(angle);
    }
    powers.push({ frequency: k * sampleHz / n, power: (real ** 2 + imaginary ** 2) / n ** 2 });
  }
  const band = (low: number, high: number) => powers
    .filter((entry) => entry.frequency >= low && entry.frequency < high)
    .reduce((sum, entry) => sum + entry.power, 0);
  const totalPower = powers.reduce((sum, entry) => sum + entry.power, 0);
  const entropy = totalPower > 0
    ? -powers.reduce((sum, entry) => {
      const probability = entry.power / totalPower;
      return probability > 0 ? sum + probability * Math.log(probability) : sum;
    }, 0) / Math.log(powers.length)
    : 0;
  const dominant = powers.reduce((best, entry) => entry.power > best.power ? entry : best, powers[0]!);
  return {
    energy2To5Hz: band(2, 5),
    energy5To10Hz: band(5, 10),
    energy10To20Hz: band(10, 20),
    dominantFrequencyHz: dominant.frequency,
    spectralEntropy: Number.isFinite(entropy) ? entropy : 0,
  };
}

function percentileSorted(sorted: number[], probability: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function finiteOptional(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}
