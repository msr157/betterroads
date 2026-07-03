import { useEffect, useState } from 'react';
import { useWaitlist } from '@/components/providers/WaitlistProvider';
import { NAV_LINKS, SITE } from '@/lib/constants';

export default function Navbar() {
  const { open } = useWaitlist();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header style={{
      position: 'fixed', inset: '0 0 auto 0', zIndex: 50,
      transition: 'background 0.3s, border-color 0.3s',
      background: scrolled ? 'rgba(244,240,232,0.92)' : 'transparent',
      borderBottom: scrolled ? '1px solid var(--color-line)' : '1px solid transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
    }}>
      <nav style={{
        display: 'flex', height: '4rem', maxWidth: '72rem',
        margin: '0 auto', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2.5rem',
      }}>
        <a
          href="#top"
          className="font-display"
          style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em', color: 'var(--color-ink)', textDecoration: 'none' }}
        >
          {SITE.wordmark}<span style={{ color: 'var(--color-saffron)' }}>.</span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2.25rem' }}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="link-underline"
              style={{
                fontSize: '0.875rem', fontWeight: 500,
                color: 'var(--color-ink-2)', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          onClick={open}
          className="font-display"
          style={{
            borderRadius: '9999px', border: '1px solid var(--color-ink)',
            padding: '0.5rem 1.25rem',
            fontWeight: 600, fontSize: '0.875rem',
            color: 'var(--color-ink)', background: 'transparent', cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget;
            btn.style.background = 'var(--color-ink)';
            btn.style.color = 'var(--color-paper)';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget;
            btn.style.background = 'transparent';
            btn.style.color = 'var(--color-ink)';
          }}
        >
          Join us
        </button>
      </nav>
    </header>
  );
}
