/**
 * RQI (Road Quality Index, 0–100) color scale.
 *
 * RQI *means* good/bad, so it wears status colors (good → warning → serious →
 * critical), matching the road-quality convention green→amber→red. All-pairs
 * CVD separation validated (worst ΔE 12.4, deutan — above the ≥12 target).
 * Two mid steps sit below 3:1 on white, so the relief rule applies: the legend
 * is labeled and every segment's numeric RQI is one tap away in its popup.
 */
export const RQI_STOPS = [
  { value: 0, color: '#d03b3b', label: 'Very poor' }, // critical
  { value: 35, color: '#ec835a', label: 'Poor' }, // serious
  { value: 65, color: '#fab219', label: 'Fair' }, // warning
  { value: 100, color: '#0ca30c', label: 'Good' }, // good
] as const;

/**
 * MapLibre `line-color` expression — linear interpolation over the stops.
 * (Cast at the call site: TS can't narrow a spread-built array to the
 * style-spec's expression tuple union.)
 */
export const rqiColorExpression = [
  'interpolate',
  ['linear'],
  ['get', 'rqi'],
  ...RQI_STOPS.flatMap((s) => [s.value, s.color]),
];

/** CSS gradient for the legend bar — left = 0 (worst), right = 100 (best). */
export const rqiGradient = `linear-gradient(to right, ${RQI_STOPS.map(
  (s) => `${s.color} ${s.value}%`,
).join(', ')})`;

/** Human label for an RQI value (popup relief channel). */
export function rqiLabel(value: number): string {
  for (let i = RQI_STOPS.length - 1; i > 0; i--) {
    if (value >= RQI_STOPS[i - 1].value + (RQI_STOPS[i].value - RQI_STOPS[i - 1].value) / 2) {
      return RQI_STOPS[i].label;
    }
  }
  return RQI_STOPS[0].label;
}

/** Sparkline / single-series magnitude color (categorical slot 1, blue). */
export const SPARKLINE_COLOR = '#2a78d6';

/** Event marker ink — neutral so it never impersonates the RQI scale. */
export const EVENT_COLOR = '#0a0a0a';

/** Friendly labels for the public event types. */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  POTHOLE: 'Pothole',
  BUMP: 'Rough patch',
  SPEED_BREAKER: 'Speed breaker',
  SWERVE: 'Swerve (obstacle avoided)',
  MANUAL_REPORT: 'Citizen report',
};
