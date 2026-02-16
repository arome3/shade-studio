'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore, type ConnectionStatus } from '@/stores/auth-store';
import {
  initWalletSelector,
  getWalletSelector,
  showWalletModal,
  trackWalletEvent,
  toWalletError,
  WalletNotConnectedError,
  WalletNotInitializedError,
  SigningNotSupportedError,
  type WalletError,
} from '@/lib/near';

/**
 * Signed message result from wallet signing operation.
 */
export interface SignedMessage {
  signature: string;
  publicKey: string;
  accountId: string;
}

/**
 * Return type for the useWallet hook.
 */
export interface UseWalletReturn {
  // State
  status: ConnectionStatus;
  accountId: string | null;
  walletType: string | null;
  error: WalletError | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInitialized: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<SignedMessage>;
}

/**
 * Main wallet hook for NEAR wallet integration.
 * Composes the auth store with the wallet selector singleton.
 *
 * Features:
 * - Auto-reconnect on page load if previously connected
 * - Subscribes to wallet state changes
 * - Provides connect/disconnect/signMessage actions
 *
 * @example
 * function WalletButton() {
 *   const { isConnected, accountId, connect, disconnect } = useWallet();
 *
 *   if (isConnected) {
 *     return <button onClick={disconnect}>{accountId}</button>;
 *   }
 *
 *   return <button onClick={connect}>Connect Wallet</button>;
 * }
 */
export function useWallet(): UseWalletReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttempted = useRef(false);

  // Get state and actions from the auth store
  const status = useAuthStore((state) => state.status);
  const accountId = useAuthStore((state) => state.accountId);
  const walletType = useAuthStore((state) => state.walletType);
  const error = useAuthStore((state) => state.error);

  const setConnecting = useAuthStore((state) => state.setConnecting);
  const setConnected = useAuthStore((state) => state.setConnected);
  const setDisconnected = useAuthStore((state) => state.setDisconnected);
  const setError = useAuthStore((state) => state.setError);

  /**
   * Initialize wallet selector and handle auto-reconnect.
   */
  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initAttempted.current) return;
    initAttempted.current = true;

    let subscription: { unsubscribe: () => void } | null = null;

    async function init() {
      try {
        const selector = await initWalletSelector();
        setIsInitialized(true);

        // Subscribe to wallet state changes
        subscription = selector.store.observable.subscribe((state) => {
          const accounts = state.accounts;

          if (accounts.length > 0 && accounts[0]) {
            const newAccountId = accounts[0].accountId;
            const selectedWallet = state.selectedWalletId;

            // Only update if changed to prevent infinite loops
            if (newAccountId !== accountId || selectedWallet !== walletType) {
              setConnected(newAccountId, selectedWallet ?? 'unknown');
              trackWalletEvent({
                type: 'connect_success',
                accountId: newAccountId,
                walletType: selectedWallet ?? 'unknown',
              });
            }
          } else if (status === 'connected' || status === 'reconnecting') {
            // Account was removed (disconnected)
            setDisconnected();
            trackWalletEvent({ type: 'disconnect' });
          }
        });

        // Check for auto-reconnect scenario
        const storedAccountId = useAuthStore.getState().accountId;
        if (storedAccountId && status === 'reconnecting') {
          // Verify the stored account is still connected in the selector
          const currentState = selector.store.getState();
          const hasAccount = currentState.accounts.some(
            (acc) => acc.accountId === storedAccountId
          );

          if (hasAccount) {
            // Account is still valid, update with current wallet type
            const currentWallet = currentState.selectedWalletId ?? 'unknown';
            setConnected(storedAccountId, currentWallet);
            trackWalletEvent({
              type: 'reconnect_success',
              accountId: storedAccountId,
              walletType: currentWallet,
            });
          } else {
            // Stored account is no longer connected
            setDisconnected();
            trackWalletEvent({
              type: 'reconnect_error',
              accountId: storedAccountId,
              error: 'Stored account not found in wallet',
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize wallet selector:', err);
        setError(toWalletError(err));
        trackWalletEvent({
          type: 'connect_error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    init();

    return () => {
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  /**
   * Connect wallet by showing the wallet selection modal.
   */
  const connect = useCallback(async () => {
    try {
      setConnecting();
      trackWalletEvent({ type: 'connect_started' });

      // Show the wallet modal - connection is handled by the subscription
      await showWalletModal();
    } catch (err) {
      const walletError = toWalletError(err);
      setError(walletError);
      trackWalletEvent({
        type: 'connect_error',
        error: walletError.message,
      });
      throw walletError;
    }
  }, [setConnecting, setError]);

  /**
   * Disconnect the current wallet.
   */
  const disconnect = useCallback(async () => {
    const selector = getWalletSelector();
    if (!selector) {
      throw new WalletNotInitializedError();
    }

    try {
      const wallet = await selector.wallet();
      await wallet.signOut();

      setDisconnected();
      trackWalletEvent({
        type: 'disconnect',
        accountId: accountId ?? undefined,
        walletType: walletType ?? undefined,
      });
    } catch (err) {
      const walletError = toWalletError(err);
      setError(walletError);
      throw walletError;
    }
  }, [accountId, walletType, setDisconnected, setError]);

  /**
   * Sign a message with the connected wallet.
   * @param message - The message to sign
   * @returns The signed message with signature, public key, and account ID
   */
  const signMessage = useCallback(
    async (message: string): Promise<SignedMessage> => {
      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      if (status !== 'connected' || !accountId) {
        throw new WalletNotConnectedError();
      }

      try {
        trackWalletEvent({
          type: 'sign_started',
          accountId,
          walletType: walletType ?? undefined,
        });

        const wallet = await selector.wallet();

        // Check if wallet supports signing
        if (!wallet.signMessage) {
          throw new SigningNotSupportedError();
        }

        const signedMessage = await wallet.signMessage({
          message,
          recipient: accountId,
          nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
        });

        if (!signedMessage) {
          // Redirect-based wallets (MyNearWallet) return null because
          // the actual signing happens on the external site after a
          // full-page redirect. The result comes back as URL hash params
          // when the wallet redirects back. This is not an error — just
          // a pending operation that will complete after redirect.
          trackWalletEvent({
            type: 'sign_started',
            accountId,
            walletType: walletType ?? undefined,
            metadata: { redirect: true },
          });

          // Return a never-resolving promise so the caller doesn't see
          // an error while the browser is navigating away.
          return new Promise<SignedMessage>(() => {});
        }

        trackWalletEvent({
          type: 'sign_success',
          accountId,
          walletType: walletType ?? undefined,
        });

        return {
          signature: Buffer.from(signedMessage.signature).toString('base64'),
          publicKey: signedMessage.publicKey,
          accountId: signedMessage.accountId,
        };
      } catch (err) {
        const walletError = toWalletError(err);
        trackWalletEvent({
          type: 'sign_error',
          accountId,
          walletType: walletType ?? undefined,
          error: walletError.message,
        });
        throw walletError;
      }
    },
    [status, accountId, walletType]
  );

  return {
    // State
    status,
    accountId,
    walletType,
    error,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting' || status === 'reconnecting',
    isInitialized,

    // Actions
    connect,
    disconnect,
    signMessage,
  };
}
