# Impact taxonomy v1

Label hierarchically and preserve uncertainty.

1. Sensor usability: `USABLE_NORMAL`, `UNUSABLE_SENSOR_DATA`, or `UNCERTAIN`.
2. Response: `GENUINE_ROAD_IMPACT`, `HANDLING_OR_MANEUVER_ARTIFACT`, normal,
   or uncertain.
3. Genuine-impact type: `POTHOLE_OR_DAMAGE`, `SPEED_BREAKER`,
   `JOINT_OR_DRAIN`, `RAIL_CROSSING`, `OTHER_IMPACT`, or uncertain.

A candidate threshold is not a label. A timestamp marker is not a label.
Planned infrastructure must remain distinct from damage. Reviewers use
surveyed-site evidence and repeat passes, work independently, record
confidence/evidence source/notes, and leave disagreements `DISPUTED`.

Surface condition (`SMOOTH`, `ORDINARY`, `ROUGH`, `VERY_ROUGH`, `UNRATED`) is
an independent target. It is not formal IRI and must not be inferred from the
impact label.
