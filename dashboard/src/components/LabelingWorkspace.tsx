import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiGet, apiPost, type LabelQueueResponse, type LabelQueueWindow } from '@/lib/api';
import { Card, ErrorNote, LoadingNote, ScreenHeader } from '@/components/ui';
import { fmtDateTime, fmtLabel } from '@/lib/format';

const LABELS = ['USABLE_NORMAL', 'POTHOLE_OR_DAMAGE', 'SPEED_BREAKER', 'JOINT_OR_DRAIN', 'RAIL_CROSSING', 'HANDLING_OR_MANEUVER_ARTIFACT', 'OTHER_IMPACT', 'UNCERTAIN', 'UNUSABLE_SENSOR_DATA'] as const;

export default function LabelingWorkspace({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [windows, setWindows] = useState<LabelQueueWindow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [label, setLabel] = useState<(typeof LABELS)[number]>('UNCERTAIN');
  const [confidence, setConfidence] = useState(0.5);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = windows?.[index];
  const load = useCallback(() => {
    setError('');
    apiGet<LabelQueueResponse>('/api/admin/collection/label-queue', token).then((body) => { setWindows(body.windows); setIndex(0); })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) onAuthError();
        else setError(reason instanceof Error ? reason.message : 'Failed to load label queue.');
      });
  }, [token, onAuthError]);
  useEffect(load, [load]);
  const featureSummary = useMemo(() => current ? JSON.stringify(current.features, null, 2) : '', [current]);
  const save = async () => {
    if (!current) return;
    setSaving(true); setError('');
    try {
      await apiPost('/api/admin/collection/labels', {
        windowId: current.windowId, taxonomyVersion: 'impact-taxonomy-v1', primaryLabel: label,
        secondaryAttributes: {}, confidence,
        evidenceSource: 'SURVEYED_SITE_MARKER',
      }, token);
      setWindows((items) => items?.filter((item) => item.windowId !== current.windowId) ?? null);
      setIndex(0); setLabel('UNCERTAIN'); setConfidence(0.5);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onAuthError();
      else setError(reason instanceof Error ? reason.message : 'Could not save label.');
    } finally { setSaving(false); }
  };
  if (!windows && !error) return <LoadingNote label="Loading label queue…" />;
  return <div>
    <ScreenHeader title="Labeling" subtitle="Match controlled sensor windows to surveyed sites and repeat-pass evidence. Uncertain stays uncertain." />
    {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
    {!current ? <Card className="p-8 text-center text-sm text-ink-2">No controlled windows are waiting for review.</Card> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden"><div className="border-b border-line p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">{fmtLabel(current.vehicleClass)} · {fmtLabel(current.vehicleSubtype)}</h2><p className="mt-1 text-sm text-ink-2">{fmtDateTime(current.startedAt)} · {fmtLabel(current.kind)} · {fmtLabel(current.mountPosition)}</p></div><span className="text-xs text-ink-3">{index + 1} of {windows?.length ?? 0}</span></div></div>
        <div className="grid gap-4 p-5 sm:grid-cols-3"><div><p className="text-xs text-ink-3">Trigger evidence</p><p className="mt-1 text-sm">{current.triggerReasons.map(fmtLabel).join(', ') || 'Random normal sample'}</p></div><div><p className="text-xs text-ink-3">Location</p><p className="mt-1 text-sm tabular-nums">{current.lat === null ? 'Unavailable' : `${current.lat.toFixed(5)}, ${current.lon?.toFixed(5)} ±${Math.round(current.accuracyM ?? 0)}m`}</p></div><div><p className="text-xs text-ink-3">Review state</p><p className="mt-1 text-sm">{fmtLabel(current.labelState)}</p></div></div>
        <details className="border-t border-line p-5"><summary className="cursor-pointer text-sm font-medium">Inspect extracted features</summary><pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-bg-3 p-4 text-xs text-ink-2">{featureSummary}</pre></details>
      </Card>
      <Card className="h-fit p-5"><h2 className="font-display text-lg font-semibold">Independent review</h2><p className="mt-1 text-sm text-ink-2">Use the surveyed site and repeat-pass notes. Never infer a class from one spike alone.</p>
        <label className="mt-5 block text-xs font-medium text-ink-2">Label<select value={label} onChange={(event) => setLabel(event.target.value as typeof label)} className="mt-2 w-full rounded-lg border border-line bg-bg-3 px-3 py-2.5 text-sm text-ink">{LABELS.map((value) => <option key={value} value={value}>{fmtLabel(value)}</option>)}</select></label>
        <label className="mt-4 block text-xs font-medium text-ink-2">Confidence · {Math.round(confidence * 100)}%<input type="range" min="0" max="1" step="0.05" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="mt-2 w-full accent-saffron" /></label>
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 w-full rounded-lg bg-saffron px-4 py-2.5 text-sm font-semibold text-bg transition-opacity disabled:opacity-50">{saving ? 'Saving review…' : 'Save independent review'}</button>
      </Card>
    </div>}
  </div>;
}
