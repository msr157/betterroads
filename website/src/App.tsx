import '@/index.css';
import { Suspense, lazy } from 'react';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import Hero from '@/components/hero/Hero';
import Terms from '@/components/legal/Terms';
import Privacy from '@/components/legal/Privacy';
import AppDownload from '@/components/app/AppDownload';
import DeleteAccount from '@/components/legal/DeleteAccount';
import FeedbackWidget from '@/components/FeedbackWidget';

// Lazy — maplibre-gl is heavy and must not bloat the landing-page bundle.
const MapPage = lazy(() => import('@/components/map/MapPage'));
const TestMapLab = lazy(() => import('@/components/map/TestMapLab'));
const conceptsEnabled = import.meta.env.VITE_ENABLE_CONCEPTS === 'true';
const Concepts = conceptsEnabled
  ? lazy(() => import('@/components/concepts/Concepts'))
  : null;

export default function App() {
  // Minimal path-based routing — teaser, legal pages, app download, and the
  // public panel. nginx serves index.html for every path (SPA fallback), so
  // each path loads this bundle and we branch on the pathname here.
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (conceptsEnabled && Concepts && path.startsWith('/concepts')) {
    return (
      <Suspense fallback={<div className="flex h-viewport items-center justify-center bg-[#11100e] text-[#f4ead8]">Preparing concepts…</div>}>
        <Concepts path={path} />
      </Suspense>
    );
  }

  if (path === '/terms') return <Terms />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/delete-account') return <DeleteAccount />;
  if (path === '/app') return <AppDownload />;
  if (import.meta.env.DEV && path === '/testmap') {
    return (
      <Suspense fallback={<div className="flex h-viewport items-center justify-center bg-[#f4f1ea] text-[#161511]">Preparing map concepts…</div>}>
        <TestMapLab />
      </Suspense>
    );
  }
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
      <FeedbackWidget />
    </WaitlistProvider>
  );
}
