# BetterRoads server intelligence

This repository does **not** currently contain a trained pothole model. It
contains two intentionally separate systems:

1. `classify.py` and `rebuild.py` are the frozen legacy v1/v2 batch path. The
   classifier is a mathematical location/variance heuristic, not machine
   learning. It only reads accepted legacy journeys and must never read v3
   collection sessions.
2. The collection-v3 modules are the foundation for future, independently
   trained CAR, BIKE, and AUTO_RICKSHAW models. They audit frozen datasets,
   prevent grouped-data leakage, train baselines, evaluate release gates,
   enforce artifact compatibility, and preserve uncertainty. No model may
   fall back to another vehicle class.

Collection-v3 candidate windows are neutral sensor anomalies. They are not
pothole declarations and do not update the public map.

## Commands

Legacy aggregate jobs require PostgreSQL:

```sh
cd ai
python3 -m pip install -e '.[test]'
export DATABASE_URL=postgresql://user:pass@host:5432/betterroads
python3 -m betterroads_ai classify --dry-run
python3 -m betterroads_ai rebuild --dry-run
python3 -m betterroads_ai run-all
```

Model research additionally requires the training extra:

```sh
python3 -m pip install -e '.[test,train]'
python3 -m pytest
```

There is deliberately no one-command “production train” shortcut yet. A
deployable model requires a frozen, single-vehicle export that has passed the
field-data gates, grouped/temporal evaluation, a model card, and an approved
registry stage. Until then, artifacts remain `EXPERIMENT` only.

## V3 modules

- `features.py`: exact Python port of the mobile `features-v1` formulas.
- `dataset.py`: single-vehicle export audit and canonical manifest hash.
- `splits.py`: connected grouped partitions across encounters, sessions,
  routes/sites, pseudonymous devices, and vehicles.
- `train.py`: fold-contained logistic regression, Random Forest, and optional
  LightGBM candidates.
- `evaluate.py`: precision/recall, subgroup and false-positive-per-distance
  release reports.
- `registry.py` / `inference.py`: immutable hashes, exact class/version/stage
  compatibility, and an explicit `UNCERTAIN` result.
- `surface.py`: independent vehicle-calibrated surface-score primitives; this
  is not formal IRI and is not the pothole classifier.

The first eligible artifact should be a car model. Bike and auto models train
only after their own datasets independently meet the same gates.
