import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

const mockDeriveEVMAddress = vi.fn();
const mockRequestMPCSignature = vi.fn();
const mockParseMPCSignatureFromOutcome = vi.fn();

vi.mock('../mpc-client', () => ({
  deriveEVMAddress: (...args: unknown[]) => mockDeriveEVMAddress(...args),
  requestMPCSignature: (...args: unknown[]) => mockRequestMPCSignature(...args),
  parseMPCSignatureFromOutcome: (...args: unknown[]) =>
    mockParseMPCSignatureFromOutcome(...args),
}));

const mockBuildUnsignedTx = vi.fn();
const mockSerializeForSigning = vi.fn();
const mockAssembleSignedTx = vi.fn();
const mockBroadcastTransaction = vi.fn();
const mockWaitForConfirmation = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockEvictProvider = vi.fn();

vi.mock('../evm-tx-builder', () => ({
  buildUnsignedTx: (...args: unknown[]) => mockBuildUnsignedTx(...args),
  serializeForSigning: (...args: unknown[]) => mockSerializeForSigning(...args),
  assembleSignedTx: (...args: unknown[]) => mockAssembleSignedTx(...args),
  broadcastTransaction: (...args: unknown[]) => mockBroadcastTransaction(...args),
  waitForConfirmation: (...args: unknown[]) => mockWaitForConfirmation(...args),
  simulateTransaction: (...args: unknown[]) => mockSimulateTransaction(...args),
  evictProvider: (...args: unknown[]) => mockEvictProvider(...args),
  encodeFunctionCall: vi.fn().mockReturnValue('0xabcdef'),
}));

import {
  submitCrossChain,
  submitToGitcoin,
  submitToOptimismRPGF,
} from '../cross-chain-submit';
import type { CrossChainSubmitParams, SubmissionStep } from '@/types/chain-signatures';

// ============================================================================
// Test Setup
// ============================================================================

const mockWalletSelector = {
  wallet: vi.fn().mockResolvedValue({
    signAndSendTransaction: vi.fn(),
  }),
} as any;

const defaultParams: CrossChainSubmitParams = {
  proposalId: 'prop-1',
  chain: 'ethereum',
  contractAddress: '0x1234567890123456789012345678901234567890',
  calldata: '0xdeadbeef',
};

const mockUnsignedTx = {
  to: '0x1234567890123456789012345678901234567890',
  value: '0',
  data: '0xdeadbeef',
  nonce: 5,
  maxFeePerGas: '30000000000',
  maxPriorityFeePerGas: '1500000000',
  gasLimit: '25200',
  chainId: 1,
  type: 2 as const,
};

const mockMPCSignature = {
  big_r: { affine_point: '02abc123' },
  s: { scalar: 'def456' },
  recovery_id: 0,
};

function setupHappyPath() {
  mockDeriveEVMAddress.mockResolvedValue('0xDerivedAddress');
  mockBuildUnsignedTx.mockResolvedValue(mockUnsignedTx);
  mockSimulateTransaction.mockResolvedValue(undefined);
  mockSerializeForSigning.mockReturnValue(new Uint8Array(32).fill(0xaa));
  mockRequestMPCSignature.mockResolvedValue({ status: {} });
  mockParseMPCSignatureFromOutcome.mockReturnValue(mockMPCSignature);
  mockAssembleSignedTx.mockReturnValue('0xsignedtx');
  mockBroadcastTransaction.mockResolvedValue({ hash: '0xtxhash' });
  mockWaitForConfirmation.mockResolvedValue({ status: 1 });
}

