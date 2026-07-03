import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/constants';

interface UnveilContextType {
  isUnveiled: boolean | null; // null = still checking
}

const UnveilContext = createContext<UnveilContextType>({ isUnveiled: null });

export function UnveilProvider({ children }: { children: React.ReactNode }) {
  const [isUnveiled, setIsUnveiled] = useState<boolean | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/launch/status`);

    eventSource.addEventListener('unveil', (event) => {
      if (event.data === 'true') {
        setIsUnveiled(true);
      } else if (event.data === 'false') {
        setIsUnveiled(false);
      }
    });

    eventSource.addEventListener('ping', () => {
      // Just keep-alive
    });

    eventSource.onerror = () => {
      // On connection error, if we haven't resolved yet, we could retry or default
      // but EventSource auto-reconnects by default.
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <UnveilContext.Provider value={{ isUnveiled }}>
      {children}
    </UnveilContext.Provider>
  );
}

export function useUnveil() {
  return useContext(UnveilContext);
}
