# BetterRoads model card template

- Model ID/version:
- Registry stage: `EXPERIMENT` / `SHADOW` / `POSSIBLE_ONLY` /
  `CONFIRMED_ELIGIBLE` / `RETIRED`
- Vehicle class (exactly one):
- Task and label taxonomy:
- Feature/profile versions:
- Training dataset and query hashes:
- Artifact SHA-256:
- Training date/code commit:
- Supported phone models, mounts, subtypes, speed bands, cities, and routes:
- Explicitly unsupported conditions:
- Grouped split definition and untouched temporal holdout:
- Heuristic, logistic regression, Random Forest, and LightGBM comparison:
- Overall precision, recall, F1, calibration, and false positives per 100 km:
- Per-phone/mount/subtype/speed/route/city sample counts and metrics:
- Confidence intervals and known failure modes:
- Selected thresholds and `UNCERTAIN` behavior:
- Release-gate result and approvers:
- Shadow monitoring and rollback/kill switch:

No card may claim pothole detection accuracy without an immutable artifact and
evaluation report on unseen BetterRoads field data. No artifact may be used
for a different vehicle class or feature version.
