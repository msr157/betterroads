/** Backend API base URL — set VITE_API_URL in .env (no trailing slash). */
// In production it defaults to '' (same-origin) — Traefik/Cloudflare route
// /api on the dashboard host to the backend. In local dev set
// VITE_API_URL=http://localhost:3000.
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

/** localStorage key holding the admin bearer token. */
export const TOKEN_STORAGE_KEY = 'br_admin_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Invalid or expired session.';
  if (status === 429) return 'Too many attempts. Please wait a minute.';
  return `Request failed (${status}).`;
}

/** POST a JSON body without auth (login). */
export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network error — is the API reachable?');
  }

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = await res.json();
  } catch {
    // Non-JSON body (proxy error page etc.) — fall through to status message.
  }

  if (!res.ok || parsed?.ok === false) {
    throw new ApiError(res.status, parsed?.error ?? defaultMessage(res.status));
  }

  return parsed as T;
}

export async function apiRequest<T>(path: string, token: string, method: string, body?: unknown, contentType = 'application/json'): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : String(body) });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok || parsed.ok === false) throw new ApiError(res.status, parsed.error ?? defaultMessage(res.status));
  return parsed as T;
}

/** GET a JSON endpoint with the admin bearer token attached. */
export async function apiGet<T>(path: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, 'Network error — is the API reachable?');
  }

  let body: { ok?: boolean; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (proxy error page etc.) — fall through to status message.
  }

  if (!res.ok || body?.ok === false) {
    throw new ApiError(res.status, body?.error ?? defaultMessage(res.status));
  }

  return body as T;
}

// ─── Response shapes (mirror backend/src/routes/admin.ts) ────────────────────

export interface OverviewCounts {
  signups: number;
  devices: number;
  journeys: number;
  events: number;
  segments: number;
}

export interface DailyPoint {
  /** YYYY-MM-DD */
  day: string;
  journeys: number;
  events: number;
}

export interface OverviewResponse {
  ok: true;
  counts: OverviewCounts;
  daily: DailyPoint[];
}

export interface JourneyRow {
  id: string;
  startedAt: string;
  endedAt: string;
  receivedAt: string;
  distanceM: number;
  durationS: number;
  avgSpeedKmh: number;
  vehicleType: string;
  rqiScore: number;
  eventCount: number;
  acceptedAt: string | null;
  deviceUuid: string;
  devicePlatform: string;
  deviceModel: string | null;
}

export interface DeviceRow {
  id: number;
  deviceUuid: string;
  platform: string;
  model: string | null;
  appVersion: string | null;
  defaultVehicleType: string | null;
  journeyCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SignupRow {
  id: number;
  email: string;
  name: string | null;
  city: string | null;
  contribution: string | null;
  createdAt: string;
}

export interface JourneysResponse {
  ok: true;
  journeys: JourneyRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DevicesResponse {
  ok: true;
  devices: DeviceRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface SignupsResponse {
  ok: true;
  signups: SignupRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface LoginResponse {
  ok: true;
  token: string;
}

export interface CityRow {
  city: string;
  state: string | null;
  journeys24h: number;
  journeys7d: number;
  events24h: number;
  devices24h: number;
  avgRqi24h: number | null;
  lastReceivedAt: string | null;
}

export interface RecentJourneyRow {
  id: string;
  receivedAt: string;
  city: string;
  state: string | null;
  vehicleType: string;
  distanceM: number;
  rqiScore: number;
  eventCount: number;
}

export interface CitiesResponse {
  ok: true;
  generatedAt: string;
  cities: CityRow[];
  recent: RecentJourneyRow[];
}
