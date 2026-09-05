import pytest

from betterroads_ai.surface import SurfaceCalibration, aggregate_repeated_passes, surface_score


def test_vehicle_locked_score_and_repeated_pass_gate():
    calibration = SurfaceCalibration("CAR", "car-surface-v1", 1, 5)
    assert surface_score(1, calibration, vehicle_class="CAR") == 100
    assert surface_score(5, calibration, vehicle_class="CAR") == 0
    with pytest.raises(ValueError): surface_score(2, calibration, vehicle_class="BIKE")
    assert aggregate_repeated_passes([90, 70]) is None
    assert aggregate_repeated_passes([90, 70, 80]) == 80
