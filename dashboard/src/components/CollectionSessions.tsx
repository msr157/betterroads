import { useState } from 'react';
import { apiGet, type CollectionSessionDetailResponse, type CollectionSessionRow, type CollectionSessionsResponse } from '@/lib/api';
import { fmtDateTime, fmtLabel } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { Card, ErrorNote, LoadingNote, ScreenHeader, TableCard, Td, Th } from '@/components/ui';

const pickSessions = (body: CollectionSessionsResponse) => body.sessions;

export default function CollectionSessions({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [detail, setDetail] = useState<CollectionSessionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { rows, total, offset, limit, loading, error, setOffset } = usePaged<CollectionSessionsResponse, CollectionSessionRow>(
    '/api/admin/collection/sessions', token, pickSessions, onAuthError,
  );
  if (!rows && loading) return <LoadingNote label="Loading collection sessions…" />;
  if (error && !rows) return <ErrorNote message={error} />;
  return <div>
    <ScreenHeader title="Collection" subtitle="Vehicle-separated v3 research data. These sessions do not update the public map." />
    {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
    <TableCard colCount={9} rowCount={rows?.length ?? 0} emptyLabel="No v3 collection sessions yet." loading={loading}
      offset={offset} limit={limit} total={total} onOffset={setOffset} head={<>
        <Th>Completed</Th><Th>Vehicle dataset</Th><Th>Mode</Th><Th>Quality</Th><Th>Device</Th>
        <Th right>Distance km</Th><Th right>Windows</Th><Th right>Raw</Th><Th>Profile</Th>
      </>}>
      {(rows ?? []).map((session) => <tr key={session.id} onClick={() => { setDetailLoading(true); void apiGet<CollectionSessionDetailResponse>(`/api/admin/collection/sessions/${session.id}`, token).then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false)); }} className="cursor-pointer transition-colors hover:bg-bg-3/60">
        <Td muted>{session.completedAt ? fmtDateTime(session.completedAt) : fmtLabel(session.uploadState)}</Td>
        <Td><span className="font-medium">{fmtLabel(session.vehicleClass)}</span><span className="ml-2 text-xs text-ink-3">{fmtLabel(session.vehicleSubtype)}</span></Td>
        <Td muted>{fmtLabel(session.mode)}</Td>
        <Td><span className={session.qualityStatus === 'QUARANTINED' ? 'text-red-400' : 'text-ink'} title={session.qualityReasons.join(', ')}>{session.qualityStatus ? fmtLabel(session.qualityStatus) : 'Pending'}</span></Td>
        <Td><span>{session.deviceModel ?? 'Unknown model'}</span><span className="ml-2 text-xs text-ink-3">{session.deviceUuid.slice(0, 8)}</span></Td>
        <Td right>{session.acceptedDistanceM === null ? '—' : (session.acceptedDistanceM / 1000).toFixed(2)}</Td>
        <Td right>{session.windowCount.toLocaleString('en')}</Td><Td right>{session.rawObjectCount.toLocaleString('en')}</Td>
        <Td muted>{session.profileVersion}</Td>
      </tr>)}
    </TableCard>
    {detailLoading ? <div className="mt-5"><LoadingNote label="Loading session evidence…" /></div> : detail ? <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line p-5"><h2 className="font-display text-lg font-semibold">Session evidence</h2><p className="mt-1 break-all text-xs text-ink-3">{String(detail.session.id ?? '')}</p></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"><Evidence label="Sensor quality" value={JSON.stringify(detail.session.sensor_quality ?? {})} /><Evidence label="Timing" value={JSON.stringify(detail.session.timing_diagnostics ?? {})} /><Evidence label="Accepted GPS fixes" value={String(Array.isArray(detail.session.location_samples) ? detail.session.location_samples.length : 0)} /><Evidence label="Window / raw / marker" value={`${detail.windows.length} / ${detail.rawObjects.length} / ${detail.markers.length}`} /></div>
      <details className="border-t border-line p-5"><summary className="cursor-pointer text-sm font-medium">Inspect feature-window and marker timeline</summary><pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-bg-3 p-4 text-xs text-ink-2">{JSON.stringify({ windows: detail.windows, markers: detail.markers }, null, 2)}</pre></details>
    </Card> : null}
  </div>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-ink-3">{label}</p><p className="mt-1 line-clamp-3 break-words text-sm text-ink-2">{value}</p></div>;
}
