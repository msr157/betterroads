import { useEffect, useRef, useState } from 'react';
import { formatDay } from '@/components/map/api';
import { SPARKLINE_COLOR } from '@/components/map/rqiScale';

type Props = {
  /** Full calendar range, earliest → latest (one entry per day). */
  days: string[];
  /** Per-day activity (segments updated), aligned with `days`. */
  activity: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

/**
 * Draggable timeline docked at the bottom of the map — Google-Maps-traffic
 * style. A native range input (invisible, full-size) drives the scrubbing so
 * drag, tap-to-seek, touch and arrow keys all work for free; the visible
 * thumb, marker line and per-day activity sparkline render underneath it.
 */
export default function TimelineBar({ days, activity, selectedIndex, onSelect }: Props) {
  const [playing, setPlaying] = useState(false);

  // Interval reads via refs so play never captures a stale index.
  const indexRef = useRef(selectedIndex);
  indexRef.current = selectedIndex;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const last = days.length - 1;
  const atEnd = selectedIndex >= last;

  // Auto-advance one day per tick; pause when the scrub reaches "today".
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = indexRef.current + 1;
      if (next > days.length - 1) {
        setPlaying(false);
      } else {
        onSelectRef.current(next);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [playing, days.length]);

  const togglePlay = () => {
    // Play from the start again once the scrub has reached the end.
    if (!playing && atEnd) onSelect(0);
    setPlaying((p) => !p);
  };

  const pct = last > 0 ? (selectedIndex / last) * 100 : 0;
  const maxActivity = Math.max(1, ...activity);

  return (
    <div className="pointer-events-auto rounded-2xl border border-line bg-paper/95 p-3 shadow-[0_18px_44px_-18px_rgba(10,10,10,0.35)] backdrop-blur sm:p-4">
      {/* ── Date readout + play control ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:border-saffron hover:text-saffron"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3.5 w-3.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <p className="font-display text-sm font-bold tracking-tight text-ink">
          {formatDay(days[selectedIndex])}
          {atEnd && (
            <span className="ml-2 text-xs font-medium text-ink-3">latest</span>
          )}
        </p>
        <span className="eyebrow ml-auto hidden text-[0.6rem] sm:inline">Timeline</span>
      </div>

      {/* ── Scrub track: sparkline + baseline + marker + range input ── */}
      <div className="relative mt-2 h-10">
        {/* Per-day activity sparkline (single series → slot-1 blue) */}
        <svg
          aria-hidden
          preserveAspectRatio="none"
          viewBox={`0 0 ${days.length} 40`}
          className="absolute inset-x-0 bottom-1 h-7 w-full"
        >
          {activity.map((v, i) =>
            v > 0 ? (
              <rect
                key={days[i]}
                x={i + 0.12}
                width={0.76}
                y={40 - (4 + (v / maxActivity) * 36)}
                height={4 + (v / maxActivity) * 36}
                fill={SPARKLINE_COLOR}
                opacity={0.35}
              />
            ) : null,
          )}
        </svg>

        {/* Baseline */}
        <div className="absolute inset-x-0 bottom-1 h-px bg-line-strong" />

        {/* Selected-day marker line + thumb */}
        <div
          aria-hidden
          className="absolute bottom-1 top-0 w-px bg-ink/50"
          style={{ left: `${pct}%` }}
        />
        <div
          aria-hidden
          className="absolute h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper shadow-sm"
          style={{ left: `calc(${pct}% - 0.4375rem)`, bottom: '-0.3125rem' }}
        />

        {/* The actual control — invisible, but owns drag/touch/keyboard */}
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={selectedIndex}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-label="Road quality date"
          aria-valuetext={formatDay(days[selectedIndex])}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      {/* ── Range endpoints ─────────────────────────────────────────── */}
      <div className="mt-1.5 flex justify-between text-[0.625rem] text-ink-3">
        <span>{formatDay(days[0])}</span>
        <span>{formatDay(days[last])}</span>
      </div>
    </div>
  );
}
