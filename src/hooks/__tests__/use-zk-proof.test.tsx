/**
 * Tests for the useZKProof hook.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZKProof } from '../useZKProof';
import { useProofStore } from '@/stores/proof-store';
import type { ZKProof } from '@/types/zk';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    accountId: 'test.near',
  })),
}));

const mockGenerateProof = vi.fn();
const mockVerifyProofLocally = vi.fn();
const mockExportProofCalldata = vi.fn();
const mockExportProofToJson = vi.fn();
const mockIsProofExpired = vi.fn();
const mockEstimateProofTime = vi.fn();

vi.mock('@/lib/zk/proof-generator', () => ({
  generateProof: (...args: unknown[]) => mockGenerateProof(...args),
  verifyProofLocally: (...args: unknown[]) => mockVerifyProofLocally(...args),
  exportProofCalldata: (...args: unknown[]) => mockExportProofCalldata(...args),
  exportProofToJson: (...args: unknown[]) => mockExportProofToJson(...args),
  isProofExpired: (...args: unknown[]) => mockIsProofExpired(...args),
  estimateProofTime: (...args: unknown[]) => mockEstimateProofTime(...args),
  importProofFromJson: vi.fn(),
}));

vi.mock('@/lib/zk/input-preparation', () => ({
  prepareVerifiedBuilderInputs: vi.fn().mockResolvedValue({
    activityRoot: '123',
    minDays: 10,
    currentTimestamp: 1700000000,
    activityDates: [],
    activityProofSiblings: [],
    activityProofPathIndices: [],
  }),
  prepareGrantTrackRecordInputs: vi.fn().mockResolvedValue({
    grantRoot: '456',
    minGrants: 3,
    programsRoot: '789',
    grantIds: [],
    grantCompletionFlags: [],
    grantProofSiblings: [],
    grantProofPathIndices: [],
    programIds: [],
    programProofSiblings: [],
    programProofPathIndices: [],
  }),
  prepareTeamAttestationInputs: vi.fn().mockResolvedValue({
    attestersRoot: '999',
    minAttestations: 2,
    credentialType: 1,
    attesterPubKeys: [],
    attestationSignatures: [],
    attestationMessages: [],
    attesterProofSiblings: [],
    attesterProofPathIndices: [],
  }),
}));

vi.mock('@/lib/zk/artifacts', () => ({
  loadCircuitArtifacts: vi.fn().mockResolvedValue({
    wasm: new ArrayBuffer(8),
    zkey: new ArrayBuffer(8),
    vkey: {},
  }),
}));

const mockVerifyProofOnChain = vi.fn();
vi.mock('@/lib/zk/on-chain-verifier', () => ({
  verifyProofOnChain: (...args: unknown[]) => mockVerifyProofOnChain(...args),
}));

const mockGenerateCompositeCredential = vi.fn();
vi.mock('@/lib/zk/proof-composition', () => ({
  generateCompositeCredential: (...args: unknown[]) =>
    mockGenerateCompositeCredential(...args),
}));

const mockGetWalletSelector = vi.fn();
vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: () => mockGetWalletSelector(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockProof = (overrides: Partial<ZKProof> = {}): ZKProof => ({
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
  verifiedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useZKProof', () => {
  beforeEach(() => {
    useProofStore.getState().reset();
    vi.clearAllMocks();

    // Default mock implementations
    mockGenerateProof.mockResolvedValue(createMockProof());
    mockVerifyProofLocally.mockResolvedValue({
      isValid: true,
      timestamp: new Date().toISOString(),
      method: 'local',
    });
    mockExportProofCalldata.mockResolvedValue('0xCALLDATA');
    mockExportProofToJson.mockReturnValue('{"id":"proof-1"}');
    mockIsProofExpired.mockReturnValue(false);
    mockEstimateProofTime.mockReturnValue(2000);
    mockGetWalletSelector.mockReturnValue({ wallet: vi.fn() });
  });

  describe('initial state', () => {
    it('should return empty state initially', () => {
      const { result } = renderHook(() => useZKProof());

      expect(result.current.proofs).toEqual([]);
      expect(result.current.currentOperation).toBeNull();
      expect(result.current.isBusy).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('generateVerifiedBuilderProof', () => {
    it('should generate and store a proof', async () => {
      const { result } = renderHook(() => useZKProof());

      await act(async () => {
        await result.current.generateVerifiedBuilderProof({
          activityTimestamps: [1700000000],
          activityProofs: [],
          activityRoot: '123',
          minDays: 10,
          currentTimestamp: 1700000000,
        });
      });

      expect(mockGenerateProof).toHaveBeenCalledWith(
        'verified-builder',
        expect.any(Object),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result.current.proofs).toHaveLength(1);
    });

    it('should set error on failure', async () => {
      mockGenerateProof.mockRejectedValue(new Error('Generation failed'));

      const { result } = renderHook(() => useZKProof());

      let caughtMessage = '';
      await act(async () => {
        try {
          await result.current.generateVerifiedBuilderProof({
            activityTimestamps: [],
            activityProofs: [],
            activityRoot: '123',
            minDays: 10,
            currentTimestamp: 1700000000,
          });
        } catch (err) {
          caughtMessage = err instanceof Error ? err.message : String(err);
        }
      });

      expect(caughtMessage).toBe('Generation failed');
      expect(result.current.error).toBe('Generation failed');
    });
  });

  describe('generateGrantTrackRecordProof', () => {
    it('should generate a grant track record proof', async () => {
      const grantProof = createMockProof({
        id: 'grant-proof',
        circuit: 'grant-track-record',
      });
      mockGenerateProof.mockResolvedValue(grantProof);

      const { result } = renderHook(() => useZKProof());

      await act(async () => {
        await result.current.generateGrantTrackRecordProof({
          grants: [],
          grantRoot: '456',
          programsRoot: '789',
          minGrants: 3,
        });
      });

      expect(mockGenerateProof).toHaveBeenCalledWith(
        'grant-track-record',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('generateTeamAttestationProof', () => {
    it('should generate a team attestation proof', async () => {
      const teamProof = createMockProof({
        id: 'team-proof',
        circuit: 'team-attestation',
      });
      mockGenerateProof.mockResolvedValue(teamProof);

      const { result } = renderHook(() => useZKProof());

      await act(async () => {
        await result.current.generateTeamAttestationProof({
          attestations: [],
          attestersRoot: '999',
          minAttestations: 2,
          credentialType: 1,
        });
      });

      expect(mockGenerateProof).toHaveBeenCalledWith(
        'team-attestation',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('verifyProof', () => {
    it('should verify and update proof status', async () => {
      // Pre-populate store
      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'proof-1', status: 'ready' })
        );
      });

      const { result } = renderHook(() => useZKProof());

      let isValid = false;
      await act(async () => {
        isValid = await result.current.verifyProof('proof-1');
      });

      expect(isValid).toBe(true);
      expect(mockVerifyProofLocally).toHaveBeenCalled();
      expect(useProofStore.getState().proofs['proof-1']?.status).toBe(
        'verified'
      );
    });

    it('should return false for non-existent proof', async () => {
      const { result } = renderHook(() => useZKProof());

      let isValid = true;
      await act(async () => {
        isValid = await result.current.verifyProof('non-existent');
      });

      expect(isValid).toBe(false);
    });
  });

  describe('verifyOnChain', () => {
    it('should verify on-chain and update proof status', async () => {
      mockVerifyProofOnChain.mockResolvedValue({
        isValid: true,
        timestamp: new Date().toISOString(),
        method: 'on-chain',
        transactionHash: 'tx-hash-123',
      });

      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'proof-1', status: 'ready' })
        );
      });

      const { result } = renderHook(() => useZKProof());

      let verifyResult: { isValid: boolean } = { isValid: false };
      await act(async () => {
        verifyResult = await result.current.verifyOnChain('proof-1');
      });

      expect(verifyResult.isValid).toBe(true);
      expect(useProofStore.getState().proofs['proof-1']?.status).toBe('verified');
    });

    it('should return error when wallet not connected', async () => {
      mockGetWalletSelector.mockReturnValue(null);

      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      const { result } = renderHook(() => useZKProof());

      let verifyResult: { isValid: boolean; error?: string } = { isValid: true };
      await act(async () => {
        verifyResult = await result.current.verifyOnChain('proof-1');
      });

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.error).toContain('Wallet not connected');
    });

    it('should return error for non-existent proof', async () => {
      const { result } = renderHook(() => useZKProof());

      let verifyResult: { isValid: boolean; error?: string } = { isValid: true };
      await act(async () => {
        verifyResult = await result.current.verifyOnChain('non-existent');
      });

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.error).toContain('not found');
    });
  });

  describe('generateComposite', () => {
    it('should generate composite and add proofs to store', async () => {
      const proof1 = createMockProof({ id: 'c1' });
      const proof2 = createMockProof({ id: 'c2', circuit: 'grant-track-record' });

      mockGenerateCompositeCredential.mockResolvedValue({
        id: 'bundle-1',
        proofs: [proof1, proof2],
        circuits: ['verified-builder', 'grant-track-record'],
        status: 'complete',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        errors: [],
      });

      const { result } = renderHook(() => useZKProof());

      let bundle: { status: string } = { status: '' };
      await act(async () => {
        bundle = await result.current.generateComposite({
          circuits: [
            { circuitId: 'verified-builder', inputs: {} as never },
            { circuitId: 'grant-track-record', inputs: {} as never },
          ],
        });
      });

      expect(bundle.status).toBe('complete');
      expect(result.current.proofs).toHaveLength(2);
    });

    it('should set error on failure', async () => {
      mockGenerateCompositeCredential.mockRejectedValue(
        new Error('Composite failed')
      );

      const { result } = renderHook(() => useZKProof());

      let caughtMessage = '';
      await act(async () => {
        try {
          await result.current.generateComposite({
            circuits: [
              { circuitId: 'verified-builder', inputs: {} as never },
            ],
          });
        } catch (err) {
          caughtMessage = err instanceof Error ? err.message : String(err);
        }
      });

      expect(caughtMessage).toBe('Composite failed');
      expect(result.current.error).toBe('Composite failed');
    });
  });

  describe('exportForOnChain', () => {
    it('should return calldata for an existing proof', async () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      const { result } = renderHook(() => useZKProof());

      let calldata = '';
      await act(async () => {
        calldata = await result.current.exportForOnChain('proof-1');
      });

      expect(calldata).toBe('0xCALLDATA');
    });

    it('should throw for non-existent proof', async () => {
      const { result } = renderHook(() => useZKProof());

      await expect(
        act(async () => {
          await result.current.exportForOnChain('missing');
        })
      ).rejects.toThrow('Proof not found');
    });
  });

  describe('exportToJson', () => {
    it('should return JSON for an existing proof', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      const { result } = renderHook(() => useZKProof());

      const json = result.current.exportToJson('proof-1');
      expect(json).toBe('{"id":"proof-1"}');
    });

    it('should return null for non-existent proof', () => {
      const { result } = renderHook(() => useZKProof());
      expect(result.current.exportToJson('missing')).toBeNull();
    });
  });

  describe('removeProof', () => {
    it('should remove a proof from the store', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      const { result } = renderHook(() => useZKProof());

      act(() => {
        result.current.removeProof('proof-1');
      });

      expect(result.current.proofs).toHaveLength(0);
    });
  });

  describe('cancelOperation', () => {
    it('should clear the current operation', () => {
      act(() => {
        useProofStore.getState().setOperation({
          circuit: 'verified-builder',
          phase: 'proving',
          progress: 50,
        });
      });

      const { result } = renderHook(() => useZKProof());

      act(() => {
        result.current.cancelOperation();
      });

      expect(result.current.currentOperation).toBeNull();
    });
  });

  describe('utility functions', () => {
    it('getEstimatedTime should return estimate', () => {
      const { result } = renderHook(() => useZKProof());
      const time = result.current.getEstimatedTime('verified-builder');
      expect(time).toBe(2000);
    });

    it('pruneExpired should delegate to store', () => {
      const expired = createMockProof({
        id: 'expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      act(() => {
        useProofStore.getState().addProof(expired);
      });

      const { result } = renderHook(() => useZKProof());

      let count = 0;
      act(() => {
        count = result.current.pruneExpired();
      });

      expect(count).toBe(1);
    });

    it('isExpired should check proof expiration', () => {
      mockIsProofExpired.mockReturnValue(true);

      act(() => {
        useProofStore.getState().addProof(
          createMockProof({
            id: 'proof-1',
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          })
        );
      });

      const { result } = renderHook(() => useZKProof());
      expect(result.current.isExpired('proof-1')).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      act(() => {
        useProofStore.getState().setError('Some error');
      });

      const { result } = renderHook(() => useZKProof());
      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
