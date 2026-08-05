import { useEffect, useState } from 'react';
import { ApiError, apiGet, type DailyPoint, type OverviewResponse } from '@/lib/api';
import { compactNumber, fmtShortDay } from '@/lib/format';
import { Card, ErrorNote, LoadingNote, ScreenHeader } from '@/components/ui';

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{compactNumber(value)}</p>
    </Card>
  );
}

// ─── 14-day journeys bar sparkline (inline SVG, no chart lib) ────────────────

const CHART = {
  width: 560,
  height: 148,
  top: 24, // headroom for the max direct-label
  bottom: 20, // room for the first/last date ticks
  gap: 2, // surface gap between adjacent bars
  maxBarWidth: 24,
  cornerRadius: 4,
};

/** Bar with a rounded top and a square baseline, grown from the baseline. */
function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

function JourneysSparkline({ daily }: { daily: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(1, daily.length);
  const { width, height, top, bottom, gap, maxBarWidth, cornerRadius } = CHART;
  const base = height - bottom;
  const slot = width / n;
  const barW = Math.min(maxBarWidth, slot - gap);
  const max = Math.max(1, ...daily.map((d) => d.journeys));
  const maxIdx = daily.findIndex((d) => d.journeys === max);
  const barHeight = (v: number) => Math.round((v / max) * (base - top));

  const hovered = hover !== null ? daily[hover] : null;
  // Tooltip x as a % of chart width, clamped so it never leaves the card.
  const tooltipLeft = hover !== null ? Math.min(86, Math.max(14, ((hover + 0.5) / n) * 100)) : 0;

  return (
    <div className="relative">
      {hovered ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-bg-3 px-3 py-2 shadow-lg"
          style={{ left: `${tooltipLeft}%` }}
        >
          <p className="whitespace-nowrap text-sm font-semibold text-ink">
            {hovered.journeys.toLocaleString('en')} journeys
          </p>
          <p className="whitespace-nowrap text-xs text-ink-2">
            {hovered.events.toLocaleString('en')} events · {fmtShortDay(hovered.day)}
          </p>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        role="img"
        aria-label={`Journeys per day over the last ${daily.length} days`}
        onPointerLeave={() => setHover(null)}
      >
        {/* Baseline — recessive hairline */}
        <line x1={0} y1={base} x2={width} y2={base} stroke="var(--color-line-strong)" strokeWidth={1} />

        {/* Bars */}
        {daily.map((d, i) => {
          const h = barHeight(d.journeys);
          const x = i * slot + (slot - barW) / 2;
          return h > 0 ? (
            <path
              key={`bar-${d.day}`}
              d={roundedTopBar(x, base - h, barW, h, cornerRadius)}
              fill={hover === i ? 'var(--color-saffron-lift)' : 'var(--color-saffron-deep)'}
            />
          ) : null;
        })}

        {/* Selective direct label — the extreme only */}
        {maxIdx >= 0 && daily[maxIdx].journeys > 0 ? (
          <text
            x={maxIdx * slot + slot / 2}
            y={base - barHeight(daily[maxIdx].journeys) - 7}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-2)"
          >
            {daily[maxIdx].journeys.toLocaleString('en')}
          </text>
        ) : null}

        {/* First / last date ticks */}
        <text x={2} y={height - 5} fontSize={10} fill="var(--color-ink-3)">
          {fmtShortDay(daily[0]?.day)}
        </text>
        <text x={width - 2} y={height - 5} textAnchor="end" fontSize={10} fill="var(--color-ink-3)">
          {fmtShortDay(daily[daily.length - 1]?.day)}
        </text>

        {/* Hover hit targets — full slot height, wider than the mark */}
        {daily.map((d, i) => (
          <rect
            key={`hit-${d.day}`}
            x={i * slot}
            y={0}
            width={slot}
            height={height}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
          >
            <title>{`${fmtShortDay(d.day)}: ${d.journeys} journeys, ${d.events} events`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Overview({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    apiGet<OverviewResponse>('/api/admin/overview', token)
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onAuthError();
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, onAuthError]);

  if (!data && loading) return <LoadingNote label="Loading overview…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const { counts, daily } = data;
  const totalJourneys14d = daily.reduce((sum, d) => sum + d.journeys, 0);
  const totalEvents14d = daily.reduce((sum, d) => sum + d.events, 0);

  return (
    <div>
      <ScreenHeader title="Overview" subtitle="Live counts across the BetterRoads network." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Waitlist signups" value={counts.signups} />
        <StatTile label="Devices" value={counts.devices} />
        <StatTile label="Journeys" value={counts.journeys} />
        <StatTile label="Road events" value={counts.events} />
        <StatTile label="Road segments" value={counts.segments} />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Journeys per day — last 14 days</h2>
          <p className="text-xs tabular-nums text-ink-2">
            {totalJourneys14d.toLocaleString('en')} journeys · {totalEvents14d.toLocaleString('en')}{' '}
            events
          </p>
        </div>
        <JourneysSparkline daily={daily} />
      </Card>
    </div>
  );
}
