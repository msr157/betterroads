"""Load and audit frozen, single-vehicle collection exports."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SUPPORTED_VEHICLES = frozenset({"CAR", "BIKE", "AUTO_RICKSHAW"})


@dataclass(frozen=True)
class FrozenDataset:
    vehicle_class: str
    feature_version: str
    rows: tuple[dict[str, Any], ...]
    manifest_hash: str


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def load_export(path: str | Path, *, expected_vehicle: str | None = None) -> FrozenDataset:
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    vehicle = document.get("vehicleClass")
    if vehicle not in SUPPORTED_VEHICLES:
        raise ValueError(f"unsupported training vehicle class: {vehicle!r}")
    if expected_vehicle and vehicle != expected_vehicle:
        raise ValueError("dataset vehicle class does not match requested model")
    rows = document.get("windows")
    if not isinstance(rows, list):
        raise ValueError("dataset windows must be an array")
    encounters: set[str] = set()
    feature_versions: set[str] = set()
    for row in rows:
        if row.get("vehicleClass") != vehicle:
            raise ValueError("mixed vehicle classes are forbidden")
        if not row.get("label") or not row.get("devicePseudonym"):
            raise ValueError("export row lacks an agreed label or device pseudonym")
        if "deviceUuid" in row:
            raise ValueError("raw device UUID must not appear in a training export")
        encounter = row.get("encounterId")
        if not isinstance(encounter, str) or encounter in encounters:
            raise ValueError("encounter IDs must be present and unique")
        encounters.add(encounter)
        feature_versions.add(row.get("featureVersion"))
    if feature_versions != {"features-v1"}:
        raise ValueError("exactly the supported features-v1 version is required")
    body = {"schemaVersion": document.get("schemaVersion"), "vehicleClass": vehicle, "windows": rows}
    return FrozenDataset(vehicle, next(iter(feature_versions)), tuple(rows), canonical_hash(body))


def flatten_numeric_features(features: dict[str, Any], prefix: str = "") -> dict[str, float]:
    output: dict[str, float] = {}
    for key in sorted(features):
        value = features[key]
        name = f"{prefix}.{key}" if prefix else key
        if isinstance(value, bool): output[name] = float(value)
        elif isinstance(value, (int, float)): output[name] = float(value)
        elif isinstance(value, dict): output.update(flatten_numeric_features(value, name))
    return output
