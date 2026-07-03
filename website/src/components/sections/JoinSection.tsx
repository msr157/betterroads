import Countdown from '@/components/countdown/Countdown';
import MagneticButton from '@/components/ui/MagneticButton';
import Reveal from '@/components/ui/Reveal';
import { useWaitlist } from '@/components/providers/WaitlistProvider';

export default function JoinSection() {
  const { open, count } = useWaitlist();

  return (
    <section id="movement" style={{ padding: '7rem 2.5rem 10rem' }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        <Reveal><p className="eyebrow">The countdown</p></Reveal>

        <div style={{
          marginTop: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem',
          borderBottom: '1px solid var(--color-line)', paddingBottom: '3rem',
          alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <Reveal>
            <h2
              className="font-display"
              style={{ fontSize: 'clamp(2.3rem, 5.8vw, 4.5rem)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}
            >
              Mumbai first.<br />15 August 2026.
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p style={{ color: 'var(--color-ink-2)', textAlign: 'right', lineHeight: 1.6 }}>
              Independence Day · 00:00 IST<br />
              <span style={{ fontWeight: 600, color: 'var(--color-saffron)' }}>#FreedomFromPotholes</span>
            </p>
          </Reveal>
        </div>

        {/* Countdown */}
        <Reveal delay={0.1}>
          <div style={{ borderBottom: '1px solid var(--color-line)', padding: '3.5rem 0' }}>
            <Countdown />
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.1}>
          <div style={{
            marginTop: '3rem', display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
          }}>
            <p style={{ maxWidth: '28rem', fontSize: '1.125rem', color: 'var(--color-ink-2)', lineHeight: 1.6 }}>
              {typeof count === 'number' && count > 0 ? (
                <>
                  Every phone makes the proof harder to ignore.{' '}
                  <strong style={{ color: 'var(--color-ink)' }}>{count.toLocaleString('en-IN')}</strong>{' '}
                  have added theirs. Add yours.
                </>
              ) : (
                <>Every phone makes the proof harder to ignore. Add yours — and help end the age of helplessness.</>
              )}
            </p>
            <MagneticButton
              onClick={open}
              aria-label="Join the movement"
              className="font-display"
              style={{
                borderRadius: '9999px', background: 'var(--color-saffron)',
                padding: '1rem 2.25rem', fontWeight: 600, fontSize: '1.125rem',
                color: 'var(--color-paper)', border: 'none', cursor: 'pointer',
                boxShadow: '0 14px 34px -12px rgba(224,97,28,0.6)',
                transition: 'background 0.2s',
              } as React.CSSProperties}
            >
              Join the movement
            </MagneticButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
