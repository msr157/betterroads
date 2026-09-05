import json
import math

from betterroads_ai.features import distribution, extract_feature_vector_v1


def test_distribution_matches_typescript_golden_values():
    result = distribution([-2, -1, 0, 1, 2])
    assert result["mean"] == 0
    assert result["median"] == 0
    assert result["peakToPeak"] == 4
    assert result["zeroCrossings"] == 1
    assert abs(result["rms"] - math.sqrt(2)) < 1e-12


def test_signal_feature_parity_and_forbidden_identity_fields():
    start = 1000
    accel, gyro = [], []
    for index in range(101):
        timestamp = start + index * 20
        wave = math.sin(2 * math.pi * 5 * index / 50)
        accel.append({"t": timestamp, "verticalMs2": wave, "horizontalMs2": .2,
                      "dynamicMagnitudeMs2": abs(wave), "mountStable": True})
        gyro.append({"t": timestamp, "x": .01, "y": .02, "z": .03})
    features = extract_feature_vector_v1(accel, gyro, started_at=start, ended_at=start + 2000, speed_kmh=25)
    assert abs(features["frequency"]["dominantFrequencyHz"] - 5) < .5
    assert features["frequency"]["energy5To10Hz"] > features["frequency"]["energy10To20Hz"]
    encoded = json.dumps(features)
    assert all(name not in encoded for name in ("latitude", "longitude", "deviceUuid", "userId", "routeId", "sessionId"))


def test_long_gap_is_missing_not_interpolated():
    accel = [
        {"t": 0, "verticalMs2": 0, "horizontalMs2": 0, "dynamicMagnitudeMs2": 0, "mountStable": True},
        {"t": 20, "verticalMs2": 0, "horizontalMs2": 0, "dynamicMagnitudeMs2": 0, "mountStable": True},
        {"t": 1000, "verticalMs2": 0, "horizontalMs2": 0, "dynamicMagnitudeMs2": 0, "mountStable": True},
    ]
    features = extract_feature_vector_v1(accel, [], started_at=0, ended_at=1000)
    assert features["context"]["accelerometerMissingRatio"] > .8
    assert features["context"]["gyroscopeMissingRatio"] == 1
