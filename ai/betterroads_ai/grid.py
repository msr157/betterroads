"""Exact Python port of backend/src/lib/roadSegments.ts.

A "segment" is a quantized geographic cell, not an OSM way: the coordinate is
floored onto a 0.001-degree grid (~111 m of latitude) and rendered with three
decimals as ``"lat:lon"``.

PARITY IS LOAD-BEARING. The backend ingests journeys with the TypeScript
implementation; this engine rebuilds the same tables offline. If the two ever
quantize a coordinate into different cells, rebuilds would silently re-key
history. The port therefore mirrors the JS operations bit-for-bit:

- ``Math.floor(x / 0.001) * 0.001`` is done in IEEE-754 double math, exactly
  as in JS (Python ``math.floor`` returns an int, but its conversion back to
  float in the multiply is exact for any lat/lon magnitude). This preserves
  the JS floating-point artifacts, e.g. ``12.9716 -> "12.971"`` because
  ``12.9716 / 0.001`` is ``12971.599999...`` in binary.
- ``Number.prototype.toFixed(3)`` and Python ``format(x, '.3f')`` both round
  the binary double to the nearest 3-decimal string. They differ only on
  exact decimal ties, which cannot occur here: the quantized value is always
  within ~1e-12 of an exact multiple of 0.001, never halfway between two
  3-decimal values. Verified against Node-generated vectors in
  tests/test_grid.py.
"""

from __future__ import annotations

import math

# ─── Constants (must match backend/src/lib/roadSegments.ts) ──────────────────

#: Grid resolution in decimal degrees. 0.001° ≈ 111 m latitude.
CELL_SIZE_DEG = 0.001

DECIMALS = 3

#: Minimum weight a new observation carries in the running average. Without
#: this floor the average becomes cumulative-all-time, and a repaired road
#: would stay "red" for months of history it can never outweigh. With 0.15,
#: ~15 fresh journeys move a segment most of the way to its new reality.
RECENCY_ALPHA_FLOOR = 0.15


def _quantize(coord: float) -> str:
    q = math.floor(coord / CELL_SIZE_DEG) * CELL_SIZE_DEG
    return f"{q:.{DECIMALS}f}"


def segment_key_for(lat: float, lon: float) -> str:
    """Quantize a coordinate pair to its cell key, e.g. ``"19.055:72.840"``."""
    return f"{_quantize(lat)}:{_quantize(lon)}"


def cell_center(key: str) -> tuple[float, float]:
    """Cell center ``(lat, lon)`` for a key (for drawing / bbox queries)."""
    lat_str, lon_str = key.split(":")
    return (float(lat_str) + CELL_SIZE_DEG / 2, float(lon_str) + CELL_SIZE_DEG / 2)


def clamp_rqi(v: float) -> float:
    """Clamp an RQI value into [0, 100]."""
    return min(100.0, max(0.0, v))


def merge_rqi(prev_rqi: float, prev_count: int, new_rqi: float) -> float:
    """Merge a new observation into a recency-weighted running average.

    For the first few samples this behaves like a plain mean (alpha = 1/n);
    once enough samples accumulate it becomes an EMA with alpha floored at
    :data:`RECENCY_ALPHA_FLOOR` so recent journeys always register.

    The arithmetic expression order matches the TS original exactly so the
    result is the identical IEEE-754 double.
    """
    if prev_count <= 0:
        return clamp_rqi(new_rqi)
    alpha = max(1 / (prev_count + 1), RECENCY_ALPHA_FLOOR)
    return clamp_rqi(prev_rqi * (1 - alpha) + new_rqi * alpha)
