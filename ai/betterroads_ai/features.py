"""Canonical collection-v3 feature extraction.

This is deliberately a direct Python port of
``mobile/app/src/collection/features.ts``. Keep formulas and field names in
lockstep; changing either implementation requires a new feature version.
"""

from __future__ import annotations

import math
from typing import Any, Callable, Sequence

FEATURE_VERSION = "features-v1"
FEATURE_SAMPLE_HZ = 50


def _percentile(values: Sequence[float], probability: float) -> float:
    if not values:
        return 0.0
    position = (len(values) - 1) * probability
    lower, upper = math.floor(position), math.ceil(position)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def distribution(values: Sequence[float]) -> dict[str, float | int]:
    finite = [float(value) for value in values if math.isfinite(value)]
    if not finite:
        return {key: 0 for key in (
            "min", "max", "mean", "standardDeviation", "rms", "peakToPeak",
            "median", "mad", "p05", "p25", "p75", "p95", "crestFactor",
            "zeroCrossings",
        )}
    ordered = sorted(finite)
    mean = sum(finite) / len(finite)
    rms = math.sqrt(sum(value * value for value in finite) / len(finite))
    median = _percentile(ordered, 0.5)
    deviations = sorted(abs(value - median) for value in finite)
    zero_crossings = sum(
        1 for left, right in zip(finite, finite[1:])
        if (left < 0 <= right) or (left > 0 >= right)
    )
    return {
        "min": ordered[0], "max": ordered[-1], "mean": mean,
        "standardDeviation": math.sqrt(sum((value - mean) ** 2 for value in finite) / len(finite)),
        "rms": rms, "peakToPeak": ordered[-1] - ordered[0], "median": median,
        "mad": _percentile(deviations, 0.5), "p05": _percentile(ordered, 0.05),
        "p25": _percentile(ordered, 0.25), "p75": _percentile(ordered, 0.75),
        "p95": _percentile(ordered, 0.95),
        "crestFactor": max(abs(value) for value in finite) / rms if rms > 0 else 0,
        "zeroCrossings": zero_crossings,
    }


def _resample(
    samples: Sequence[dict[str, Any]], start_ms: float, end_ms: float,
    value_fn: Callable[[dict[str, Any]], list[float]],
) -> tuple[list[list[float]], float]:
    valid = sorted(
        (sample for sample in samples if isinstance(sample.get("t"), (int, float))
         and math.isfinite(sample["t"]) and start_ms - 100 <= sample["t"] <= end_ms + 100),
        key=lambda sample: sample["t"],
    )
    step_ms = 1000 / FEATURE_SAMPLE_HZ
    expected = math.floor((end_ms - start_ms) / step_ms) + 1
    if not valid:
        return [], 1.0
    output: list[list[float]] = []
    cursor = missing = 0
    for index in range(expected):
        timestamp = start_ms + index * step_ms
        while cursor + 1 < len(valid) and valid[cursor + 1]["t"] < timestamp:
            cursor += 1
        left = valid[cursor] if cursor < len(valid) else None
        right = valid[cursor + 1] if cursor + 1 < len(valid) else None
        if (not left or not right or timestamp < left["t"] or timestamp > right["t"]
                or right["t"] - left["t"] > step_ms * 3):
            missing += 1
            continue
        left_values, right_values = value_fn(left), value_fn(right)
        fraction = 0 if right["t"] == left["t"] else (timestamp - left["t"]) / (right["t"] - left["t"])
        output.append([value + (right_values[i] - value) * fraction for i, value in enumerate(left_values)])
    return output, missing / expected if expected > 0 else 1.0


def _frequency(values: Sequence[float]) -> dict[str, float]:
    count = len(values)
    empty = {"energy2To5Hz": 0.0, "energy5To10Hz": 0.0, "energy10To20Hz": 0.0,
             "dominantFrequencyHz": 0.0, "spectralEntropy": 0.0}
    if count < 4:
        return empty
    mean = sum(values) / count
    powers: list[tuple[float, float]] = []
    for k in range(1, math.floor(count / 2) + 1):
        real = imaginary = 0.0
        for index, value in enumerate(values):
            angle = 2 * math.pi * k * index / count
            centered = value - mean
            real += centered * math.cos(angle)
            imaginary -= centered * math.sin(angle)
        powers.append((k * FEATURE_SAMPLE_HZ / count, (real * real + imaginary * imaginary) / count ** 2))
    band = lambda low, high: sum(power for frequency, power in powers if low <= frequency < high)
    total = sum(power for _, power in powers)
    entropy = (-sum((power / total) * math.log(power / total) for _, power in powers if power > 0) / math.log(len(powers))) if total > 0 and len(powers) > 1 else 0
    dominant = max(powers, key=lambda item: item[1])
    return {"energy2To5Hz": band(2, 5), "energy5To10Hz": band(5, 10),
            "energy10To20Hz": band(10, 20), "dominantFrequencyHz": dominant[0],
            "spectralEntropy": entropy if math.isfinite(entropy) else 0.0}


def extract_feature_vector_v1(
    accel_samples: Sequence[dict[str, Any]], gyro_samples: Sequence[dict[str, Any]],
    *, started_at: float, ended_at: float, speed_kmh: float | None = None,
    heading_change_deg: float | None = None,
) -> dict[str, Any]:
    if ended_at <= started_at:
        raise ValueError("feature window must have positive duration")
    accel, accel_missing = _resample(accel_samples, started_at, ended_at, lambda sample: [
        float(sample["verticalMs2"]), float(sample["horizontalMs2"]),
        float(sample["dynamicMagnitudeMs2"]), 1.0 if sample["mountStable"] else 0.0,
    ])
    gyro, gyro_missing = _resample(gyro_samples, started_at, ended_at, lambda sample: [
        float(sample["x"]), float(sample["y"]), float(sample["z"]),
    ])
    vertical = [row[0] for row in accel]
    horizontal = [row[1] for row in accel]
    dynamic = [row[2] for row in accel]
    stable = [row[3] for row in accel]
    gyro_magnitude = [math.hypot(*row) for row in gyro]
    jerk = [(right - left) * FEATURE_SAMPLE_HZ for left, right in zip(vertical, vertical[1:])]
    context: dict[str, Any] = {
        "durationMs": ended_at - started_at, "movementState": "moving",
        "mountStableRatio": sum(stable) / len(stable) if stable else 0,
        "accelerometerSampleCount": len(accel_samples), "gyroscopeSampleCount": len(gyro_samples),
        "accelerometerMissingRatio": accel_missing, "gyroscopeMissingRatio": gyro_missing,
    }
    if speed_kmh is not None and math.isfinite(speed_kmh): context["speedKmh"] = speed_kmh
    if heading_change_deg is not None and math.isfinite(heading_change_deg): context["headingChangeDeg"] = heading_change_deg
    return {"vertical": distribution(vertical), "horizontal": distribution(horizontal),
            "dynamicMagnitude": distribution(dynamic), "jerk": distribution(jerk),
            "gyroMagnitude": distribution(gyro_magnitude), "frequency": _frequency(vertical),
            "context": context}
