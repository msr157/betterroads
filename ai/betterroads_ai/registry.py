"""Immutable model metadata and compatibility checks."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

APPROVED_INFERENCE_STAGES = frozenset({"SHADOW", "POSSIBLE_ONLY", "CONFIRMED_ELIGIBLE"})


@dataclass(frozen=True)
class ModelMetadata:
    model_version: str
    vehicle_class: str
    task: str
    feature_version: str
    training_dataset_hash: str
    artifact_sha256: str
    stage: str
    metrics: dict[str, Any]
    decision_thresholds: dict[str, float]

    def require_compatible(self, *, vehicle_class: str, feature_version: str, allow_stages: frozenset[str] = APPROVED_INFERENCE_STAGES) -> None:
        if self.vehicle_class != vehicle_class:
            raise ValueError("model vehicle class mismatch; cross-vehicle fallback is forbidden")
        if self.feature_version != feature_version:
            raise ValueError("model feature version mismatch")
        if self.stage not in allow_stages:
            raise ValueError(f"model stage {self.stage!r} is not inference-approved")


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_metadata(path: str | Path, metadata: ModelMetadata) -> None:
    Path(path).write_text(json.dumps(asdict(metadata), sort_keys=True, indent=2), encoding="utf-8")


def read_metadata(path: str | Path) -> ModelMetadata:
    return ModelMetadata(**json.loads(Path(path).read_text(encoding="utf-8")))
