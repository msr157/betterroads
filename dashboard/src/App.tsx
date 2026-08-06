import '@/index.css';
import { useCallback, useState } from 'react';
import { TOKEN_STORAGE_KEY } from '@/lib/api';
import { Wordmark } from '@/components/ui';
import Login from '@/components/Login';
import Overview from '@/components/Overview';
import CitiesLive from '@/components/CitiesLive';
import JourneysTable from '@/components/JourneysTable';
import DevicesTable from '@/components/DevicesTable';
import WaitlistTable from '@/components/WaitlistTable';

type Screen = 'overview' | 'live' | 'journeys' | 'devices' | 'waitlist';

const TABS: Array<{ id: Screen; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'live', label: 'Live' },
  { id: 'journeys', label: 'Journeys' },
  { id: 'devices', label: 'Devices' },
  { id: 'waitlist', label: 'Waitlist' },
];

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [screen, setScreen] = useState<Screen>('overview');

  const connect = useCallback((t: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, t);
    setToken(t);
    setScreen('overview');
  }, []);

  /** Also used when any screen hits a 401 — the token was rotated/revoked. */
  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  if (!token) return <Login onConnect={connect} />;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-baseline gap-2.5">
            <Wordmark />
            <span className="eyebrow">Admin</span>
          </div>

          <nav className="flex gap-1" aria-label="Sections">
            {TABS.map((tab) => {
              const active = screen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScreen(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-bg-3 text-ink'
                      : 'text-ink-2 hover:bg-bg-2 hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={disconnect}
            className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            Disconnect
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {screen === 'overview' && <Overview token={token} onAuthError={disconnect} />}
        {screen === 'live' && <CitiesLive token={token} onAuthError={disconnect} />}
        {screen === 'journeys' && <JourneysTable token={token} onAuthError={disconnect} />}
        {screen === 'devices' && <DevicesTable token={token} onAuthError={disconnect} />}
        {screen === 'waitlist' && <WaitlistTable token={token} onAuthError={disconnect} />}
      </main>
    </div>
  );
}
