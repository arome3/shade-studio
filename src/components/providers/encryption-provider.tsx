'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useEncryption } from '@/hooks/use-encryption';

interface EncryptionProviderProps {
  children: ReactNode;
  /**
   * Whether to automatically initialize encryption when wallet connects.
   * When true, user will be prompted to sign the key derivation message.
   * @default true
   */
  autoInitialize?: boolean;
}

/**
 * Provider component that manages encryption lifecycle.
 *
 * This provider:
 * - Automatically initializes encryption when wallet connects (if autoInitialize=true)
 * - Locks encryption when wallet disconnects
 * - Re-initializes if user switches accounts
 *
 * Note: Does not block rendering - encryption initializes in background.
 * Components should check `useEncryption().isReady` before encrypting.
 *
 * @example
 * // In providers.tsx
 * <WalletProvider>
 *   <EncryptionProvider>
 *     {children}
 *   </EncryptionProvider>
 * </WalletProvider>
 *
 * @example
 * // Disable auto-init (user must manually call initialize)
 * <EncryptionProvider autoInitialize={false}>
 *   {children}
 * </EncryptionProvider>
 */
export function EncryptionProvider({
  children,
  autoInitialize = true,
}: EncryptionProviderProps) {
  const { isConnected, accountId } = useWallet();
  const { status, initialize, lock } = useEncryption();

  // Track previous account to detect changes
  const previousAccountIdRef = useRef<string | null>(null);
  // Track if we've attempted initialization this session
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    const previousAccountId = previousAccountIdRef.current;

    // Case 1: Wallet connected and we should auto-initialize
    if (isConnected && accountId && autoInitialize) {
      // Check if this is a new account or we haven't initialized yet
      const isNewAccount = previousAccountId !== accountId;
      const needsInit = status === 'uninitialized' || status === 'locked';
      const shouldInit = (isNewAccount || needsInit) && !initAttemptedRef.current;

      if (shouldInit) {
        initAttemptedRef.current = true;

        initialize()
          .then(() => {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[EncryptionProvider] Auto-initialized for', accountId);
            }
          })
          .catch((error) => {
            // Don't throw - let components handle via useEncryption().error
            if (process.env.NODE_ENV === 'development') {
              console.warn('[EncryptionProvider] Auto-init failed:', error.message);
            }
          });
      }
    }

    // Case 2: Wallet disconnected - lock encryption
    if (!isConnected && previousAccountId !== null) {
      lock();
      initAttemptedRef.current = false;

      if (process.env.NODE_ENV === 'development') {
        console.debug('[EncryptionProvider] Locked due to wallet disconnect');
      }
    }

    // Case 3: Account changed - lock and re-initialize
    if (isConnected && accountId && previousAccountId !== null && previousAccountId !== accountId) {
      // First lock the old keys
      lock();
      initAttemptedRef.current = false;

      if (autoInitialize) {
        // Then initialize for new account
        initAttemptedRef.current = true;

        initialize()
          .then(() => {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[EncryptionProvider] Re-initialized for new account', accountId);
            }
          })
          .catch((error) => {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[EncryptionProvider] Re-init failed:', error.message);
            }
          });
      }
    }

    // Update ref for next render
    previousAccountIdRef.current = accountId;
  }, [isConnected, accountId, autoInitialize, status, initialize, lock]);

  // Reset init attempt when status changes to allow retry
  useEffect(() => {
    if (status === 'error') {
      initAttemptedRef.current = false;
    }
  }, [status]);

  // Always render children - initialization is non-blocking
  return <>{children}</>;
}
