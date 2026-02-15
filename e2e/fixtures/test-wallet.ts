/**
 * Wallet injection helper for Playwright E2E tests.
 *
 * Uses page.addInitScript() to inject mock wallet state
 * before application code runs, simulating a connected wallet.
 */

import { type Page } from '@playwright/test';

export interface MockWalletConfig {
  accountId: string;
  isConnected: boolean;
}

const DEFAULT_CONFIG: MockWalletConfig = {
  accountId: 'e2e-tester.near',
  isConnected: true,
};

/**
 * Inject mock wallet state into the page.
 * Must be called BEFORE page.goto().
 */
export async function injectMockWallet(page: Page, config: Partial<MockWalletConfig> = {}) {
  const walletConfig = { ...DEFAULT_CONFIG, ...config };

  await page.addInitScript((cfg) => {
    // Expose mock wallet on window for the app to detect
    (window as unknown as Record<string, unknown>).__MOCK_WALLET__ = {
      accountId: cfg.accountId,
      isConnected: cfg.isConnected,
    };

    // Set localStorage keys that the wallet selector checks
    if (cfg.isConnected) {
      localStorage.setItem(
        'near-wallet-connection',
        JSON.stringify({
          accountId: cfg.accountId,
          walletType: 'my-near-wallet',
          connectedAt: Date.now(),
        })
      );
    }
  }, walletConfig);
}

/**
 * Inject a disconnected wallet state (for testing wallet guards).
 */
export async function injectDisconnectedWallet(page: Page) {
  await injectMockWallet(page, { isConnected: false, accountId: '' });
}
