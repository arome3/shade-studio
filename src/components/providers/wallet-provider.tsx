'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { initWalletSelector, trackWalletEvent } from '@/lib/near';

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Provider component that initializes the NEAR wallet selector.
 * Should be placed high in the component tree to ensure wallet
 * is available throughout the app.
 *
 * This provider:
 * - Initializes the wallet selector singleton on mount
 * - Does not block rendering while initializing
 * - Logs initialization status in development
 *
 * @example
 * // In providers.tsx
 * <WalletProvider>
 *   {children}
 * </WalletProvider>
 */
export function WalletProvider({ children }: WalletProviderProps) {
  const initAttempted = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initAttempted.current) return;
    initAttempted.current = true;

    async function init() {
      try {
        await initWalletSelector();

        if (process.env.NODE_ENV === 'development') {
          console.debug('[WalletProvider] Wallet selector initialized');
        }
      } catch (error) {
        // Log but don't throw - app should still work without wallet
        console.error('[WalletProvider] Failed to initialize wallet selector:', error);
        trackWalletEvent({
          type: 'connect_error',
          error: error instanceof Error ? error.message : 'Initialization failed',
        });
      }
    }

    init();
  }, []);

  // Always render children - wallet initialization is non-blocking
  return <>{children}</>;
}
