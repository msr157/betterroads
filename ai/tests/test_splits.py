import pytest

from betterroads_ai.splits import assert_no_group_leakage, grouped_partition


def make(index, **changes):
    row = {"encounterId": f"e{index}", "sessionId": f"s{index}", "devicePseudonym": f"d{index}",
           "routeId": f"r{index}", "siteId": f"p{index}", "vehicleId": f"v{index}",
           "startedAt": f"2026-08-{index + 1:02d}T00:00:00Z"}
    row.update(changes); return row


def test_partition_keeps_every_protected_group_together():
    rows = [make(i) for i in range(8)] + [make(8, routeId="r0")]
    partitions = grouped_partition(rows)
    assert_no_group_leakage(rows, partitions)
    owner = next(name for name, indices in partitions.items() if 0 in indices)
    assert 8 in partitions[owner]


def test_explicit_leakage_is_rejected():
    rows = [make(0), make(1, devicePseudonym="d0")]
    with pytest.raises(ValueError): assert_no_group_leakage(rows, {"train": [0], "test": [1]})
