/**
 * BetterRoads design tokens — the dark inversion of the website system
 * (website/src/index.css), kept in lockstep with dashboard/src/index.css:
 * near-black canvas, warm off-white ink, ONE saffron accent. The bright
 * flag-saffron (#ff9933) is reserved for the wordmark dot / tricolor
 * moments; interactive elements use the deep saffron.
 */
export const theme = {
  // Canvas
  bg: '#0a0a0a',
  bg2: '#121211',
  bg3: '#1b1b1a',
  // Ink
  ink: '#f5f5f4',
  ink2: '#a8a5a0',
  ink3: '#716e69',
  // Hairlines
  line: '#242422',
  lineStrong: '#3a3936',
  // Accent
  saffron: '#ff9933', // brand dot / tricolor moments only
  saffronDeep: '#e0611c', // interactive accent
  saffronLift: '#f07f33', // hover/active lift
  saffronTint: '#2a1d0e', // active-chip fill on dark
  // Semantic (shared with the map's RQI scale)
  warn: '#fab219',
  danger: '#d03b3b',
  onAccent: '#0a0a0a',
} as const;
