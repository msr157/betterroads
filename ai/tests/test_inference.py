import pytest

from betterroads_ai.inference import predict
from betterroads_ai.registry import ModelMetadata


class FakeModel:
    classes_ = ["NORMAL", "IMPACT"]
    def predict_proba(self, rows): return [[.25, .75] for _ in rows]


def metadata(**changes):
    values = dict(model_version="car-impact-1", vehicle_class="CAR", task="IMPACT", feature_version="features-v1",
                  training_dataset_hash="a", artifact_sha256="b", stage="SHADOW", metrics={}, decision_thresholds={"IMPACT": .8, "default": .8})
    values.update(changes); return ModelMetadata(**values)


def test_preserves_uncertainty_below_threshold():
    result = predict(FakeModel(), metadata(), {"vertical": {"rms": 2}}, vehicle_class="CAR",
                     feature_version="features-v1", feature_names=["vertical.rms"])
    assert result.label == "UNCERTAIN"


@pytest.mark.parametrize("kwargs", [{"vehicle_class": "BIKE", "feature_version": "features-v1"},
                                     {"vehicle_class": "CAR", "feature_version": "features-v2"}])
def test_rejects_class_or_feature_mismatch(kwargs):
    with pytest.raises(ValueError): predict(FakeModel(), metadata(), {}, feature_names=[], **kwargs)


def test_rejects_experiment_model():
    with pytest.raises(ValueError): predict(FakeModel(), metadata(stage="EXPERIMENT"), {}, vehicle_class="CAR", feature_version="features-v1", feature_names=[])
