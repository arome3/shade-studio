/**
 * Wallet mock factory for tests.
 *
 * Returns a shape matching the useWallet() hook return type,
 * with sensible defaults for a connected testnet wallet.
 */

import { vi } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

export interface MockWalletOptions {
  isConnected?: boolean;
  accountId?: string | null;
  walletType?: string;
}

export function createMockWallet(options: MockWalletOptions = {}) {
  const {
    isConnected = true,
    accountId = 'test.near',
    walletType = 'my-near-wallet',
  } = options;

  return {
    status: isConnected ? ('connected' as const) : ('disconnected' as const),
    accountId: isConnected ? accountId : null,
    walletType: isConnected ? walletType : null,
    isConnected,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    signMessage: vi.fn().mockImplementation(() => {
      const signature = nacl.randomBytes(64);
      const publicKey = nacl.randomBytes(32);
      return Promise.resolve({
        signature: encodeBase64(signature),
        publicKey: encodeBase64(publicKey),
        accountId: accountId ?? 'test.near',
      });
    }),
  };
}

/**
 * Create a disconnected wallet mock — useful for testing wallet guards.
 */
export function createDisconnectedWallet() {
  return createMockWallet({ isConnected: false, accountId: null });
}
