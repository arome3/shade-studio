import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

import { useChainSignaturesStore } from '../chain-signatures-store';
import type { CrossChainSubmission, DerivedAddress } from '@/types/chain-signatures';

describe('chain-signatures-store', () => {
  beforeEach(() => {
    useChainSignaturesStore.getState().reset();
  });

  // ========================================================================
  // Initial State
  // ========================================================================

  describe('initial state', () => {
    it('should have idle status', () => {
      expect(useChainSignaturesStore.getState().status).toBe('idle');
    });

    it('should have null currentStep', () => {
      expect(useChainSignaturesStore.getState().currentStep).toBeNull();
    });

    it('should have empty submissions', () => {
      expect(useChainSignaturesStore.getState().submissions).toEqual({});
    });

    it('should have empty derivedAddresses', () => {
      expect(useChainSignaturesStore.getState().derivedAddresses).toEqual({});
    });

    it('should default to ethereum chain', () => {
      expect(useChainSignaturesStore.getState().selectedChain).toBe('ethereum');
    });

    it('should have null error', () => {
      expect(useChainSignaturesStore.getState().error).toBeNull();
    });
  });

  // ========================================================================
  // Status Transitions
  // ========================================================================

  describe('status transitions', () => {
    it('should set status to submitting', () => {
      useChainSignaturesStore.getState().setStatus('submitting');
      expect(useChainSignaturesStore.getState().status).toBe('submitting');
    });

    it('should set status to deriving', () => {
      useChainSignaturesStore.getState().setStatus('deriving');
      expect(useChainSignaturesStore.getState().status).toBe('deriving');
    });

    it('should set current step', () => {
      useChainSignaturesStore.getState().setCurrentStep('building-tx');
      expect(useChainSignaturesStore.getState().currentStep).toBe('building-tx');
    });

    it('should clear current step with null', () => {
      useChainSignaturesStore.getState().setCurrentStep('broadcasting');
      useChainSignaturesStore.getState().setCurrentStep(null);
      expect(useChainSignaturesStore.getState().currentStep).toBeNull();
    });

    it('should set error and status', () => {
      const error = new Error('MPC failed');
      useChainSignaturesStore.getState().setError(error);
      expect(useChainSignaturesStore.getState().status).toBe('error');
      expect(useChainSignaturesStore.getState().error).toBe(error);
    });

    it('should clear error and reset to idle', () => {
      useChainSignaturesStore.getState().setError(new Error('test'));
      useChainSignaturesStore.getState().clearError();
      expect(useChainSignaturesStore.getState().error).toBeNull();
      expect(useChainSignaturesStore.getState().status).toBe('idle');
    });
  });

  // ========================================================================
  // Submissions
  // ========================================================================

  describe('submissions', () => {
    const mockSubmission: CrossChainSubmission = {
      id: 'sub-1',
      proposalId: 'prop-1',
      chain: 'ethereum',
      currentStep: 'complete',
      txHash: '0xabc',
      evmAddress: '0x123',
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T00:01:00.000Z',
    };

    it('should add a submission', () => {
      useChainSignaturesStore.getState().addSubmission(mockSubmission);
      expect(
        useChainSignaturesStore.getState().submissions['sub-1']
      ).toEqual(mockSubmission);
    });

    it('should update a submission', () => {
      useChainSignaturesStore.getState().addSubmission(mockSubmission);
      useChainSignaturesStore.getState().updateSubmission('sub-1', {
        currentStep: 'failed',
        error: 'Transaction reverted',
      });

      const updated = useChainSignaturesStore.getState().submissions['sub-1'];
      expect(updated?.currentStep).toBe('failed');
      expect(updated?.error).toBe('Transaction reverted');
      // Should preserve other fields
      expect(updated?.txHash).toBe('0xabc');
    });

    it('should not update nonexistent submission', () => {
      useChainSignaturesStore.getState().updateSubmission('nonexistent', {
        currentStep: 'failed',
      });
      expect(
        useChainSignaturesStore.getState().submissions['nonexistent']
      ).toBeUndefined();
    });
  });

  // ========================================================================
  // Derived Addresses
  // ========================================================================

  describe('derived addresses', () => {
    const mockDerived: DerivedAddress = {
      nearAccountId: 'alice.testnet',
      chain: 'ethereum',
      evmAddress: '0x1234567890123456789012345678901234567890',
      derivedAt: '2025-01-01T00:00:00.000Z',
    };

    it('should set a derived address', () => {
      useChainSignaturesStore
        .getState()
        .setDerivedAddress('alice.testnet:ethereum', mockDerived);

      expect(
        useChainSignaturesStore.getState().derivedAddresses['alice.testnet:ethereum']
      ).toEqual(mockDerived);
    });

    it('should not overwrite other derived addresses', () => {
      const otherDerived: DerivedAddress = {
        ...mockDerived,
        chain: 'optimism',
        evmAddress: '0xaaaa',
      };

      useChainSignaturesStore
        .getState()
        .setDerivedAddress('alice.testnet:ethereum', mockDerived);
      useChainSignaturesStore
        .getState()
        .setDerivedAddress('alice.testnet:optimism', otherDerived);

      expect(
        useChainSignaturesStore.getState().derivedAddresses['alice.testnet:ethereum']
      ).toEqual(mockDerived);
      expect(
        useChainSignaturesStore.getState().derivedAddresses['alice.testnet:optimism']
      ).toEqual(otherDerived);
    });
  });

  // ========================================================================
  // Chain Selection
  // ========================================================================

  describe('chain selection', () => {
    it('should set selected chain', () => {
      useChainSignaturesStore.getState().setSelectedChain('optimism');
      expect(useChainSignaturesStore.getState().selectedChain).toBe('optimism');
    });
  });

  // ========================================================================
  // Reset
  // ========================================================================

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useChainSignaturesStore.getState().setStatus('submitting');
      useChainSignaturesStore.getState().setCurrentStep('broadcasting');
      useChainSignaturesStore.getState().setSelectedChain('base');
      useChainSignaturesStore.getState().addSubmission({
        id: 'sub-1',
        proposalId: 'prop-1',
        chain: 'ethereum',
        currentStep: 'complete',
        startedAt: '2025-01-01T00:00:00.000Z',
      });

      useChainSignaturesStore.getState().reset();

      const state = useChainSignaturesStore.getState();
      expect(state.status).toBe('idle');
      expect(state.currentStep).toBeNull();
      expect(state.submissions).toEqual({});
      expect(state.derivedAddresses).toEqual({});
      expect(state.selectedChain).toBe('ethereum');
      expect(state.error).toBeNull();
    });
  });
});
