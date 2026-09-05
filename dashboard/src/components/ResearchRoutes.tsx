import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiGet, apiPost, type ResearchRouteRow, type ResearchSiteRow } from '@/lib/api';
import { Card, ErrorNote, LoadingNote, ScreenHeader } from '@/components/ui';
import { fmtLabel } from '@/lib/format';

const SITE_TYPES = ['POTHOLE_OR_DAMAGE', 'SPEED_BREAKER', 'JOINT_OR_DRAIN', 'RAIL_CROSSING', 'NORMAL_SECTION', 'OTHER', 'UNCERTAIN'];
const inputClass = 'w-full rounded-lg border border-line bg-bg-3 px-3 py-2.5 text-sm text-ink';

export default function ResearchRoutes({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [routes, setRoutes] = useState<ResearchRouteRow[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sites, setSites] = useState<ResearchSiteRow[]>([]);
  const [error, setError] = useState('');
  const [route, setRoute] = useState({ name: '', city: '', routeVersion: 'route-v1', geometry: '' });
  const [site, setSite] = useState({ stableSiteId: '', siteType: 'UNCERTAIN', lat: '', lon: '', direction: '', notes: '' });
  const loadRoutes = useCallback(() => apiGet<{ ok: true; routes: ResearchRouteRow[] }>('/api/admin/research/routes', token)
    .then((body) => setRoutes(body.routes)).catch((reason: unknown) => {
      if (reason instanceof ApiError && reason.status === 401) onAuthError();
      else setError(reason instanceof Error ? reason.message : 'Failed to load research routes.');
    }), [token, onAuthError]);
  const loadSites = useCallback(async (routeId: number) => {
    const body = await apiGet<{ ok: true; sites: ResearchSiteRow[] }>(`/api/admin/research/routes/${routeId}/sites`, token);
    setSites(body.sites); setSelected(routeId);
  }, [token]);
  useEffect(() => { void loadRoutes(); }, [loadRoutes]);
  if (!routes && !error) return <LoadingNote label="Loading research routes…" />;
  const createRoute = async () => {
    setError('');
    try {
      const geometry = JSON.parse(route.geometry) as Array<[number, number]>;
      await apiPost('/api/admin/research/routes', { ...route, geometry }, token);
      setRoute({ name: '', city: '', routeVersion: 'route-v1', geometry: '' }); await loadRoutes();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create route.'); }
  };
  const createSite = async () => {
    if (!selected) return;
    setError('');
    try {
      await apiPost(`/api/admin/research/routes/${selected}/sites`, {
        stableSiteId: site.stableSiteId, siteType: site.siteType, lat: Number(site.lat), lon: Number(site.lon),
        direction: site.direction || null, notes: site.notes || null,
      }, token);
      setSite({ stableSiteId: '', siteType: 'UNCERTAIN', lat: '', lon: '', direction: '', notes: '' }); await loadSites(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create site.'); }
  };
  return <div><ScreenHeader title="Surveyed routes" subtitle="Create pre-surveyed sites for marker alignment. No video is collected or required." />
    {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
    <Card className="mb-5 p-5"><h2 className="font-display text-lg font-semibold">New route version</h2><div className="mt-4 grid gap-3 md:grid-cols-2">
      <input className={inputClass} placeholder="Route name" value={route.name} onChange={(event) => setRoute({ ...route, name: event.target.value })} />
      <input className={inputClass} placeholder="City" value={route.city} onChange={(event) => setRoute({ ...route, city: event.target.value })} />
      <input className={inputClass} placeholder="Version" value={route.routeVersion} onChange={(event) => setRoute({ ...route, routeVersion: event.target.value })} />
      <input className={inputClass} placeholder='Path as [[lat,lon],[lat,lon],…]' value={route.geometry} onChange={(event) => setRoute({ ...route, geometry: event.target.value })} />
    </div><button type="button" disabled={!route.name || !route.city || !route.geometry} onClick={() => void createRoute()} className="mt-4 rounded-lg bg-saffron px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">Create immutable route version</button></Card>
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]"><Card className="h-fit overflow-hidden"><div className="border-b border-line p-4 text-sm font-semibold">Routes</div>{(routes ?? []).map((row) => <button key={row.id} type="button" onClick={() => void loadSites(row.id)} className={`block w-full border-b border-line px-4 py-3 text-left text-sm ${selected === row.id ? 'bg-saffron/10 text-saffron' : 'hover:bg-bg-3'}`}><span className="block font-medium">{row.name}</span><span className="text-xs text-ink-3">{row.city} · {row.routeVersion}</span></button>)}</Card>
      <div>{selected ? <><Card className="mb-5 p-5"><h2 className="font-display text-lg font-semibold">Add surveyed site</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input className={inputClass} placeholder="Stable site ID" value={site.stableSiteId} onChange={(event) => setSite({ ...site, stableSiteId: event.target.value })} />
        <select className={inputClass} value={site.siteType} onChange={(event) => setSite({ ...site, siteType: event.target.value })}>{SITE_TYPES.map((value) => <option key={value} value={value}>{fmtLabel(value)}</option>)}</select>
        <input className={inputClass} inputMode="decimal" placeholder="Latitude" value={site.lat} onChange={(event) => setSite({ ...site, lat: event.target.value })} />
        <input className={inputClass} inputMode="decimal" placeholder="Longitude" value={site.lon} onChange={(event) => setSite({ ...site, lon: event.target.value })} />
        <input className={inputClass} placeholder="Direction (optional)" value={site.direction} onChange={(event) => setSite({ ...site, direction: event.target.value })} />
        <input className={inputClass} placeholder="Notes (optional)" value={site.notes} onChange={(event) => setSite({ ...site, notes: event.target.value })} />
      </div><button type="button" disabled={!site.stableSiteId || !site.lat || !site.lon} onClick={() => void createSite()} className="mt-4 rounded-lg bg-saffron px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">Add site</button></Card>
      <Card className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="px-4 py-3 text-left text-xs text-ink-2">Site</th><th className="px-4 py-3 text-left text-xs text-ink-2">Type</th><th className="px-4 py-3 text-left text-xs text-ink-2">Location</th><th className="px-4 py-3 text-left text-xs text-ink-2">Direction</th></tr></thead><tbody className="divide-y divide-line">{sites.map((row) => <tr key={row.id}><td className="px-4 py-3 text-sm font-medium">{row.stableSiteId}</td><td className="px-4 py-3 text-sm">{fmtLabel(row.siteType)}</td><td className="px-4 py-3 text-sm tabular-nums text-ink-2">{row.lat.toFixed(5)}, {row.lon.toFixed(5)}</td><td className="px-4 py-3 text-sm text-ink-2">{row.direction ?? '—'}</td></tr>)}</tbody></table></Card></> : <Card className="p-8 text-center text-sm text-ink-2">Select a route to manage its surveyed sites.</Card>}</div></div>
  </div>;
}
