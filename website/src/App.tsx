import '@/index.css';
import { Suspense, lazy } from 'react';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import Hero from '@/components/hero/Hero';
import Terms from '@/components/legal/Terms';
import Privacy from '@/components/legal/Privacy';

// Lazy — maplibre-gl is heavy and must not bloat the landing-page bundle.
const MapPage = lazy(() => import('@/components/map/MapPage'));

export default function App() {
  // Minimal path-based routing — the site is a teaser plus two legal pages.
  // nginx serves index.html for every path (SPA fallback), so /terms and
  // /privacy load this bundle and we branch on the pathname here.
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/terms') return <Terms />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/map') {
    return (
      <Suspense
        fallback={
          <div className="flex h-viewport items-center justify-center bg-paper">
            <p className="eyebrow animate-pulse">Loading map…</p>
          </div>
        }
      >
        <MapPage />
      </Suspense>
    );
  }

  return (
    <WaitlistProvider>
      <main id="top">
        <Hero />
      </main>
    </WaitlistProvider>
  );
}
