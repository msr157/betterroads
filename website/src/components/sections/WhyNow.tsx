import Reveal from '@/components/ui/Reveal';

export default function WhyNow() {
  return (
    <section id="why" style={{ background: 'var(--color-paper)', padding: '8rem 2.5rem 12rem' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        <Reveal><p className="eyebrow">Why now</p></Reveal>
        <Reveal delay={0.05}>
          <h2
            className="font-display"
            style={{ marginTop: '2.5rem', maxWidth: '52rem', fontSize: 'clamp(2.3rem, 5.8vw, 4.5rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}
          >
            A whole generation is watching the same broken loop.
          </h2>
        </Reveal>

        {/* The beat */}
        <div style={{ margin: '7rem auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
          <Reveal>
            <p className="font-display" style={{ fontSize: 'clamp(2.1rem, 4.8vw, 3.75rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Purpose exists.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="font-display" style={{ fontSize: 'clamp(2.1rem, 4.8vw, 3.75rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Outrage exists.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="font-display" style={{ fontSize: 'clamp(2.1rem, 4.8vw, 3.75rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Direction is <span style={{ color: 'var(--color-saffron)' }}>missing.</span>
            </p>
          </Reveal>
        </div>

        <Reveal>
          <h2
            className="font-display"
            style={{
              maxWidth: '52rem', marginLeft: 'auto', textAlign: 'right',
              fontSize: 'clamp(2.3rem, 5.8vw, 4.5rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--color-ink)',
            }}
          >
            So let's give it direction — before helplessness is inherited.
          </h2>
        </Reveal>
      </div>
    </section>
  );
}
