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
  summary: { sectionsNew: number; conditionChanges: number; potholeSignals: number };
  isLoading: boolean;
};

/**
 * Draggable timeline docked at the bottom of the map — Google-Maps-traffic
 * style. A native range input (invisible, full-size) drives the scrubbing so
 * drag, tap-to-seek, touch and arrow keys all work for free; the visible
 * thumb, marker line and per-day activity sparkline render underneath it.
 */
export default function TimelineBar({ days, activity, selectedIndex, onSelect, summary, isLoading }: Props) {
  const [playing, setPlaying] = useState(false);

  // Interval reads via refs so play never captures a stale index.
  const indexRef = useRef(selectedIndex);
  indexRef.current = selectedIndex;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const last = days.length - 1;
  const atEnd = selectedIndex >= last;

  // Advance only after the current date has finished drawing. A fixed interval
  // can outrun a slow API and repeatedly abort every in-flight map request.
  useEffect(() => {
    if (!playing || isLoading) return;
    const id = window.setTimeout(() => {
      const next = indexRef.current + 1;
      if (next > days.length - 1) {
        setPlaying(false);
      } else {
        onSelectRef.current(next);
      }
    }, 850);
    return () => window.clearTimeout(id);
  }, [playing, isLoading, selectedIndex, days.length]);

  const togglePlay = () => {
    // Play from the start again once the scrub has reached the end.
    if (!playing && atEnd) onSelect(0);
    setPlaying((p) => !p);
  };

  const selectManually = (index: number) => {
    setPlaying(false);
    onSelect(index);
  };

  const pct = last > 0 ? (selectedIndex / last) * 100 : 0;
  const maxActivity = Math.max(1, ...activity);

  return (
    <section className="map-timeline" aria-label="Historical map playback" aria-busy={isLoading}>
      {/* ── Date readout + play control ─────────────────────────────── */}
      <div className="map-timeline-head">
        <button type="button" onClick={() => selectManually(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0 || isLoading} aria-label="Previous day" className="map-time-step">
          <svg viewBox="0 0 24 24" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          className="map-time-play"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <p className="map-timeline-date">
          {formatDay(days[selectedIndex])}
          {atEnd && (
            <span>Latest</span>
          )}
          {isLoading && <span className="map-time-loading">Drawing…</span>}
        </p>
        <button type="button" onClick={() => selectManually(Math.min(last, selectedIndex + 1))} disabled={atEnd || isLoading} aria-label="Next day" className="map-time-step">
          <svg viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
        </button>
        <p className="map-change-summary" aria-live="polite">{summary.sectionsNew} new sections · {summary.conditionChanges} condition changes · {summary.potholeSignals} new pothole {summary.potholeSignals === 1 ? 'signal' : 'signals'}</p>
      </div>

      {/* ── Scrub track: sparkline + baseline + marker + range input ── */}
      <div className="map-time-track">
        {/* Per-day activity sparkline (single series → slot-1 blue) */}
        <svg
          aria-hidden
          preserveAspectRatio="none"
          viewBox={`0 0 ${days.length} 40`}
          className="map-time-bars"
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
        <div className="map-time-baseline" />

        {/* Selected-day marker line + thumb */}
        <div
          aria-hidden
          className="map-time-marker"
          style={{ left: `${pct}%` }}
        />
        <div
          aria-hidden
          className="map-time-thumb"
          style={{ left: `calc(${pct}% - 0.4375rem)`, bottom: '-0.3125rem' }}
        />

        {/* The actual control — invisible, but owns drag/touch/keyboard */}
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={selectedIndex}
          onChange={(e) => selectManually(Number(e.target.value))}
          aria-label="Road quality date"
          aria-valuetext={formatDay(days[selectedIndex])}
          className="map-time-input"
        />
      </div>

      {/* ── Range endpoints ─────────────────────────────────────────── */}
      <div className="map-time-ends">
        <span>{formatDay(days[0])}</span>
        <span>{formatDay(days[last])}</span>
      </div>
    </section>
  );
}
