import '@/index.css';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, TOKEN_STORAGE_KEY } from '@/lib/api';
import { Wordmark } from '@/components/ui';
import Login from '@/components/Login';
import Overview from '@/components/Overview';
import CitiesLive from '@/components/CitiesLive';
import JourneysTable from '@/components/JourneysTable';
import DevicesTable from '@/components/DevicesTable';
import WaitlistTable from '@/components/WaitlistTable';
import FeedbackTable from '@/components/FeedbackTable';
import CollectionSessions from '@/components/CollectionSessions';
import LabelingWorkspace from '@/components/LabelingWorkspace';
import ResearchDevices from '@/components/ResearchDevices';
import ResearchRoutes from '@/components/ResearchRoutes';
import { Account, Alerts, Contracts, GlobalSearch, MapAnalytics } from '@/components/AdminTools';

type Screen = 'overview' | 'live' | 'journeys' | 'collection' | 'labeling' | 'research-routes' | 'research-devices' | 'devices' | 'waitlist' | 'feedback' | 'map' | 'contracts' | 'account';
const NAV: Array<{ id: Screen; label: string; group?: string }> = [
  { id: 'overview', label: 'Overview', group: 'Operations' }, { id: 'live', label: 'Live' }, { id: 'journeys', label: 'Journeys' }, { id: 'devices', label: 'Devices' }, { id: 'waitlist', label: 'Waitlist' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'collection', label: 'Collection', group: 'Research' }, { id: 'labeling', label: 'Labeling' }, { id: 'research-routes', label: 'Surveyed routes' }, { id: 'research-devices', label: 'Research devices' },
  { id: 'map', label: 'Map Analytics', group: 'Intelligence' }, { id: 'contracts', label: 'Contracts' }, { id: 'account', label: 'Profile & security', group: 'Administration' },
];

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [screen, setScreen] = useState<Screen>('overview');
  const connect = useCallback((t: string) => { localStorage.setItem(TOKEN_STORAGE_KEY, t); setToken(t); setScreen('overview'); }, []);
  const disconnect = useCallback(() => { localStorage.removeItem(TOKEN_STORAGE_KEY); setToken(null); }, []);
  const logout = useCallback(() => { if (token) void apiPost('/api/admin/auth/logout', {}, token).finally(disconnect); else disconnect(); }, [token, disconnect]);
  useEffect(() => {
    if (!token) return;
    void apiGet<{ administrator: { preferences?: Record<string, unknown> } }>('/api/admin/account', token).then(({ administrator }) => {
      document.documentElement.classList.toggle('compact-tables', Boolean(administrator.preferences?.compactTables));
      document.documentElement.classList.toggle('reduce-motion', Boolean(administrator.preferences?.reducedMotion));
    }).catch(() => undefined);
  }, [token, screen]);
  if (!token) return <Login onConnect={connect} />;
  return <div className="min-h-screen bg-bg text-ink md:flex">
    <aside className="border-b border-line bg-bg-2 p-5 md:fixed md:inset-y-0 md:w-60 md:border-b-0 md:border-r"><div className="mb-8 flex items-baseline gap-2"><Wordmark /><span className="eyebrow">Admin</span></div><nav className="space-y-1">{NAV.map((item) => <div key={item.id}>{item.group && <p className="eyebrow mb-2 mt-5 px-3">{item.group}</p>}<button onClick={() => setScreen(item.id)} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${screen === item.id ? 'bg-saffron text-bg' : 'text-ink-2 hover:bg-bg-3 hover:text-ink'}`}>{item.label}</button></div>)}</nav><button onClick={logout} className="mt-8 w-full rounded-xl border border-line px-3 py-2 text-left text-sm text-ink-2">Log out</button></aside>
    <div className="min-w-0 flex-1 md:ml-60"><header className="sticky top-0 z-30 flex gap-3 border-b border-line bg-bg/90 px-5 py-3 backdrop-blur"><GlobalSearch token={token} onAuthError={disconnect} /><Alerts token={token} onAuthError={disconnect} /></header><main className="mx-auto max-w-7xl p-5 md:p-8">
      {screen === 'overview' && <Overview token={token} onAuthError={disconnect} />}{screen === 'live' && <CitiesLive token={token} onAuthError={disconnect} />}{screen === 'journeys' && <JourneysTable token={token} onAuthError={disconnect} />}{screen === 'collection' && <CollectionSessions token={token} onAuthError={disconnect} />}{screen === 'labeling' && <LabelingWorkspace token={token} onAuthError={disconnect} />}{screen === 'research-routes' && <ResearchRoutes token={token} onAuthError={disconnect} />}{screen === 'research-devices' && <ResearchDevices token={token} onAuthError={disconnect} />}{screen === 'devices' && <DevicesTable token={token} onAuthError={disconnect} />}{screen === 'waitlist' && <WaitlistTable token={token} onAuthError={disconnect} />}{screen === 'feedback' && <FeedbackTable token={token} onAuthError={disconnect} />}{screen === 'map' && <MapAnalytics token={token} onAuthError={disconnect} />}{screen === 'contracts' && <Contracts token={token} onAuthError={disconnect} />}{screen === 'account' && <Account token={token} onLogout={disconnect} onAuthError={disconnect} />}
    </main></div>
  </div>;
}
