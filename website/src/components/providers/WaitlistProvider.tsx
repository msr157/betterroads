import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import WaitlistModal from '@/components/ui/WaitlistModal';
import { API_URL } from '@/lib/constants';

type WaitlistCtx = {
  open: () => void;
  close: () => void;
  count: number | null;
  setCount: (n: number) => void;
  refresh: () => void;
};

const Ctx = createContext<WaitlistCtx | null>(null);

export function useWaitlist(): WaitlistCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWaitlist must be used within WaitlistProvider');
  return ctx;
}

export default function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/waitlist/count`, { cache: 'no-store' });
      const json = await res.json() as { count?: number };
      if (typeof json.count === 'number') setCount(json.count);
    } catch { /* keep last known count */ }
  }, []);

  // Initial count fetch on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/waitlist/count`, { cache: 'no-store' });
        const json = await res.json() as { count?: number };
        if (active && typeof json.count === 'number') setCount(json.count);
      } catch { /* keep last known count */ }
    })();
    return () => { active = false; };
  }, []);

  const open  = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <Ctx.Provider value={{ open, close, count, setCount, refresh }}>
      {children}
      <WaitlistModal
        isOpen={isOpen}
        onClose={close}
        currentCount={count}
        onJoined={(c) => setCount(c)}
      />
    </Ctx.Provider>
  );
}
