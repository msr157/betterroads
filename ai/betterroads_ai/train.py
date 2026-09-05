"""Reproducible per-vehicle model experiments.

Training dependencies are optional at runtime. Every transform is inside a
scikit-learn pipeline and rows must already have leakage-safe partitions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class TrainingResult:
    name: str
    model: Any
    feature_names: tuple[str, ...]


def build_candidates(*, random_state: int = 157) -> dict[str, Any]:
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.impute import SimpleImputer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
    except ImportError as exc:
        raise RuntimeError("install betterroads-ai[train] to train models") from exc
    candidates = {
        "logistic-regression": Pipeline([("impute", SimpleImputer()), ("scale", StandardScaler()),
                                           ("model", LogisticRegression(class_weight="balanced", max_iter=2000, random_state=random_state))]),
        "random-forest": Pipeline([("impute", SimpleImputer()),
                                    ("model", RandomForestClassifier(n_estimators=500, class_weight="balanced_subsample", min_samples_leaf=3, random_state=random_state, n_jobs=-1))]),
    }
    try:
        from lightgbm import LGBMClassifier
        candidates["lightgbm"] = Pipeline([("impute", SimpleImputer()),
                                            ("model", LGBMClassifier(class_weight="balanced", random_state=random_state, n_estimators=500))])
    except ImportError:
        pass
    return candidates


def fit_candidates(x: Sequence[Sequence[float]], y: Sequence[str], feature_names: Sequence[str]) -> list[TrainingResult]:
    if len(x) != len(y) or not x: raise ValueError("non-empty aligned training rows are required")
    output = []
    for name, candidate in build_candidates().items():
        output.append(TrainingResult(name, candidate.fit(x, y), tuple(feature_names)))
    return output
