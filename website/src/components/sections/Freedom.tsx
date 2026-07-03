import Reveal from '@/components/ui/Reveal';
import Flag from '@/components/ui/Flag';
import { SITE } from '@/lib/constants';

export default function Freedom() {
  return (
    <section
      id="freedom"
      style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-paper)', padding: '9rem 2.5rem 13rem' }}
    >
      {/* Warm glow */}
      <div
        aria-hidden
        style={{
          pointerEvents: 'none',
          position: 'absolute', left: '50%', top: '50%',
          height: '620px', width: 'min(1100px, 95vw)',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(closest-side, rgba(224,97,28,0.1), rgba(224,97,28,0.04) 55%, transparent 75%)',
        }}
      />

      <div style={{ position: 'relative', maxWidth: '64rem', margin: '0 auto', textAlign: 'center' }}>
        <Reveal><p className="eyebrow">A second freedom · 15 August 2026</p></Reveal>

        <Reveal delay={0.05}>
          <h2
            className="font-display"
            style={{ marginTop: '2.5rem', fontSize: 'clamp(2.4rem, 6.8vw, 6rem)', fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}
          >
            In 1947, we won a country.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <Flag style={{ margin: '2.25rem auto', height: '2.75rem', width: '4.125rem', boxShadow: '0 6px 20px -8px rgba(0,0,0,0.35)' } as React.CSSProperties} />
        </Reveal>

        <Reveal delay={0.12}>
          <h2
            className="font-display"
            style={{ fontSize: 'clamp(2.4rem, 6.8vw, 6rem)', fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}
          >
            This year, we take back{' '}
            <span className="text-tricolor">our streets.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.18}>
          <p className="font-hindi" lang="hi" style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 2.5vw, 1.875rem)', color: 'var(--color-ink)' }}>
            {SITE.taglineHindi}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
