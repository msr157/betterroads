/**
 * BetterRoads — central content & config.
 * Edit copy here; components consume these values.
 */

// Launch: Independence Day, 15 August 2026, midnight IST (UTC+05:30).
export const LAUNCH_DATE_ISO = '2026-08-15T00:00:00+05:30';

// Teaser trailer shown by the "What is BetterRoads?" button on the hero.
// Paste a YouTube or Vimeo link here (watch URL or share URL — either works).
// Leave empty to show the "trailer dropping soon" placeholder instead.
export const VIDEO_URL = 'https://www.youtube.com/watch?v=AbhE5Wfmoes';

export const SITE = {
  name: 'BetterRoads',
  wordmark: 'betterroads',
  tagline: 'Freedom From Potholes',
  taglineHindi: 'गड्ढों से आज़ादी',
  mission:
    'BetterRoads turns the phone in your pocket into proof — and proof into pressure.',
  provocation:
    'You stopped complaining about the roads. That\'s exactly what they were counting on.',
  methodline: 'Redesigning the civic environment with tech & behavioural science.',
  url: 'https://betterroads.org',
  launchLabel: 'Launching this Independence Day',
} as const;

/**
 * Legal identity — used by the Terms of Service and Privacy Policy pages,
 * and the footer attribution line.
 */
export const LEGAL = {
  // Registered company (India)
  companyName: 'Bonbern Think Tank Studio Private Limited',
  cin: 'U74999MH2017PTC289735',
  registeredAddress:
    '1634 Trimurti Chawl, Y.C. Marg, Maharashtra Nagar, Mankhurd East, Mumbai, Maharashtra 400088, India',

  // Contact & grievance (DPDP Act 2023 requires a reachable grievance channel)
  contactEmail: 'privacy@betterroads.org',
  privacyEmail: 'privacy@betterroads.org',
  grievanceOfficer: 'Grievance Officer, Better Roads',
  grievanceEmail: 'grievance@betterroads.org',

  // Jurisdiction
  governingLawCity: 'Mumbai',
  governingLawState: 'Maharashtra',

  // Keep in sync when the documents are materially updated.
  effectiveDate: '14 July 2026',
} as const;

// How BetterRoads works — visualised along the road.
export const STEPS = [
  {
    id: 'sense',
    index: '01',
    title: 'Sense',
    kicker: 'Your phone',
    body: 'Install the app and your phone becomes a road sensor. It reads every bump and GPS point in the background as you drive — zero effort, zero detours.',
  },
  {
    id: 'detect',
    index: '02',
    title: 'Detect',
    kicker: 'Our models',
    body: 'Trained models turn millions of those signals into verified pothole locations — a living map of the truth, built by everyone at once.',
  },
  {
    id: 'report',
    index: '03',
    title: 'Report',
    kicker: 'The record',
    body: 'Every pothole becomes a public record, tied to the ward and the people responsible. Undeniable. On the record. Proof becomes pressure.',
  },
] as const;

/** Problem stats — verify figures before launch. */
export const STATS = [
  { value: 2000, prefix: '', suffix: '+',  label: 'lives lost to potholes every year in India',     source: 'PLACEHOLDER — verify against MoRTH data' },
  { value: 5,    prefix: '', suffix: 'L+', label: 'potholes reported across Indian cities annually', source: 'PLACEHOLDER — verify' },
  { value: 63,   prefix: '', suffix: '%',  label: 'of monsoon road complaints go unresolved',        source: 'PLACEHOLDER — verify' },
] as const;

/**
 * Android app distribution. The APK is served from this site (early access /
 * sideload) while the Play Store listing clears review — keep both in sync
 * with mobile/app/app.json on every release.
 */
export const APP_DOWNLOAD = {
  version: '1.0.0',
  apkUrl: '/downloads/BetterRoads.apk',
  apkName: 'BetterRoads.apk',
  requirement: 'Android 10 or newer',
  packageId: 'org.betterroads.app',
  playStoreUrl: '', // filled when the Play listing goes live
} as const;

export const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/betterroads_org/' },
  { label: 'X / Twitter', href: 'https://x.com/BetterRoadz' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/betterroads' },
  { label: 'GitHub', href: 'https://github.com/msr157/betterroads' },
] as const;

export const NAV_LINKS = [
  { label: 'The Problem', href: '#problem' },
  { label: 'How It Works', href: '#journey' },
  { label: 'The Movement', href: '#movement' },
] as const;

/** Backend API base URL — set VITE_API_URL in .env (no trailing slash). */
// In production, we use relative paths because Nginx/Traefik will route /api to the backend.
// In local dev, we can set VITE_API_URL=http://localhost:3000
export const API_URL = import.meta.env.VITE_API_URL ?? '';
