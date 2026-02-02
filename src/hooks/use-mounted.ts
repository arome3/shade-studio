'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to safely handle hydration mismatches.
 * Returns true only after the component has mounted on the client.
 *
 * Use this to prevent hydration errors when rendering content that
 * differs between server and client (e.g., dates, localStorage values).
 *
 * @example
 * function MyComponent() {
 *   const mounted = useMounted();
 *
 *   if (!mounted) {
 *     return <Skeleton />;
 *   }
 *
 *   return <div>{localStorage.getItem('preference')}</div>;
 * }
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
