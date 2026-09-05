# Controlled collection protocol — no video

This protocol deliberately uses no camera or video recording. Labels come
from pre-surveyed sites, passenger/research-operator markers, repeat passes,
and independent post-drive review.

## Before a drive

1. Pre-survey the route while safely stopped. Create stable sites in the
   admin research route: road damage, speed breaker, joint/drain, rail
   crossing, known-normal section, other, or uncertain.
2. Record site direction and concise notes. Do not force an ambiguous feature
   into a class.
3. Authorize the app installation UUID for exactly one or more intended
   vehicle datasets. Authorization is revocable and may expire.
4. Select the exact vehicle class/subtype and a supported rigid mount. Cars,
   bikes, and auto-rickshaws require separate sessions and exports.
5. Confirm the phone clock, battery, foreground location permission, mount
   stability, and approximately 50 Hz sensor cadence.

## During a drive

- The driver must not touch the phone. A passenger or research operator may
  press “mark road feature” at a surveyed encounter.
- Keep the screen on and the app foregrounded; background recording is out of
  scope.
- Drive naturally and legally. Repeat passes in both relevant directions and
  include known-normal road, braking, turning, handling, and stop artifacts.
- A marker is evidence for later alignment, never an automatic pothole label.
- If the mount moves, stop safely and restart a new session after securing it.

## After a drive

1. Confirm the session is `RECEIVED`; investigate quarantined cadence, GPS,
   movement, or mount diagnostics instead of overriding them.
2. Align markers to surveyed sites using timestamp, direction, accepted path,
   GPS accuracy, and repeat-pass consistency. Leave ambiguous matches
   unresolved.
3. Two administrators review windows independently. Agreement makes a window
   export-eligible; disagreement remains `DISPUTED`.
4. Export only one vehicle class and one feature version. Store its manifest
   hash with the experiment and model card.
5. Never count overlapping windows from one encounter as independent events.

## Minimum model-development gate per vehicle

Do not approve a deployable artifact until that vehicle class independently
has at least five phone models, five vehicles, ten routes across two cities,
multiple supported mounts, roughly 500 independent encounters per important
positive class, several thousand normal/artifact windows, and a later
untouched temporal holdout.
