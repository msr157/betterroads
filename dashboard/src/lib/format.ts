/** 1,284 below 10K; 12.9K / 4.2M above — the stat-tile auto-compact rule. */
export function compactNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—';
  if (Math.abs(n) >= 10_000) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return n.toLocaleString('en');
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "05 Aug 26, 14:32" from an ISO timestamp. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

/** "5 Aug" from a YYYY-MM-DD day string. */
export function fmtShortDay(day: string | undefined): string {
  if (!day) return '';
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "1h 04m" / "12m 05s" from seconds. */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

/** "AUTO_RICKSHAW" → "Auto rickshaw", "android" → "Android". */
export function fmtLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replaceAll('_', ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