describe('cross-chain-submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Happy Path
  // ========================================================================

  describe('submitCrossChain — happy path', () => {
    it('should complete all steps and return success', async () => {
      setupHappyPath();

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('complete');
      expect(result.txHash).toBe('0xtxhash');
      expect(result.evmAddress).toBe('0xDerivedAddress');
      expect(result.error).toBeUndefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should call onProgress with each step in order', async () => {
      setupHappyPath();

      const steps: SubmissionStep[] = [];
      const onProgress = (step: SubmissionStep) => steps.push(step);

      await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector,
        onProgress
      );

      expect(steps).toEqual([
        'deriving-address',
        'building-tx',
        'simulating',
        'requesting-signature',
        'assembling-tx',
        'broadcasting',
        'confirming',
        'complete',
      ]);
    });
  });

  // ========================================================================
  // Failure at Each Step
  // ========================================================================

  describe('submitCrossChain — failure tracking', () => {
    it('should set failedAtStep when address derivation fails', async () => {
      mockDeriveEVMAddress.mockRejectedValue(new Error('RPC error'));

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('failed');
      expect(result.failedAtStep).toBe('deriving-address');
      expect(result.error).toBe('RPC error');
    });

    it('should set failedAtStep when tx building fails', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xaddr');
      mockBuildUnsignedTx.mockRejectedValue(new Error('No EIP-1559'));

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('failed');
      expect(result.failedAtStep).toBe('building-tx');
      expect(result.error).toBe('No EIP-1559');
    });

    it('should set failedAtStep when simulation fails', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xaddr');
      mockBuildUnsignedTx.mockResolvedValue(mockUnsignedTx);
      mockSimulateTransaction.mockRejectedValue(
        new Error('Transaction simulation failed: execution reverted')
      );

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('failed');
      expect(result.failedAtStep).toBe('simulating');
      // Should NOT have called requestMPCSignature
      expect(mockRequestMPCSignature).not.toHaveBeenCalled();
    });

    it('should set failedAtStep when MPC signature request fails', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xaddr');
      mockBuildUnsignedTx.mockResolvedValue(mockUnsignedTx);
      mockSimulateTransaction.mockResolvedValue(undefined);
      mockSerializeForSigning.mockReturnValue(new Uint8Array(32));
      mockRequestMPCSignature.mockRejectedValue(new Error('User rejected'));

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('failed');
      expect(result.failedAtStep).toBe('requesting-signature');
    });

    it('should set failedAtStep when broadcasting fails (after retry)', async () => {
      mockDeriveEVMAddress.mockResolvedValue('0xaddr');
      mockBuildUnsignedTx.mockResolvedValue(mockUnsignedTx);
      mockSimulateTransaction.mockResolvedValue(undefined);
      mockSerializeForSigning.mockReturnValue(new Uint8Array(32));
      mockRequestMPCSignature.mockResolvedValue({ status: {} });
      mockParseMPCSignatureFromOutcome.mockReturnValue(mockMPCSignature);
      mockAssembleSignedTx.mockReturnValue('0xsigned');
      // Both broadcast attempts fail
      mockBroadcastTransaction.mockRejectedValue(new Error('Network error'));

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('failed');
      expect(result.failedAtStep).toBe('broadcasting');
      // Should have evicted the provider on first failure
      expect(mockEvictProvider).toHaveBeenCalledWith('ethereum');
    });
  });

  // ========================================================================
  // Broadcast retry with eviction
  // ========================================================================

  describe('submitCrossChain — broadcast retry', () => {
    it('should retry broadcast once after evicting provider', async () => {
      setupHappyPath();
      // First broadcast fails, second succeeds
      mockBroadcastTransaction
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ hash: '0xretryhash' });

      const result = await submitCrossChain(
        defaultParams,
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('complete');
      expect(result.txHash).toBe('0xretryhash');
      expect(mockEvictProvider).toHaveBeenCalledWith('ethereum');
      expect(mockBroadcastTransaction).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================================================
  // Gitcoin helper
  // ========================================================================

  describe('submitToGitcoin', () => {
    it('should call submitCrossChain with ethereum chain', async () => {
      setupHappyPath();

      const result = await submitToGitcoin(
        {
          proposalId: 'prop-1',
          poolId: '42',
          metadataCid: 'QmTest123',
          recipientAddress: '0x1234567890123456789012345678901234567890',
        },
        'alice.testnet',
        mockWalletSelector,
        '0xabcdef1234567890abcdef1234567890abcdef12'
      );

      expect(result.currentStep).toBe('complete');
      expect(mockDeriveEVMAddress).toHaveBeenCalledWith('alice.testnet', 'ethereum');
    });
  });

  // ========================================================================
  // RPGF helper
  // ========================================================================

  describe('submitToOptimismRPGF', () => {
    it('should call submitCrossChain with optimism chain', async () => {
      setupHappyPath();

      const result = await submitToOptimismRPGF(
        {
          proposalId: 'prop-1',
          projectName: 'My Project',
          metadataCid: 'QmTest123',
          roundContract: '0xRoundContract',
        },
        'alice.testnet',
        mockWalletSelector
      );

      expect(result.currentStep).toBe('complete');
      expect(mockDeriveEVMAddress).toHaveBeenCalledWith('alice.testnet', 'optimism');
    });
  });
});
