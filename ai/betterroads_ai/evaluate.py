"""Release-oriented metrics; accuracy alone is intentionally insufficient."""

from __future__ import annotations

from collections import defaultdict
from typing import Hashable, Sequence


def binary_metrics(truth: Sequence[bool], predicted: Sequence[bool], *, distance_km: float | None = None) -> dict[str, float]:
    if len(truth) != len(predicted): raise ValueError("truth/prediction length mismatch")
    tp = sum(t and p for t, p in zip(truth, predicted)); fp = sum(not t and p for t, p in zip(truth, predicted))
    fn = sum(t and not p for t, p in zip(truth, predicted)); tn = len(truth) - tp - fp - fn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    report = {"precision": precision, "recall": recall,
              "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
              "truePositives": float(tp), "falsePositives": float(fp), "falseNegatives": float(fn), "trueNegatives": float(tn)}
    if distance_km is not None:
        report["falsePositivesPer100Km"] = fp * 100 / distance_km if distance_km > 0 else float("inf")
    return report


def subgroup_metrics(truth: Sequence[bool], predicted: Sequence[bool], groups: Sequence[Hashable]) -> dict[str, dict[str, float]]:
    if len(groups) != len(truth): raise ValueError("group length mismatch")
    buckets: dict[str, list[int]] = defaultdict(list)
    for index, group in enumerate(groups): buckets[str(group)].append(index)
    return {group: {**binary_metrics([truth[i] for i in indices], [predicted[i] for i in indices]), "sampleCount": float(len(indices))} for group, indices in buckets.items()}


def possible_impact_gate(metrics: dict[str, float], subgroup_reports: Sequence[dict[str, float]]) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if metrics.get("recall", 0) < .90: failures.append("overall recall below 0.90")
    if metrics.get("precision", 0) < .70: failures.append("overall precision below 0.70")
    if metrics.get("falsePositivesPer100Km", float("inf")) >= 5: failures.append("false positives per 100 km is not below 5")
    if any(report.get("recall", 0) < .80 for report in subgroup_reports): failures.append("a required subgroup has recall below 0.80")
    return not failures, failures
