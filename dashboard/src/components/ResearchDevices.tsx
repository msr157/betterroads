import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiGet, apiPost, apiRequest, type ResearchDeviceRow } from '@/lib/api';
import { Card, ErrorNote, LoadingNote, ScreenHeader } from '@/components/ui';
import { fmtDateTime, fmtLabel } from '@/lib/format';

export default function ResearchDevices({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [rows, setRows] = useState<ResearchDeviceRow[] | null>(null);
  const [uuid, setUuid] = useState('');
  const [vehicleClass, setVehicleClass] = useState('CAR');
  const [error, setError] = useState('');
  const load = useCallback(() => apiGet<{ ok: true; devices: ResearchDeviceRow[] }>('/api/admin/research/devices', token)
    .then((body) => setRows(body.devices)).catch((reason: unknown) => {
      if (reason instanceof ApiError && reason.status === 401) onAuthError();
      else setError(reason instanceof Error ? reason.message : 'Failed to load research devices.');
    }), [token, onAuthError]);
  useEffect(() => { void load(); }, [load]);
  if (!rows && !error) return <LoadingNote label="Loading research devices…" />;
  const authorize = async () => {
    setError('');
    try { await apiPost('/api/admin/research/devices', { deviceUuid: uuid, permittedVehicleClasses: [vehicleClass], expiresAt: null, operatorNote: null }, token); setUuid(''); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not authorize device.'); }
  };
  const revoke = async (deviceUuid: string) => { await apiRequest(`/api/admin/research/devices/${deviceUuid}`, token, 'DELETE'); await load(); };
  return <div><ScreenHeader title="Research devices" subtitle="Only authorized installations can upload controlled raw sensor windows, and authorization is vehicle-specific." />
    {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
    <Card className="mb-5 p-5"><div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_14rem_auto]"><label className="text-xs font-medium text-ink-2">Installation UUID<input value={uuid} onChange={(event) => setUuid(event.target.value)} placeholder="00000000-0000-4000-8000-000000000000" className="mt-2 w-full rounded-lg border border-line bg-bg-3 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-medium text-ink-2">Vehicle dataset<select value={vehicleClass} onChange={(event) => setVehicleClass(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-bg-3 px-3 py-2.5 text-sm text-ink"><option>CAR</option><option>BIKE</option><option>AUTO_RICKSHAW</option><option>BUS</option><option>TRUCK</option></select></label><button type="button" disabled={!uuid} onClick={() => void authorize()} className="self-end rounded-lg bg-saffron px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">Authorize device</button></div></Card>
    <Card className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="px-4 py-3 text-left text-xs text-ink-2">Device</th><th className="px-4 py-3 text-left text-xs text-ink-2">Datasets</th><th className="px-4 py-3 text-left text-xs text-ink-2">Status</th><th className="px-4 py-3 text-left text-xs text-ink-2">Created</th><th /></tr></thead><tbody className="divide-y divide-line">{(rows ?? []).map((row) => <tr key={row.deviceUuid}><td className="px-4 py-3 text-sm">{row.deviceUuid}</td><td className="px-4 py-3 text-sm text-ink-2">{row.permittedVehicleClasses.map(fmtLabel).join(', ')}</td><td className="px-4 py-3 text-sm">{fmtLabel(row.status)}</td><td className="px-4 py-3 text-sm text-ink-2">{fmtDateTime(row.createdAt)}</td><td className="px-4 py-3 text-right">{row.status === 'AUTHORIZED' ? <button type="button" onClick={() => void revoke(row.deviceUuid)} className="text-sm text-red-400">Revoke</button> : null}</td></tr>)}</tbody></table></Card>
  </div>;
}

