/**
 * NEAR Wallet Selector singleton module.
 * Manages the wallet selector instance and modal UI.
 */

// Import wallet selector modal styles
import '@near-wallet-selector/modal-ui/styles.css';

import { setupWalletSelector, type WalletSelector, type WalletModuleFactory } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';

import { config } from '@/lib/config';
import { getNetworkConfig } from './config';
import { trackWalletEvent } from './analytics';

/**
 * Singleton instances.
 * These should only be accessed through the getter functions.
 */
let walletSelectorInstance: WalletSelector | null = null;
let walletModalInstance: WalletSelectorModal | null = null;
let initializationPromise: Promise<WalletSelector> | null = null;

/**
 * Initialize the NEAR wallet selector.
 * Uses singleton pattern - subsequent calls return the same instance.
 * Safe to call multiple times (idempotent).
 *
 * @returns Promise resolving to the wallet selector instance
 */
export async function initWalletSelector(): Promise<WalletSelector> {
  // Return existing instance if already initialized
  if (walletSelectorInstance) {
    return walletSelectorInstance;
  }

  // Return pending promise if initialization is in progress
  // This prevents race conditions from multiple mount calls
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      const networkConfig = getNetworkConfig();

      walletSelectorInstance = await setupWalletSelector({
        network: networkConfig.networkId,
        modules: [
          setupMeteorWallet() as unknown as WalletModuleFactory,
          setupMyNearWallet(),
          setupHereWallet(),
        ],
      });

      // Set up the modal UI
      walletModalInstance = setupModal(walletSelectorInstance, {
        contractId: config.near.contractId,
        theme: 'dark',
      });

      // Track successful initialization
      trackWalletEvent({
        type: 'connect_started',
        metadata: { network: networkConfig.networkId },
      });

      return walletSelectorInstance;
    } catch (error) {
      // Reset on failure so next attempt can try again
      initializationPromise = null;
      walletSelectorInstance = null;
      walletModalInstance = null;

      trackWalletEvent({
        type: 'connect_error',
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      });

      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get the wallet selector instance.
 * Returns null if not yet initialized.
 *
 * @returns The wallet selector instance or null
 */
export function getWalletSelector(): WalletSelector | null {
  return walletSelectorInstance;
}

/**
 * Get the wallet modal instance.
 * Returns null if not yet initialized.
 *
 * @returns The wallet modal instance or null
 */
export function getWalletModal(): WalletSelectorModal | null {
  return walletModalInstance;
}

/**
 * Check if the wallet selector is initialized.
 *
 * @returns true if the wallet selector is ready
 */
export function isWalletInitialized(): boolean {
  return walletSelectorInstance !== null;
}

/**
 * Reset the wallet selector instance.
 * Primarily used for testing purposes.
 *
 * WARNING: This will disconnect any active wallet connections.
 * Only use in test environments.
 */
export function resetWalletSelector(): void {
  if (walletModalInstance) {
    // Modal doesn't have a destroy method, but we can hide it
    walletModalInstance.hide();
  }

  walletSelectorInstance = null;
  walletModalInstance = null;
  initializationPromise = null;
}

/**
 * Get the currently connected accounts.
 * Returns empty array if not initialized or not connected.
 *
 * @returns Array of connected account objects
 */
export function getConnectedAccounts(): Array<{ accountId: string }> {
  if (!walletSelectorInstance) {
    return [];
  }

  const state = walletSelectorInstance.store.getState();
  return state.accounts;
}

/**
 * Get the currently active account ID.
 * Returns null if not connected.
 *
 * @returns The active account ID or null
 */
export function getActiveAccountId(): string | null {
  const accounts = getConnectedAccounts();
  const firstAccount = accounts[0];
  return firstAccount ? firstAccount.accountId : null;
}

/**
 * Show the wallet connection modal.
 * Initializes the selector if not already done.
 */
export async function showWalletModal(): Promise<void> {
  await initWalletSelector();

  if (walletModalInstance) {
    trackWalletEvent({ type: 'modal_opened' });
    walletModalInstance.show();
  }
}

/**
 * Hide the wallet connection modal.
 */
export function hideWalletModal(): void {
  if (walletModalInstance) {
    trackWalletEvent({ type: 'modal_closed' });
    walletModalInstance.hide();
  }
}
