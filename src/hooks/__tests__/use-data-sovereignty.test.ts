import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { VaultDocument } from '@/types/vault-document';
import type { UICredential } from '@/types/credentials';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDeleteDocument = vi.fn();
const mockDownloadDocument = vi.fn();
const mockFetchDocuments = vi.fn();
const mockRemoveCredential = vi.fn();
const mockFetchOnChainCredentials = vi.fn();

vi.mock('../use-wallet', () => ({
  useWallet: () => ({ isConnected: true }),
}));

const mockDocuments: VaultDocument[] = [];
let docsLoading = false;
let docsError: string | null = null;

vi.mock('../use-documents', () => ({
  useDocuments: () => ({
    documents: mockDocuments,
    isLoading: docsLoading,
    error: docsError,
    deleteDocument: mockDeleteDocument,
    downloadDocument: mockDownloadDocument,
    fetchDocuments: mockFetchDocuments,
    uploadDocument: vi.fn(),
    previewDocument: vi.fn(),
    selectDocument: vi.fn(),
    selectedDocument: null,
    status: 'idle',
    validateFileForUpload: vi.fn(),
    getUploadProgress: vi.fn(() => 0),
  }),
}));

const mockCredentials: UICredential[] = [];
let credsFetching = false;
let credsError: string | null = null;

vi.mock('../use-credentials', () => ({
  useCredentials: () => ({
    credentials: mockCredentials,
    isFetching: credsFetching,
    error: credsError,
    removeCredential: mockRemoveCredential,
    fetchOnChainCredentials: mockFetchOnChainCredentials,
    storeOnChain: vi.fn(),
    getStorageCost: vi.fn(),
    clearError: vi.fn(),
    retryLastAction: vi.fn(),
    stats: { total: 0, onChain: 0, local: 0, expired: 0 },
    isStoring: false,
    isConnected: true,
    accountId: 'alice.testnet',
    proofOperation: null,
    isBusy: false,
    filter: 'all',
    setFilter: vi.fn(),
    zkProof: {} as ReturnType<typeof import('../use-credentials').useCredentials>['zkProof'],
  }),
}));

vi.mock('../use-encryption', () => ({
  useEncryption: () => ({
    isReady: true,
    status: 'ready',
    isInitializing: false,
    error: null,
    keyId: 'test-key',
    initialize: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    encryptFileData: vi.fn(),
    decryptFileData: vi.fn(),
    lock: vi.fn(),
    isEncrypted: vi.fn(),
  }),
}));

vi.mock('@/lib/zk/circuit-display', () => ({
  CIRCUIT_DISPLAY: {
    'verified-builder': { name: 'Verified Builder', description: 'test' },
    'account-age': { name: 'Account Age', description: 'test' },
  },
}));

