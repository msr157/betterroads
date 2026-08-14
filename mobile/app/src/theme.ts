/**
 * BetterRoads design tokens — unified with the website design system
 * (website/src/index.css) and mobile dark canvas:
 * pure dark obsidian canvas, warm off-white ink, ONE deep saffron accent (#e0611c),
 * and tricolor moments (#ff9933, #ffffff, #138808).
 */

export const theme = {
  // Canvas
  bg: '#0a0a0a',
  bg2: '#121211',
  bg3: '#1a1a19',
  bgCard: '#141413',

  // Ink
  ink: '#f5f5f4',
  ink2: '#a8a5a0',
  ink3: '#716e69',

  // Hairlines & Borders
  line: '#242422',
  lineStrong: '#3a3936',

  // The Saffron Accent
  saffron: '#ff9933', // brand dot / tricolor saffron
  saffronDeep: '#e0611c', // primary interactive CTA accent (website --color-saffron)
  saffronLift: '#f07f33', // hover / active lift
  saffronTint: '#2a1d0e', // active-chip / card tint on dark
  saffronGlow: 'rgba(224, 97, 28, 0.35)', // soft button shadow glow

  // Tricolor Indian flag moments (reserved for signature accents)
  flagSaffron: '#ff9933',
  flagWhite: '#ffffff',
  flagGreen: '#138808',
  green: '#1b7a43', // repaired / good road / success

  // Semantic
  warn: '#fab219',
  danger: '#d03b3b',
  onAccent: '#ffffff',
} as const;

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.ink2,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.8,
    color: theme.ink,
  },
  h1: {
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: -1,
    color: theme.ink,
    lineHeight: 38,
  },
  h2: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: theme.ink,
  },
  h3: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: theme.ink,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: theme.ink2,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: theme.ink3,
    lineHeight: 17,
  },
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
