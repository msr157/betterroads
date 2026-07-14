import '@/index.css';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import Hero from '@/components/hero/Hero';
import Terms from '@/components/legal/Terms';
import Privacy from '@/components/legal/Privacy';

export default function App() {
  // Minimal path-based routing — the site is a teaser plus two legal pages.
  // nginx serves index.html for every path (SPA fallback), so /terms and
  // /privacy load this bundle and we branch on the pathname here.
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/terms') return <Terms />;
  if (path === '/privacy') return <Privacy />;

  return (
    <WaitlistProvider>
      <main id="top">
        <Hero />
      </main>
    </WaitlistProvider>
  );
}
