import { rqiGradient, EVENT_COLOR } from '@/components/map/rqiScale';

/**
 * Compact map key: the RQI 0–100 gradient with labeled poles (color never
 * carries meaning alone) plus the event-marker dot.
 */
export default function MapLegend() {
  return (
    <div className="pointer-events-auto rounded-xl border border-line bg-paper/95 px-3 py-2.5 shadow-[0_12px_32px_-16px_rgba(10,10,10,0.3)] backdrop-blur">
      <p className="eyebrow text-[0.58rem]">Road quality</p>
      <div
        aria-hidden
        className="mt-1.5 h-1.5 w-36 rounded-full"
        style={{ background: rqiGradient }}
      />
      <div className="mt-1 flex w-36 justify-between text-[0.625rem] text-ink-2">
        <span>0 · Poor</span>
        <span>100 · Good</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[0.625rem] text-ink-2">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full border border-paper"
          style={{ background: EVENT_COLOR }}
        />
        Reported event (potholes &amp; more)
      </div>
    </div>
  );
}
