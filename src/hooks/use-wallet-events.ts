'use client';

import { useEffect, useRef } from 'react';
import { getWalletSelector, trackWalletEvent } from '@/lib/near';

/**
 * Account object from wallet selector.
 */
export interface Account {
  accountId: string;
}

/**
 * Event handlers for wallet state changes.
 */
export interface WalletEventHandlers {
  /** Called when accounts change (connect/disconnect/switch) */
  onAccountChange?: (accounts: Account[]) => void;
  /** Called when the network changes */
  onNetworkChange?: (networkId: string) => void;
  /** Called when the selected wallet changes */
  onWalletChange?: (walletId: string | null) => void;
}

/**
 * Hook for subscribing to wallet selector events.
 * Use this for fine-grained control over wallet state changes.
 *
 * @example
 * useWalletEvents({
 *   onAccountChange: (accounts) => {
 *     if (accounts.length === 0) {
 *       // Handle disconnect
 *       router.push('/');
 *     }
 *   },
 *   onNetworkChange: (networkId) => {
 *     // Handle network switch
 *     console.log('Network changed to:', networkId);
 *   },
 * });
 */
export function useWalletEvents(handlers: WalletEventHandlers): void {
  // Use ref to avoid re-subscribing when handlers change
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track previous state to detect changes
  const prevStateRef = useRef<{
    accounts: Account[];
    networkId: string | null;
    selectedWalletId: string | null;
  }>({
    accounts: [],
    networkId: null,
    selectedWalletId: null,
  });

  useEffect(() => {
    const selector = getWalletSelector();
    if (!selector) {
      // Selector not yet initialized, will be handled by useWallet
      return;
    }

    const subscription = selector.store.observable.subscribe((state) => {
      const prevState = prevStateRef.current;
      const { onAccountChange, onNetworkChange, onWalletChange } = handlersRef.current;

      // Check for account changes
      if (onAccountChange) {
        const prevAccountIds = prevState.accounts.map((a) => a.accountId).join(',');
        const newAccountIds = state.accounts.map((a) => a.accountId).join(',');

        if (prevAccountIds !== newAccountIds) {
          trackWalletEvent({
            type: state.accounts.length > 0 ? 'connect_success' : 'disconnect',
            accountId: state.accounts[0]?.accountId,
          });
          onAccountChange(state.accounts);
        }
      }

      // Check for network changes
      if (onNetworkChange) {
        // Note: The wallet selector type doesn't expose network changes directly
        // This is a placeholder for when/if that feature is added
        // For now, network changes require a page reload
      }

      // Check for wallet changes
      if (onWalletChange) {
        if (prevState.selectedWalletId !== state.selectedWalletId) {
          trackWalletEvent({
            type: 'wallet_selected',
            walletType: state.selectedWalletId ?? undefined,
          });
          onWalletChange(state.selectedWalletId);
        }
      }

      // Update previous state
      prevStateRef.current = {
        accounts: [...state.accounts],
        networkId: null, // Not exposed by wallet selector
        selectedWalletId: state.selectedWalletId,
      };
    });

    // Initialize previous state
    const initialState = selector.store.getState();
    prevStateRef.current = {
      accounts: [...initialState.accounts],
      networkId: null,
      selectedWalletId: initialState.selectedWalletId,
    };

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Only subscribe once
}

/**
 * Hook to detect when the user disconnects from the wallet.
 * Useful for triggering navigation or cleanup on disconnect.
 *
 * @param onDisconnect - Callback fired when user disconnects
 *
 * @example
 * useOnWalletDisconnect(() => {
 *   router.push('/');
 * });
 */
export function useOnWalletDisconnect(onDisconnect: () => void): void {
  const wasConnectedRef = useRef(false);

  useWalletEvents({
    onAccountChange: (accounts) => {
      if (wasConnectedRef.current && accounts.length === 0) {
        onDisconnect();
      }
      wasConnectedRef.current = accounts.length > 0;
    },
  });
}
