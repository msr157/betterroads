import Flag from '@/components/ui/Flag';
import { SITE, SOCIALS } from '@/lib/constants';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--color-line)',
      background: 'var(--color-paper-3)',
      padding: '4rem 2.5rem',
    }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {/* Wordmark + socials */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '2rem',
          borderBottom: '1px solid var(--color-line)', paddingBottom: '3rem',
          alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <a
              href="#top"
              className="font-display"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-ink)', textDecoration: 'none' }}
            >
              {SITE.wordmark}<span style={{ color: 'var(--color-saffron)' }}>.</span>
            </a>
            <p style={{ marginTop: '1rem', maxWidth: '18rem', lineHeight: 1.6, color: 'var(--color-ink-2)', fontSize: '0.95rem' }}>
              {SITE.tagline} · <span className="font-hindi">{SITE.taglineHindi}</span>
            </p>
            <p style={{ marginTop: '0.75rem', maxWidth: '18rem', fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--color-ink-3)' }}>
              {SITE.methodline}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem 2rem' }}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-ink-2)', textDecoration: 'none' }}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem',
          paddingTop: '2rem', fontSize: '0.875rem', color: 'var(--color-ink-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Flag style={{ height: '1rem', width: '1.5rem', flexShrink: 0 } as React.CSSProperties} />
            <span>© {new Date().getFullYear()} {SITE.name}. A citizen movement.</span>
          </div>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  );
}
