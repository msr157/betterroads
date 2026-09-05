"""Vehicle-calibrated surface scoring, independent from impact classification."""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Sequence


@dataclass(frozen=True)
class SurfaceCalibration:
    vehicle_class: str
    version: str
    smooth_reference: float
    rough_reference: float


def surface_score(value: float, calibration: SurfaceCalibration, *, vehicle_class: str) -> float:
    if vehicle_class != calibration.vehicle_class:
        raise ValueError("surface calibration cannot cross vehicle classes")
    span = calibration.rough_reference - calibration.smooth_reference
    if span <= 0: raise ValueError("rough reference must exceed smooth reference")
    return max(0.0, min(100.0, 100 * (1 - (value - calibration.smooth_reference) / span)))


def aggregate_repeated_passes(scores: Sequence[float], *, minimum_independent_passes: int = 3) -> float | None:
    if len(scores) < minimum_independent_passes: return None
    return float(median(scores))
