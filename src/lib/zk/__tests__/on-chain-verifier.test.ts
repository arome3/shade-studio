/**
 * Tests for on-chain-verifier.ts
 *
 * Mocks the NEAR wallet selector and wallet to test:
 * - Happy path (verification succeeds)
 * - User rejection
 * - Contract failure
 * - Custom contract ID
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/config', () => ({
  config: {
    zk: {
      verifierContractId: 'zk-verifier.testnet',
    },
  },
}));

import { verifyProofOnChain } from '../on-chain-verifier';
import type { ZKProof } from '@/types/zk';
import type { WalletSelector } from '@near-wallet-selector/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProof: ZKProof = {
  id: 'proof-1',
  circuit: 'verified-builder',
  proof: {
    pi_a: ['1', '2', '3'],
    pi_b: [['4', '5'], ['6', '7']],
    pi_c: ['8', '9', '10'],
    protocol: 'groth16',
    curve: 'bn128',
  },
  publicSignals: ['100', '200'],
  status: 'verified',
  generatedAt: new Date().toISOString(),
};

function createMockWalletSelector(
  signResult?: unknown,
  signError?: Error
): WalletSelector {
  const mockWallet = {
    signAndSendTransaction: signError
      ? vi.fn().mockRejectedValue(signError)
      : vi.fn().mockResolvedValue(
          signResult ?? {
            status: { SuccessValue: btoa('true') },
            transaction_outcome: { id: 'tx-hash-123' },
          }
        ),
  };

  return {
    wallet: vi.fn().mockResolvedValue(mockWallet),
  } as unknown as WalletSelector;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyProofOnChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid result on successful verification', async () => {
    const selector = createMockWalletSelector();

    const result = await verifyProofOnChain(mockProof, selector);

    expect(result.isValid).toBe(true);
    expect(result.method).toBe('on-chain');
    expect(result.transactionHash).toBe('tx-hash-123');
    expect(result.error).toBeUndefined();
  });

  it('should return invalid when contract returns false', async () => {
    const selector = createMockWalletSelector({
      status: { SuccessValue: btoa('false') },
      transaction_outcome: { id: 'tx-hash-456' },
    });

    const result = await verifyProofOnChain(mockProof, selector);

    expect(result.isValid).toBe(false);
    expect(result.transactionHash).toBe('tx-hash-456');
  });

  it('should handle user rejection gracefully', async () => {
    const selector = createMockWalletSelector(
      undefined,
      new Error('User rejected the request')
    );

    const result = await verifyProofOnChain(mockProof, selector);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('should handle wallet not connected', async () => {
    const selector = createMockWalletSelector(
      undefined,
      new Error('No wallet connected')
    );

    const result = await verifyProofOnChain(mockProof, selector);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Wallet not connected');
  });

  it('should throw OnChainVerificationError on contract failure', async () => {
    const selector = createMockWalletSelector(
      undefined,
      new Error('Contract execution failed: method not found')
    );

    await expect(
      verifyProofOnChain(mockProof, selector)
    ).rejects.toThrow('On-chain proof verification failed');
  });

  it('should use custom contract ID when provided', async () => {
    const selector = createMockWalletSelector();

    await verifyProofOnChain(mockProof, selector, {
      contractId: 'my-verifier.near',
    });

    const wallet = await (selector as unknown as { wallet: () => Promise<{ signAndSendTransaction: ReturnType<typeof vi.fn> }> }).wallet();
    const callArgs = wallet.signAndSendTransaction.mock.calls[0]![0];
    expect(callArgs.receiverId).toBe('my-verifier.near');
  });

  it('should send correct proof structure to contract', async () => {
    const selector = createMockWalletSelector();

    await verifyProofOnChain(mockProof, selector);

    const wallet = await (selector as unknown as { wallet: () => Promise<{ signAndSendTransaction: ReturnType<typeof vi.fn> }> }).wallet();
    const callArgs = wallet.signAndSendTransaction.mock.calls[0]![0];

    expect(callArgs.receiverId).toBe('zk-verifier.testnet');
    expect(callArgs.actions).toHaveLength(1);
    expect(callArgs.actions[0].type).toBe('FunctionCall');
    expect(callArgs.actions[0].params.methodName).toBe('verify_proof');
  });

  it('should handle failure status in outcome', async () => {
    const selector = createMockWalletSelector({
      status: { Failure: { error: 'contract panic' } },
      transaction_outcome: { id: 'tx-hash-789' },
    });

    const result = await verifyProofOnChain(mockProof, selector);

    expect(result.isValid).toBe(false);
  });
});
