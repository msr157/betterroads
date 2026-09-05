"""Vehicle/version locked server inference with an explicit uncertainty outcome."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, Sequence

from .dataset import flatten_numeric_features
from .registry import ModelMetadata


class ProbabilisticModel(Protocol):
    classes_: Sequence[str]
    def predict_proba(self, rows: Sequence[Sequence[float]]) -> Sequence[Sequence[float]]: ...


@dataclass(frozen=True)
class Prediction:
    label: str
    confidence: float
    probabilities: dict[str, float]
    model_version: str


def predict(
    model: ProbabilisticModel, metadata: ModelMetadata, features: dict[str, Any], *,
    vehicle_class: str, feature_version: str, feature_names: Sequence[str],
) -> Prediction:
    metadata.require_compatible(vehicle_class=vehicle_class, feature_version=feature_version)
    flattened = flatten_numeric_features(features)
    vector = [flattened.get(name, 0.0) for name in feature_names]
    values = list(model.predict_proba([vector])[0])
    probabilities = {str(label): float(probability) for label, probability in zip(model.classes_, values)}
    best_label, confidence = max(probabilities.items(), key=lambda item: item[1])
    threshold = metadata.decision_thresholds.get(best_label, metadata.decision_thresholds.get("default", 1.0))
    label = best_label if confidence >= threshold else "UNCERTAIN"
    return Prediction(label, confidence, probabilities, metadata.model_version)
