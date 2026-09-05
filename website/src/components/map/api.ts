import { API_URL } from '@/lib/constants';

/**
 * Public map API — thin typed wrappers over /api/public/*.
 * All endpoints are unauthenticated and may legitimately return empty data
 * before launch; callers treat "no rows" as a normal state, not an error.
 */

export type TimelineDay = {
  day: string; // YYYY-MM-DD
  segmentsUpdated: number;
  avgRqi: number | null;
  eventCount: number;
  sectionsNew: number;
  conditionChanges: number;
  potholeSignals: number;
};

export type TimelineData = {
  ok: boolean;
  earliest: string | null;
  latest: string | null;
  days: TimelineDay[];
};

export type RoadSegment = {
  segmentKey: string;
  centerLat: number;
  centerLon: number;
  geometry: [number, number][]; // [lat, lon] pairs
  rqi: number; // 0–100
  sampleCount: number;
  eventCount: number;
  lastEvidenceAt: string | null;
};

export type RoadEvent = {
  id: string;
  type: 'POTHOLE' | 'BUMP' | 'SPEED_BREAKER' | 'SWERVE' | 'MANUAL_REPORT';
  severity: number; // 0–1
  occurredAt: string;
  lat: number;
  lon: number;
  speedKmh: number | null;
  segmentKey: string | null;
  accuracyM: number | null;
  locationQuality: string | null;
  potholeHotspotId: string | null;
};

export type PotholeHotspot = {
  id: string;
  lat: number;
  lon: number;
  accuracyM: number | null;
  detectionCount: number;
  distinctJourneyCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  averageSeverity: number;
  maximumSeverity: number;
  confidence: 'possible' | 'repeated' | 'regional';
  aggregateCount?: number;
};

export type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function bboxParams(bbox: Bbox): URLSearchParams {
  return new URLSearchParams({
    minLat: String(bbox.minLat),
    maxLat: String(bbox.maxLat),
    minLon: String(bbox.minLon),
    maxLon: String(bbox.maxLon),
  });
}

export async function fetchTimeline(): Promise<TimelineData> {
  const res = await fetch(`${API_URL}/api/public/timeline`);
  if (!res.ok) throw new Error(`timeline request failed (${res.status})`);
  return res.json();
}

export type PublicStats = {
  segments: number;
  events: number;
  journeys: number;
  daysOfData: number;
  avgRqi: number | null;
  kmRidden: number;
  lastUpdatedAt: string | null;
};

/** Headline aggregates for the public panel; null when the API has none yet. */
export async function fetchStats(): Promise<PublicStats | null> {
  const res = await fetch(`${API_URL}/api/public/stats`);
  if (!res.ok) throw new Error(`stats request failed (${res.status})`);
  const data = await res.json();
  return data.stats ?? null;
}

/** Road segments in the bbox; omit `at` for the current state. */
export async function fetchRoads(
  bbox: Bbox,
  at: string | undefined,
  signal: AbortSignal,
): Promise<RoadSegment[]> {
  const params = bboxParams(bbox);
  if (at) params.set('at', at);
  const res = await fetch(`${API_URL}/api/public/roads?${params}`, { signal });
  if (!res.ok) throw new Error(`roads request failed (${res.status})`);
  const data = await res.json();
  return data.segments ?? [];
}

/** Events in the bbox between `from` and `to` (inclusive days). */
export async function fetchEvents(
  bbox: Bbox,
  from: string | undefined,
  to: string | undefined,
  signal: AbortSignal,
): Promise<RoadEvent[]> {
  const params = bboxParams(bbox);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await fetch(`${API_URL}/api/public/events?${params}`, { signal });
  if (!res.ok) throw new Error(`events request failed (${res.status})`);
  const data = await res.json();
  return data.events ?? [];
}

export async function fetchHotspots(
  bbox: Bbox,
  at: string | undefined,
  zoom: number,
  signal: AbortSignal,
): Promise<{ hotspots: PotholeHotspot[]; aggregate: boolean; truncated: boolean }> {
  const params = bboxParams(bbox);
  if (at) params.set('at', at);
  params.set('zoom', String(zoom));
  const res = await fetch(`${API_URL}/api/public/hotspots?${params}`, { signal });
  if (!res.ok) throw new Error(`hotspots request failed (${res.status})`);
  const data = await res.json();
  return { hotspots: data.hotspots ?? [], aggregate: !!data.aggregate, truncated: !!data.truncated };
}

/* ── Day arithmetic (UTC, so no DST/timezone drift in the day list) ───── */

const DAY_MS = 86_400_000;

/** Every calendar day from `earliest` to `latest`, inclusive. */
export function dayRange(earliest: string, latest: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${latest}T00:00:00Z`);
  for (let t = Date.parse(`${earliest}T00:00:00Z`); t <= end; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** "1 Aug 2026" — matches the site's Indian date style. */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export type Contributor = { id: number; name: string; mappedKm: number; journeyCount: number; contributingSince: string; lastContributionAt: string };
export type PublicContract = { id: number; roadName: string; city: string; ward: string | null; contractorName: string; tenderReference: string | null; startDate: string | null; endDate: string | null; budget: number | null; status: string; guaranteeUntil: string | null; publishedAt: string | null; geometry: GeoJSON.Geometry | null };

export async function fetchLeaderboard(period: 'monthly' | 'lifetime'): Promise<Contributor[]> {
  const res = await fetch(`${API_URL}/api/public/leaderboard?period=${period}`);
  if (!res.ok) throw new Error('leaderboard request failed');
  return (await res.json()).contributors ?? [];
}

export async function fetchContracts(): Promise<PublicContract[]> {
  const res = await fetch(`${API_URL}/api/public/contracts`);
  if (!res.ok) throw new Error('contracts request failed');
  return (await res.json()).contracts ?? [];
}

/** A place returned by OpenStreetMap's Nominatim search service. */
export type IndiaPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // south, north, west, east
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state_district?: string;
    state?: string;
  };
};

/**
 * Explicit-submit place search. This is intentionally not autocomplete:
 * the public Nominatim service permits occasional user-triggered searches,
 * but not client-side search-as-you-type.
 */
export async function searchIndiaPlaces(query: string, signal: AbortSignal): Promise<IndiaPlace[]> {
  const params = new URLSearchParams({
    q: query,
    countrycodes: 'in',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`place search failed (${res.status})`);
  return res.json();
}
