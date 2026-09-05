import json

import pytest

from betterroads_ai.dataset import load_export


def row(**changes):
    value = {"windowId": "w1", "encounterId": "e1", "sessionId": "s1", "vehicleClass": "CAR",
             "featureVersion": "features-v1", "devicePseudonym": "abc", "label": "USABLE_NORMAL", "features": {"x": 1}}
    value.update(changes)
    return value


def write(tmp_path, rows, vehicle="CAR"):
    path = tmp_path / "export.json"
    path.write_text(json.dumps({"schemaVersion": 1, "vehicleClass": vehicle, "windows": rows}))
    return path


def test_loads_one_vehicle_and_produces_stable_manifest(tmp_path):
    first = load_export(write(tmp_path, [row()]), expected_vehicle="CAR")
    second = load_export(write(tmp_path, [row()]), expected_vehicle="CAR")
    assert first.manifest_hash == second.manifest_hash


@pytest.mark.parametrize("rows", [[row(vehicleClass="BIKE")], [row(), row(windowId="w2")], [row(deviceUuid="private")], [row(featureVersion="features-v2")]])
def test_rejects_mixed_duplicate_private_or_unsupported_exports(tmp_path, rows):
    with pytest.raises(ValueError): load_export(write(tmp_path, rows))
