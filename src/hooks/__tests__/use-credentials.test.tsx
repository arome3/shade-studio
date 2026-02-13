import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../useZKProof', () => ({
  useZKProof: vi.fn(),
}));

vi.mock('@/stores/credential-store', () => {
  const storeActions = {
    setCredentials: vi.fn(),
    setFetching: vi.fn(),
    setError: vi.fn(),
    removeCredential: vi.fn(),
    addCredential: vi.fn(),
    clearError: vi.fn(),
    reset: vi.fn(),
    credentials: {} as Record<string, unknown>,
    credentialOrder: [] as string[],
    lastFetchedAt: null as number | null,
    isFetching: false,
    error: null as string | null,
  };

  const store = Object.assign(
    vi.fn((selector: (s: typeof storeActions) => unknown) =>
      selector(storeActions)
    ),
    { getState: vi.fn(() => storeActions) }
  );

  return {
    useCredentialStore: store,
    useCredentialsRecord: vi.fn(),
    useCredentialOrder: vi.fn(),
    useCredentialsFetching: vi.fn(),
    useCredentialsError: vi.fn(),
  };
});

vi.mock('@/lib/zk/contract-client', () => ({
  getCredentialsByOwner: vi.fn(),
  verifyProofOnContract: vi.fn(),
  removeOnChainCredential: vi.fn(),
  getCredentialStorageCost: vi.fn(),
}));

vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useCredentials } from '../use-credentials';
import { useWallet } from '../use-wallet';
import { useZKProof } from '../useZKProof';
import {
  useCredentialsRecord,
  useCredentialOrder,
  useCredentialsFetching,
  useCredentialsError,
} from '@/stores/credential-store';
import {
  getCredentialsByOwner,
  getCredentialStorageCost,
  verifyProofOnContract,
  removeOnChainCredential,
} from '@/lib/zk/contract-client';
import { getWalletSelector } from '@/lib/near/wallet';
import type { ZKProof, OnChainCredential } from '@/types/zk';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockLocalProof: ZKProof = {
  id: 'proof-1',
  circuit: 'verified-builder',
  proof: {
    pi_a: ['1', '2'],
    pi_b: [['3', '4'], ['5', '6']],
    pi_c: ['7', '8'],
    protocol: 'groth16',
    curve: 'bn128',
  },
  publicSignals: ['100', '200'],
  status: 'ready',
  generatedAt: '2024-01-15T10:00:00.000Z',
};

const mockOnChainCredential: OnChainCredential = {
  id: 'cred-1',
  owner: 'alice.near',
  circuitType: 'grant-track-record',
  publicSignals: ['300', '400'],
  verifiedAt: 1705312800, // 2024-01-15T10:00:00Z
  expiresAt: 1736935200, // 2025-01-15T10:00:00Z
  claim: 'Completed 5+ grants',
};

// On-chain credential that duplicates the local proof
const mockDuplicateOnChain: OnChainCredential = {
  id: 'cred-dup',
  owner: 'alice.near',
  circuitType: 'verified-builder',
  publicSignals: ['100', '200'], // Same signals as local proof
  verifiedAt: 1705312800,
  expiresAt: 1736935200,
};