// The store mock — use real zustand store to test integration
// We import the real store and reset it between tests
vi.mock('@/stores/data-sovereignty-store', async () => {
  const actual = await vi.importActual<typeof import('@/stores/data-sovereignty-store')>(
    '@/stores/data-sovereignty-store'
  );
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useDataSovereignty } from '../use-data-sovereignty';
import { useDataSovereigntyStore } from '@/stores/data-sovereignty-store';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeDocument(id: string, name: string, size: number, encrypted = false): VaultDocument {
  return {
    id,
    projectId: 'project-1',
    metadata: {
      name,
      size,
      type: 'other',
      mimeType: 'application/pdf',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      ipfsCid: `Qm${id}`,
      encryptionNonce: encrypted ? 'nonce-123' : '',
    },
    status: 'ready',
  } as unknown as VaultDocument;
}

function makeCredential(id: string, circuit: string, source: 'local' | 'on-chain'): UICredential {
  return {
    id,
    circuit,
    publicSignals: ['1', '2'],
    source,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    status: 'valid',
    isExpired: false,
  } as unknown as UICredential;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDataSovereignty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataSovereigntyStore.getState().reset();
    // Clear mutable mock data
    mockDocuments.length = 0;
    mockCredentials.length = 0;
    docsLoading = false;
    docsError = null;
    credsFetching = false;
    credsError = null;
  });

  // -------------------------------------------------------------------------
  // dataItems derivation
  // -------------------------------------------------------------------------
  describe('dataItems derivation', () => {
    it('maps VaultDocuments to DataItems with correct fields', () => {
      mockDocuments.push(makeDocument('doc-1', 'proposal.pdf', 2048, true));

      const { result } = renderHook(() => useDataSovereignty());

      const docItem = result.current.dataItems.find((i) => i.id === 'doc-1');
      expect(docItem).toBeDefined();
      expect(docItem!.name).toBe('proposal.pdf');
      expect(docItem!.sizeBytes).toBe(2048);
      expect(docItem!.encrypted).toBe(true);
      expect(docItem!.location).toBe('ipfs');
      expect(docItem!.secondaryLocation).toBe('near-social');
      expect(docItem!.category).toBe('documents');
    });

    it('maps UICredentials to DataItems with correct fields', () => {
      mockCredentials.push(makeCredential('cred-1', 'verified-builder', 'on-chain'));

      const { result } = renderHook(() => useDataSovereignty());

      const credItem = result.current.dataItems.find((i) => i.id === 'cred-1');
      expect(credItem).toBeDefined();
      expect(credItem!.name).toBe('Verified Builder');
      expect(credItem!.location).toBe('near-contract');
      expect(credItem!.category).toBe('credentials');
    });

    it('maps local proofs with correct location and category', () => {
      mockCredentials.push(makeCredential('proof-1', 'account-age', 'local'));

      const { result } = renderHook(() => useDataSovereignty());

      const proofItem = result.current.dataItems.find((i) => i.id === 'proof-1');
      expect(proofItem).toBeDefined();
      expect(proofItem!.location).toBe('local');
      expect(proofItem!.category).toBe('proofs');
    });

    it('includes settings item with stable timestamp 0 (Gap 7)', () => {
      const { result } = renderHook(() => useDataSovereignty());

      const settingsItem = result.current.dataItems.find((i) => i.id === 'settings-privacy');
      expect(settingsItem).toBeDefined();
      expect(settingsItem!.createdAt).toBe(0);
      expect(settingsItem!.category).toBe('settings');
    });
  });

  // -------------------------------------------------------------------------
  // filteredItems
  // -------------------------------------------------------------------------
  describe('filteredItems', () => {
    it('filters by categoryFilter', () => {
      mockDocuments.push(makeDocument('doc-1', 'file.pdf', 1024));
      mockCredentials.push(makeCredential('cred-1', 'verified-builder', 'on-chain'));

      useDataSovereigntyStore.getState().setCategoryFilter('documents');

      const { result } = renderHook(() => useDataSovereignty());

      expect(result.current.filteredItems.every((i) => i.category === 'documents')).toBe(true);
    });

    it('filters by locationFilter', () => {
      mockDocuments.push(makeDocument('doc-1', 'file.pdf', 1024));
      mockCredentials.push(makeCredential('cred-1', 'verified-builder', 'on-chain'));

      useDataSovereigntyStore.getState().setLocationFilter('ipfs');

      const { result } = renderHook(() => useDataSovereignty());

      expect(result.current.filteredItems.every((i) => i.location === 'ipfs')).toBe(true);
    });

    it('filters by searchQuery', () => {
      mockDocuments.push(makeDocument('doc-1', 'proposal.pdf', 1024));
      mockDocuments.push(makeDocument('doc-2', 'readme.md', 512));

      useDataSovereigntyStore.getState().setSearchQuery('proposal');

      const { result } = renderHook(() => useDataSovereignty());

      const filtered = result.current.filteredItems.filter((i) => i.category !== 'settings');
      expect(filtered.length).toBe(1);
      expect(filtered[0]!.name).toBe('proposal.pdf');
    });
  });

  // -------------------------------------------------------------------------
  // storageSummary (Gap 4: secondary locations)
  // -------------------------------------------------------------------------
  describe('storageSummary', () => {
    it('computes per-location totals including secondary locations', () => {
      mockDocuments.push(makeDocument('doc-1', 'file.pdf', 2048));

      const { result } = renderHook(() => useDataSovereignty());

      const { breakdown } = result.current.storageSummary;

      // Should have ipfs (primary) + near-social (secondary) + local (settings)
      const ipfs = breakdown.find((b) => b.location === 'ipfs');
      const nearSocial = breakdown.find((b) => b.location === 'near-social');

      expect(ipfs).toBeDefined();
      expect(ipfs!.totalBytes).toBe(2048);
      expect(nearSocial).toBeDefined();
      expect(nearSocial!.totalBytes).toBe(500); // NEAR_SOCIAL_METADATA_ESTIMATE
    });
  });

  // -------------------------------------------------------------------------
  // encryptionSummary
  // -------------------------------------------------------------------------
  describe('encryptionSummary', () => {
    it('counts encrypted vs total (excluding settings)', () => {
      mockDocuments.push(makeDocument('doc-1', 'encrypted.pdf', 1024, true));
      mockDocuments.push(makeDocument('doc-2', 'plain.pdf', 512, false));

      const { result } = renderHook(() => useDataSovereignty());

      expect(result.current.encryptionSummary.encryptedCount).toBe(1);
      expect(result.current.encryptionSummary.totalCount).toBe(2);
      expect(result.current.encryptionSummary.overallPercentage).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------------
  describe('stats', () => {
    it('totalItems excludes settings', () => {
      mockDocuments.push(makeDocument('doc-1', 'file.pdf', 1024));

      const { result } = renderHook(() => useDataSovereignty());

      // 1 document (settings excluded)
      expect(result.current.stats.totalItems).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // logActivity respects activityLogEnabled (Gap 2)
  // -------------------------------------------------------------------------
  describe('logActivity', () => {
    it('logs activity when activityLogEnabled is true', () => {
      const { result } = renderHook(() => useDataSovereignty());

      act(() => {
        result.current.logActivity('upload', 'Test upload', 'documents', 'doc-1');
      });

      expect(result.current.activities.length).toBe(1);
      expect(result.current.activities[0]!.description).toBe('Test upload');
    });

    it('skips logging when activityLogEnabled is false', () => {
      useDataSovereigntyStore.getState().updatePrivacySetting('activityLogEnabled', false);

      const { result } = renderHook(() => useDataSovereignty());

      act(() => {
        result.current.logActivity('upload', 'Should not appear', 'documents');
      });

      expect(result.current.activities.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // updatePrivacySetting logs setting changes (Gap 2)
  // -------------------------------------------------------------------------
  describe('updatePrivacySetting', () => {
    it('logs setting change as activity', () => {
      const { result } = renderHook(() => useDataSovereignty());

      act(() => {
        result.current.updatePrivacySetting('autoEncrypt', false);
      });

      // Should have logged the setting change
      expect(result.current.activities.length).toBe(1);
      expect(result.current.activities[0]!.action).toBe('setting-change');
      expect(result.current.activities[0]!.description).toContain('autoEncrypt');
    });
  });

  // -------------------------------------------------------------------------
  // deleteSelectedItems collects errors (Gap 6)
  // -------------------------------------------------------------------------
  describe('deleteSelectedItems', () => {
    it('returns DeleteResult with failedItems on partial failure', async () => {
      mockDocuments.push(makeDocument('doc-1', 'success.pdf', 1024));
      mockDocuments.push(makeDocument('doc-2', 'failure.pdf', 512));

      mockDeleteDocument
        .mockResolvedValueOnce(undefined) // doc-1 succeeds
        .mockRejectedValueOnce(new Error('Network error')); // doc-2 fails

      useDataSovereigntyStore.getState().selectAllItems(['doc-1', 'doc-2']);

      const { result } = renderHook(() => useDataSovereignty());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteSelectedItems>>;
      await act(async () => {
        deleteResult = await result.current.deleteSelectedItems();
      });

      expect(deleteResult!.successCount).toBe(1);
      expect(deleteResult!.failedItems.length).toBe(1);
      expect(deleteResult!.failedItems[0]!.name).toBe('failure.pdf');
      expect(deleteResult!.failedItems[0]!.error).toBe('Network error');
    });

    it('clears selection after delete', async () => {
      mockDocuments.push(makeDocument('doc-1', 'file.pdf', 1024));
      mockDeleteDocument.mockResolvedValue(undefined);

      useDataSovereigntyStore.getState().selectAllItems(['doc-1']);

      const { result } = renderHook(() => useDataSovereignty());

      await act(async () => {
        await result.current.deleteSelectedItems();
      });

      expect(result.current.selectedItemIds.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // retry (Gap 5)
  // -------------------------------------------------------------------------
  describe('retry', () => {
    it('calls fetchDocuments and fetchOnChainCredentials', async () => {
      const { result } = renderHook(() => useDataSovereignty());

      await act(async () => {
        await result.current.retry();
      });

      expect(mockFetchDocuments).toHaveBeenCalled();
      expect(mockFetchOnChainCredentials).toHaveBeenCalled();
    });
  });
});
