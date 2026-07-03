import { useEffect, useState } from 'react';
import { LAUNCH_DATE_ISO } from '@/lib/constants';
import { useMounted } from '@/hooks/useMounted';

const TARGET = new Date(LAUNCH_DATE_ISO).getTime();

type TimeLeft = { days: number; hours: number; mins: number; secs: number; done: boolean };

function getTimeLeft(): TimeLeft {
  let d = TARGET - Date.now();
  if (d <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, done: true };
  const days  = Math.floor(d / 86_400_000); d -= days  * 86_400_000;
  const hours = Math.floor(d /  3_600_000); d -= hours *  3_600_000;
  const mins  = Math.floor(d /     60_000); d -= mins  *     60_000;
  const secs  = Math.floor(d /       1000);
  return { days, hours, mins, secs, done: false };
}

/** Odometer-style rolling digit 0–9. */
function Digit({ d }: { d: number }) {
  return (
    <span style={{ position: 'relative', display: 'block', height: '1em', width: '0.62em', overflow: 'hidden' }}>
      <span
        style={{
          position: 'absolute', inset: 'auto 0 auto 0', top: 0,
          display: 'flex', flexDirection: 'column', willChange: 'transform',
          transform: `translateY(-${d * 10}%)`,
          transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ display: 'flex', height: '1em', alignItems: 'center', justifyContent: 'center' }}>
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}

function Unit({ value, label, minDigits = 2 }: { value: number; label: string; minDigits?: number }) {
  const digits = String(value).padStart(minDigits, '0').split('');
  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', borderLeft: '1px solid var(--color-line)' }}>
      <div className="font-display tabular-nums" style={{
        display: 'flex',
        fontSize: 'clamp(2.6rem, min(7.5vw, 11vh), 7rem)',
        fontWeight: 700,
        color: 'var(--color-ink)',
      }}>
        {digits.map((ch, i) => <Digit key={i} d={Number(ch)} />)}
      </div>
      <span className="eyebrow" style={{ marginTop: '1rem', fontSize: '0.65rem' }}>{label}</span>
    </div>
  );
}

export default function Countdown() {
  const mounted = useMounted();
  const [t, setT] = useState<TimeLeft>(() => getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const v = mounted ? t : { days: 0, hours: 0, mins: 0, secs: 0, done: false };

  if (v.done) {
    return (
      <p className="font-display" style={{ fontSize: 'clamp(2rem, 4vw, 3.75rem)', fontWeight: 700, color: 'var(--color-ink)' }}>
        We're live. Welcome to better roads.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
      <Unit value={v.days}  label="Days"    minDigits={2} />
      <Unit value={v.hours} label="Hours" />
      <Unit value={v.mins}  label="Minutes" />
      <Unit value={v.secs}  label="Seconds" />
    </div>
  );
}
