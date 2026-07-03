import { useEffect, useState } from 'react';

/** Returns false on the server / before first paint, true once mounted. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
