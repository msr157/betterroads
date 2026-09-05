"""Leakage-resistant grouped and temporal dataset partitions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence

PROTECTED_GROUPS = ("encounterId", "sessionId", "routeId", "siteId", "devicePseudonym", "vehicleId")


def grouped_partition(rows: Sequence[dict[str, Any]], *, validation_fraction: float = .2, test_fraction: float = .2) -> dict[str, list[int]]:
    if not 0 < validation_fraction < 1 or not 0 < test_fraction < 1 or validation_fraction + test_fraction >= 1:
        raise ValueError("invalid partition fractions")
    parent = list(range(len(rows)))
    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index
    def union(left: int, right: int) -> None:
        a, b = find(left), find(right)
        if a != b: parent[b] = a
    seen: dict[tuple[str, str], int] = {}
    for index, row in enumerate(rows):
        if not row.get("encounterId") or not row.get("sessionId") or not row.get("devicePseudonym"):
            raise ValueError("protected grouping identifiers are required")
        for key in PROTECTED_GROUPS:
            value = row.get(key)
            if value in (None, ""): continue
            identity = (key, str(value))
            if identity in seen: union(index, seen[identity])
            else: seen[identity] = index
    ordered_groups: dict[int, list[int]] = {}
    for index in range(len(rows)): ordered_groups.setdefault(find(index), []).append(index)
    groups = sorted(ordered_groups, key=lambda key: (min(str(rows[i].get("startedAt", "")) for i in ordered_groups[key]), key))
    count = len(groups)
    test_start = max(1, int(count * (1 - test_fraction))) if count else 0
    validation_start = max(1, int(count * (1 - test_fraction - validation_fraction))) if count else 0
    partitions = {"train": [], "validation": [], "test": []}
    for position, group in enumerate(groups):
        target = "test" if position >= test_start else "validation" if position >= validation_start else "train"
        partitions[target].extend(ordered_groups[group])
    assert_no_group_leakage(rows, partitions)
    return partitions


def assert_no_group_leakage(rows: Sequence[dict[str, Any]], partitions: dict[str, Sequence[int]]) -> None:
    for field in PROTECTED_GROUPS:
        owner: dict[str, str] = {}
        for partition, indices in partitions.items():
            for index in indices:
                value = rows[index].get(field)
                if value in (None, ""): continue
                text = str(value)
                if text in owner and owner[text] != partition:
                    raise ValueError(f"{field} leaks between {owner[text]} and {partition}")
                owner[text] = partition


def enforce_temporal_holdout(rows: Sequence[dict[str, Any]], indices: Sequence[int], cutoff: datetime) -> None:
    for index in indices:
        timestamp = datetime.fromisoformat(str(rows[index]["startedAt"]).replace("Z", "+00:00"))
        if timestamp < cutoff:
            raise ValueError("temporal holdout contains pre-cutoff data")