function setupMocks(overrides: {
  isConnected?: boolean;
  accountId?: string | null;
  localProofs?: ZKProof[];
  credentialsRecord?: Record<string, OnChainCredential>;
  credentialOrder?: string[];
  isFetching?: boolean;
  credError?: string | null;
  walletSelector?: unknown;
} = {}) {
  const {
    isConnected = true,
    accountId = 'alice.near',
    localProofs = [],
    credentialsRecord = {},
    credentialOrder = [],
    isFetching = false,
    credError = null,
    walletSelector = null,
  } = overrides;

  vi.mocked(useWallet).mockReturnValue({
    status: isConnected ? 'connected' : 'disconnected',
    accountId,
    walletType: 'my-near-wallet',
    error: null,
    isConnected,
    isConnecting: false,
    isInitialized: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
  });

  vi.mocked(useZKProof).mockReturnValue({
    proofs: localProofs,
    currentOperation: null,
    isBusy: false,
    error: null,
    isConnected,
    generateVerifiedBuilderProof: vi.fn(),
    generateGrantTrackRecordProof: vi.fn(),
    generateTeamAttestationProof: vi.fn(),
    verifyProof: vi.fn(),
    verifyOnChain: vi.fn(),
    exportForOnChain: vi.fn(),
    exportToJson: vi.fn(),
    removeProof: vi.fn(),
    cancelOperation: vi.fn(),
    generateComposite: vi.fn(),
    preloadCircuit: vi.fn(),
    getEstimatedTime: vi.fn().mockReturnValue(5000),
    pruneExpired: vi.fn().mockReturnValue(0),
    isExpired: vi.fn().mockReturnValue(false),
    clearError: vi.fn(),
  });

  vi.mocked(useCredentialsRecord).mockReturnValue(credentialsRecord);
  vi.mocked(useCredentialOrder).mockReturnValue(credentialOrder);
  vi.mocked(useCredentialsFetching).mockReturnValue(isFetching);
  vi.mocked(useCredentialsError).mockReturnValue(credError);

  vi.mocked(getCredentialsByOwner).mockResolvedValue({
    credentials: [],
    total: 0,
    has_more: false,
  });

  vi.mocked(getCredentialStorageCost).mockResolvedValue('10000000000000000000000');
  vi.mocked(getWalletSelector).mockReturnValue(walletSelector as ReturnType<typeof getWalletSelector>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('merging', () => {
    it('should merge local proofs and on-chain credentials', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
      });

      const { result } = renderHook(() => useCredentials());

      expect(result.current.credentials).toHaveLength(2);
      expect(result.current.credentials[0]!.source).toBe('on-chain');
      expect(result.current.credentials[1]!.source).toBe('local');
    });

    it('should deduplicate when same proof exists locally and on-chain', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-dup': mockDuplicateOnChain },
        credentialOrder: ['cred-dup'],
      });

      const { result } = renderHook(() => useCredentials());

      // Only on-chain version should remain
      expect(result.current.credentials).toHaveLength(1);
      expect(result.current.credentials[0]!.source).toBe('on-chain');
      expect(result.current.credentials[0]!.id).toBe('cred-dup');
    });

    it('should sort on-chain credentials before local', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
      });

      const { result } = renderHook(() => useCredentials());

      expect(result.current.credentials[0]!.source).toBe('on-chain');
      expect(result.current.credentials[1]!.source).toBe('local');
    });
  });

  describe('filtering', () => {
    it('should filter by circuit type', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
      });

      const { result } = renderHook(() => useCredentials());

      act(() => {
        result.current.setFilter({ circuit: 'verified-builder' });
      });

      expect(result.current.credentials).toHaveLength(1);
      expect(result.current.credentials[0]!.circuit).toBe('verified-builder');
    });

    it('should filter by source', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
      });

      const { result } = renderHook(() => useCredentials());

      act(() => {
        result.current.setFilter({ source: 'on-chain' });
      });

      expect(result.current.credentials).toHaveLength(1);
      expect(result.current.credentials[0]!.source).toBe('on-chain');
    });
  });

  describe('stats', () => {
    it('should compute correct stats', () => {
      setupMocks({
        localProofs: [mockLocalProof],
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
      });

      const { result } = renderHook(() => useCredentials());

      expect(result.current.stats.total).toBe(2);
      expect(result.current.stats.localProofs).toBe(1);
      expect(result.current.stats.onChain).toBe(1);
      expect(result.current.stats.byCircuit['verified-builder']).toBe(1);
      expect(result.current.stats.byCircuit['grant-track-record']).toBe(1);
    });

    it('should return zero stats when empty', () => {
      setupMocks();

      const { result } = renderHook(() => useCredentials());

      expect(result.current.stats.total).toBe(0);
      expect(result.current.stats.localProofs).toBe(0);
      expect(result.current.stats.onChain).toBe(0);
    });
  });

  describe('storeOnChain', () => {
    it('should call verifyProofOnContract with storeCredential=true', async () => {
      const mockSelector = { wallet: vi.fn() };
      vi.mocked(verifyProofOnContract).mockResolvedValue({
        valid: true,
        credential_id: 'new-cred-1',
        gas_used: 100,
      });

      setupMocks({
        localProofs: [mockLocalProof],
        walletSelector: mockSelector,
      });

      const { result } = renderHook(() => useCredentials());

      let credentialId: string | null = null;
      await act(async () => {
        credentialId = await result.current.storeOnChain('proof-1', 'My claim');
      });

      expect(credentialId).toBe('new-cred-1');
      expect(verifyProofOnContract).toHaveBeenCalledWith(
        mockLocalProof,
        mockSelector,
        expect.objectContaining({
          storeCredential: true,
          claim: 'My claim',
        })
      );
    });
  });

  describe('removeCredential', () => {
    it('should call removeProof for local credentials', async () => {
      setupMocks({ localProofs: [mockLocalProof] });

      const { result } = renderHook(() => useCredentials());

      await act(async () => {
        await result.current.removeCredential('proof-1', 'local');
      });

      expect(result.current.zkProof.removeProof).toHaveBeenCalledWith('proof-1');
    });
  });

  describe('connection state', () => {
    it('should expose isConnected from wallet', () => {
      setupMocks({ isConnected: false });

      const { result } = renderHook(() => useCredentials());

      expect(result.current.isConnected).toBe(false);
    });

    it('should auto-fetch on-chain credentials when connected', async () => {
      setupMocks({
        isConnected: true,
        accountId: 'alice.near',
      });

      renderHook(() => useCredentials());

      await waitFor(() => {
        expect(getCredentialsByOwner).toHaveBeenCalledWith(
          'alice.near', true, undefined, 0, 50
        );
      });
    });
  });

  describe('pagination', () => {
    it('should accumulate all pages when has_more is true', async () => {
      const page1Cred: OnChainCredential = {
        id: 'p1-cred',
        owner: 'alice.near',
        circuitType: 'verified-builder',
        publicSignals: ['1'],
        verifiedAt: 1700000000,
        expiresAt: 0,
      };
      const page2Cred: OnChainCredential = {
        id: 'p2-cred',
        owner: 'alice.near',
        circuitType: 'grant-track-record',
        publicSignals: ['2'],
        verifiedAt: 1700000000,
        expiresAt: 0,
      };

      vi.mocked(getCredentialsByOwner)
        .mockResolvedValueOnce({
          credentials: [page1Cred],
          total: 2,
          has_more: true,
        })
        .mockResolvedValueOnce({
          credentials: [page2Cred],
          total: 2,
          has_more: false,
        });

      setupMocks({ isConnected: true, accountId: 'alice.near' });
      // Override the default mock set by setupMocks
      vi.mocked(getCredentialsByOwner)
        .mockResolvedValueOnce({
          credentials: [page1Cred],
          total: 2,
          has_more: true,
        })
        .mockResolvedValueOnce({
          credentials: [page2Cred],
          total: 2,
          has_more: false,
        });

      renderHook(() => useCredentials());

      await waitFor(() => {
        expect(getCredentialsByOwner).toHaveBeenCalledTimes(2);
      });

      // First call with offset=0
      expect(getCredentialsByOwner).toHaveBeenCalledWith(
        'alice.near', true, undefined, 0, 50
      );
      // Second call with offset=50
      expect(getCredentialsByOwner).toHaveBeenCalledWith(
        'alice.near', true, undefined, 50, 50
      );
    });
  });

  describe('removeCredential on-chain', () => {
    it('should call removeOnChainCredential for on-chain source', async () => {
      const mockSelector = { wallet: vi.fn() };
      vi.mocked(removeOnChainCredential).mockResolvedValue(true);

      setupMocks({
        credentialsRecord: { 'cred-1': mockOnChainCredential },
        credentialOrder: ['cred-1'],
        walletSelector: mockSelector,
      });

      const { result } = renderHook(() => useCredentials());

      await act(async () => {
        await result.current.removeCredential('cred-1', 'on-chain');
      });

      expect(removeOnChainCredential).toHaveBeenCalledWith('cred-1', mockSelector);
    });
  });

  describe('clearError', () => {
    it('should expose clearError function', () => {
      setupMocks();
      const { result } = renderHook(() => useCredentials());
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('retryLastAction', () => {
    it('should always be a callable function', () => {
      setupMocks();
      const { result } = renderHook(() => useCredentials());
      expect(typeof result.current.retryLastAction).toBe('function');
      // Calling it when no error has occurred should be a no-op (not throw)
      expect(() => result.current.retryLastAction()).not.toThrow();
    });
  });

  describe('pagination safety cap', () => {
    it('should stop after MAX_PAGES iterations even if has_more is always true', async () => {
      setupMocks({ isConnected: true, accountId: 'alice.near' });

      // Mock getCredentialsByOwner to always return has_more: true
      vi.mocked(getCredentialsByOwner).mockResolvedValue({
        credentials: [],
        total: 999999,
        has_more: true,
      });

      renderHook(() => useCredentials());

      await waitFor(() => {
        // MAX_PAGES is 100 — the loop should stop at 100 calls
        expect(getCredentialsByOwner).toHaveBeenCalledTimes(100);
      });

      // Verify it didn't call more than 100 times (safety cap worked)
      expect(vi.mocked(getCredentialsByOwner).mock.calls.length).toBe(100);
    });
  });
});
