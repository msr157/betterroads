import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiGet, type CitiesResponse } from '@/lib/api';
import { fmtDateTime, fmtLabel } from '@/lib/format';
import { Card, ErrorNote, LoadingNote, ScreenHeader, Td, Th } from '@/components/ui';

/** How often the live view refetches. */
const POLL_MS = 20_000;

/** "2m ago" / "3h ago" / "5d ago" from an ISO timestamp. */
function fmtAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Live geography screen: journeys attributed to the nearest major Indian
 * city, plus a feed of the latest uploads. Polls the backend so the room
 * can watch data arrive city by city.
 */
export default function CitiesLive({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const [data, setData] = useState<CitiesResponse | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGet<CitiesResponse>('/api/admin/cities', token);
      setData(res);
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setRefreshing(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    void load();
    timerRef.current = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timerRef.current);
  }, [load]);

  if (!data && !error) return <LoadingNote label="Loading live activity…" />;
  if (!data) return <ErrorNote message={error} />;

  const active24h = data.cities.filter((c) => c.journeys24h > 0).length;

  return (
    <div>
      <ScreenHeader
        title="Live activity"
        subtitle={`${active24h.toLocaleString('en')} ${
          active24h === 1 ? 'city' : 'cities'
        } active in the last 24 h · refreshes every ${POLL_MS / 1000}s${
          refreshing ? ' · updating…' : ''
        }`}
      />
      {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}

      {/* ── Per-city rollup ─────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
          <table className="w-full border-collapse">
            <thead className="border-b border-line">
              <tr>
                <Th>City</Th>
                <Th right>Journeys 24h</Th>
                <Th right>Devices 24h</Th>
                <Th right>Events 24h</Th>
                <Th right>Avg RQI 24h</Th>
                <Th right>Journeys 7d</Th>
                <Th right>Last upload</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.cities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-3">
                    No journeys in the last 7 days.
                  </td>
                </tr>
              ) : (
                data.cities.map((c) => (
                  <tr key={c.city} className="transition-colors hover:bg-bg-3/60">
                    <Td>
                      <span className="text-ink">{c.city}</span>{' '}
                      {c.state ? <span className="text-xs text-ink-3">{c.state}</span> : null}
                    </Td>
                    <Td right>{c.journeys24h.toLocaleString('en')}</Td>
                    <Td right>{c.devices24h.toLocaleString('en')}</Td>
                    <Td right>{c.events24h.toLocaleString('en')}</Td>
                    <Td right>{c.avgRqi24h ?? '—'}</Td>
                    <Td right muted>{c.journeys7d.toLocaleString('en')}</Td>
                    <Td right muted>{fmtAgo(c.lastReceivedAt)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Latest uploads feed ─────────────────────────────────────── */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold tracking-tight text-ink">
        Latest uploads
      </h2>
      <Card className="overflow-hidden">
        <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
          <table className="w-full border-collapse">
            <thead className="border-b border-line">
              <tr>
                <Th>Received</Th>
                <Th>City</Th>
                <Th>Vehicle</Th>
                <Th right>Distance km</Th>
                <Th right>RQI</Th>
                <Th right>Events</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-3">
                    Waiting for the first journey…
                  </td>
                </tr>
              ) : (
                data.recent.map((j) => (
                  <tr key={j.id} className="transition-colors hover:bg-bg-3/60">
                    <Td muted>{fmtDateTime(j.receivedAt)}</Td>
                    <Td>{j.city}</Td>
                    <Td muted>{fmtLabel(j.vehicleType)}</Td>
                    <Td right>{(j.distanceM / 1000).toFixed(1)}</Td>
                    <Td right>{Math.round(j.rqiScore)}</Td>
                    <Td right>{j.eventCount.toLocaleString('en')}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
