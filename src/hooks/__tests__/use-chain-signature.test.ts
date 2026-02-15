import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

let mockIsConnected = true;
let mockAccountId: string | null = 'alice.testnet';

vi.mock('../use-wallet', () => ({
  useWallet: () => ({
    isConnected: mockIsConnected,
    accountId: mockAccountId,
  }),
}));

const mockDeriveEVMAddress = vi.fn();
vi.mock('@/lib/chain-signatures/mpc-client', () => ({
  deriveEVMAddress: (...args: unknown[]) => mockDeriveEVMAddress(...args),
}));

const mockSubmitCrossChain = vi.fn();
vi.mock('@/lib/chain-signatures/cross-chain-submit', () => ({
  submitCrossChain: (...args: unknown[]) => mockSubmitCrossChain(...args),
}));

const mockGetWalletSelector = vi.fn();
vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: () => mockGetWalletSelector(),
}));

vi.mock('@/lib/near/errors', () => ({
  WalletNotConnectedError: class extends Error {
    constructor() {
      super('Wallet is not connected.');
      this.name = 'WalletNotConnectedError';
    }
  },
  WalletNotInitializedError: class extends Error {
    constructor() {
      super('Wallet selector is initializing.');
      this.name = 'WalletNotInitializedError';
    }
  },
}));

import { useChainSignature } from '../use-chain-signature';
import { useChainSignaturesStore } from '@/stores/chain-signatures-store';

describe('useChainSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChainSignaturesStore.getState().reset();
    mockIsConnected = true;
    mockAccountId = 'alice.testnet';
    mockGetWalletSelector.mockReturnValue({ wallet: vi.fn() });
  });

  // ========================================================================
  // Initial State
  // ========================================================================

  describe('initial state', () => {
    it('should return idle status', () => {
      const { result } = renderHook(() => useChainSignature());
      expect(result.current.status).toBe('idle');
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.currentStep).toBeNull();
    });

    it('should default to ethereum chain', () => {
      const { result } = renderHook(() => useChainSignature());
      expect(result.current.selectedChain).toBe('ethereum');
    });

    it('should have empty submissions', () => {
      const { result } = renderHook(() => useChainSignature());
      expect(result.current.submissions).toEqual([]);
    });
  });

  // ========================================================================
  // Guard: Wallet Not Connected
  // ========================================================================

  describe('wallet guard', () => {
    it('should throw WalletNotConnectedError on deriveAddress', async () => {
      mockIsConnected = false;
      mockAccountId = null;

      const { result } = renderHook(() => useChainSignature());

      await expect(
        act(() => result.current.deriveAddress())
      ).rejects.toThrow('Wallet is not connected.');
    });

    it('should throw WalletNotConnectedError on submitCrossChain', async () => {
      mockIsConnected = false;
      mockAccountId = null;

      const { result } = renderHook(() => useChainSignature());

      await expect(
        act(() =>
          result.current.submitCrossChain({
            proposalId: 'prop-1',
            chain: 'ethereum',
            contractAddress: '0x123',
            calldata: '0x',
          })
        )
      ).rejects.toThrow('Wallet is not connected.');
    });
  });

  // ========================================================================
  // Address Derivation
  // ========================================================================

  describe('deriveAddress', () => {
    it('should derive and cache address', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xDerived123');

      const { result } = renderHook(() => useChainSignature());

      let address: string = '';
      await act(async () => {
        address = await result.current.deriveAddress();
      });

      expect(address).toBe('0xDerived123');
      expect(mockDeriveEVMAddress).toHaveBeenCalledWith(
        'alice.testnet',
        'ethereum'
      );

      // Second call should use cache
      mockDeriveEVMAddress.mockClear();
      await act(async () => {
        address = await result.current.deriveAddress();
      });
      expect(address).toBe('0xDerived123');
      expect(mockDeriveEVMAddress).not.toHaveBeenCalled();
    });

    it('should derive for a specific chain', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xOpAddress');

      const { result } = renderHook(() => useChainSignature());

      await act(async () => {
        await result.current.deriveAddress('optimism');
      });

      expect(mockDeriveEVMAddress).toHaveBeenCalledWith(
        'alice.testnet',
        'optimism'
      );
    });

    it('should set error on failure', async () => {
      mockDeriveEVMAddress.mockRejectedValue(new Error('RPC error'));

      const { result } = renderHook(() => useChainSignature());

      await expect(
        act(() => result.current.deriveAddress())
      ).rejects.toThrow('RPC error');

      // Error is stored in Zustand — check store directly
      expect(useChainSignaturesStore.getState().error?.message).toBe('RPC error');
    });
  });

  // ========================================================================
  // Chain Selection
  // ========================================================================

  describe('selectChain', () => {
    it('should update selected chain', () => {
      const { result } = renderHook(() => useChainSignature());

      act(() => {
        result.current.selectChain('base');
      });

      expect(result.current.selectedChain).toBe('base');
    });
  });

  // ========================================================================
  // Cross-Chain Submit
  // ========================================================================

  describe('submitCrossChain', () => {
    it('should throw when wallet selector not initialized', async () => {
      mockGetWalletSelector.mockReturnValue(null);

      const { result } = renderHook(() => useChainSignature());

      await expect(
        act(() =>
          result.current.submitCrossChain({
            proposalId: 'prop-1',
            chain: 'ethereum',
            contractAddress: '0x123',
            calldata: '0x',
          })
        )
      ).rejects.toThrow('Wallet selector is initializing.');
    });

    it('should submit and store result', async () => {
      const mockResult = {
        id: 'sub-1',
        proposalId: 'prop-1',
        chain: 'ethereum',
        currentStep: 'complete',
        txHash: '0xabc',
        startedAt: '2025-01-01T00:00:00Z',
        completedAt: '2025-01-01T00:01:00Z',
      };
      mockSubmitCrossChain.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useChainSignature());

      let submission: any;
      await act(async () => {
        submission = await result.current.submitCrossChain({
          proposalId: 'prop-1',
          chain: 'ethereum',
          contractAddress: '0x123',
          calldata: '0x',
        });
      });

      expect(submission.currentStep).toBe('complete');
      expect(submission.txHash).toBe('0xabc');
      expect(result.current.submissions).toHaveLength(1);
    });
  });

  // ========================================================================
  // Clear Error
  // ========================================================================

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockDeriveEVMAddress.mockRejectedValue(new Error('test'));
      const { result } = renderHook(() => useChainSignature());

      try {
        await act(() => result.current.deriveAddress());
      } catch {
        // Expected
      }

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
