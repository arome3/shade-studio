import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects } from '../use-projects';
import { useProjectsStore } from '@/stores/projects-store';
import { useAuthStore } from '@/stores/auth-store';

// Mock the NEAR wallet modules
vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: vi.fn(),
}));

// Mock the NEAR social module
vi.mock('@/lib/near/social', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  buildSaveProjectTransaction: vi.fn(),
  buildDeleteProjectTransaction: vi.fn(),
}));

// Mock the useWallet hook
vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(),
}));

// Mock the useEncryption hook
vi.mock('../use-encryption', () => ({
  useEncryption: vi.fn(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-project-id'),
}));

// Import mocked modules
import { getWalletSelector } from '@/lib/near/wallet';
import {
  getProjects,
  getProject,
  buildSaveProjectTransaction,
  buildDeleteProjectTransaction,
} from '@/lib/near/social';
import { useWallet } from '../use-wallet';
import { useEncryption } from '../use-encryption';

describe('useProjects', () => {
  const mockAccountId = 'alice.near';

  // Create mock wallet
  const createMockWallet = () => ({
    signAndSendTransaction: vi.fn().mockResolvedValue(undefined),
    getAccounts: vi.fn().mockResolvedValue([
      { accountId: mockAccountId, publicKey: 'ed25519:ABC123' },
    ]),
  });

  // Create mock wallet selector
  const createMockSelector = () => ({
    wallet: vi.fn().mockResolvedValue(createMockWallet()),
  });

  beforeEach(() => {
    // Reset stores
    useProjectsStore.getState().reset();
    useAuthStore.getState().reset();
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(useWallet).mockReturnValue({
      status: 'connected',
      accountId: mockAccountId,
      walletType: 'my-near-wallet',
      error: null,
      isConnected: true,
      isConnecting: false,
      isInitialized: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signMessage: vi.fn(),
    });

    vi.mocked(useEncryption).mockReturnValue({
      status: 'ready',
      isReady: true,
      isInitializing: false,
      error: null,
      keyId: 'test-key-id',
      initialize: vi.fn(),
      encrypt: vi.fn().mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        ephemeralPublicKey: 'key',
        version: 1,
      }),
      decrypt: vi.fn(),
      encryptFileData: vi.fn(),
      decryptFileData: vi.fn(),
      lock: vi.fn(),
      isEncrypted: vi.fn() as unknown as (data: unknown) => data is import('@/types/document').EncryptedPayload,
    });

    vi.mocked(getWalletSelector).mockReturnValue(createMockSelector() as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return idle status initially', () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.status).toBe('idle');
      expect(result.current.isLoading).toBe(false);
    });

    it('should return empty projects array initially', () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.projects).toEqual([]);
    });

    it('should return null currentProject initially', () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.currentProject).toBeNull();
    });
  });

  describe('fetchProjects', () => {
    it('should fetch and set projects', async () => {
      const mockProjectsData = {
        'proj-1': {
          metadata: {
            name: 'Project 1',
            description: 'Test project',
            grantProgram: 'near-foundation',
            status: 'draft',
            visibility: 'private',
            createdAt: 1704067200000,
            updatedAt: 1704067200000,
          },
        },
      };

      vi.mocked(getProjects).mockResolvedValueOnce(mockProjectsData);

      const { result } = renderHook(() => useProjects());

      await act(async () => {
        await result.current.fetchProjects();
      });

      expect(getProjects).toHaveBeenCalledWith(mockAccountId);
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0]!.name).toBe('Project 1');
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(getProjects).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.fetchProjects();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch error', async () => {
      const error = new Error('Network error');
      vi.mocked(getProjects).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useProjects());

      await act(async () => {
        await result.current.fetchProjects();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).not.toBeNull();
    });

    it('should not fetch if no accountId', async () => {
      vi.mocked(useWallet).mockReturnValue({
        status: 'disconnected',
        accountId: null,
        walletType: null,
        error: null,
        isConnected: false,
        isConnecting: false,
        isInitialized: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signMessage: vi.fn(),
      });

      const { result } = renderHook(() => useProjects());

      await act(async () => {
        await result.current.fetchProjects();
      });

      expect(getProjects).not.toHaveBeenCalled();
    });
  });

  describe('fetchProject', () => {
    it('should fetch a single project', async () => {
      const mockProjectData = {
        metadata: {
          name: 'Project 1',
          description: 'Test project',
          grantProgram: 'near-foundation',
          status: 'draft',
          visibility: 'private',
          createdAt: 1704067200000,
          updatedAt: 1704067200000,
        },
      };

      vi.mocked(getProject).mockResolvedValueOnce(mockProjectData);

      const { result } = renderHook(() => useProjects());

      let project;
      await act(async () => {
        project = await result.current.fetchProject('proj-1');
      });

      expect(getProject).toHaveBeenCalledWith(mockAccountId, 'proj-1');
      expect(project).not.toBeNull();
      expect(result.current.currentProject?.id).toBe('proj-1');
    });

    it('should return null for non-existent project', async () => {
      vi.mocked(getProject).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useProjects());

      let project;
      await act(async () => {
        project = await result.current.fetchProject('non-existent');
      });

      expect(project).toBeNull();
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const mockTransaction = {
        receiverId: 'v1.social08.testnet',
        actions: [
          {
            functionCall: {
              methodName: 'set',
              args: new Uint8Array(),
              gas: BigInt(30000000000000),
              deposit: BigInt(0),
            },
          },
        ],
      };

      vi.mocked(buildSaveProjectTransaction).mockResolvedValueOnce(mockTransaction as never);

      const { result } = renderHook(() => useProjects());

      const input = {
        name: 'New Project',
        description: 'A new test project',
        grantProgram: 'near-foundation' as const,
      };

      let project;
      await act(async () => {
        project = await result.current.createProject(input);
      });

      expect(project).toBeDefined();
      expect(project!.id).toBe('mock-project-id');
      expect(project!.metadata.name).toBe('New Project');
      expect(project!.ownerId).toBe(mockAccountId);

      // Should have optimistically added to store
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0]!.id).toBe('mock-project-id');
    });

    it('should set saving state during create', async () => {
      const mockTransaction = {
        receiverId: 'test',
        actions: [
          {
            functionCall: {
              methodName: 'set',
              args: new Uint8Array(),
              gas: BigInt(30000000000000),
              deposit: BigInt(0),
            },
          },
        ],
      };

      vi.mocked(buildSaveProjectTransaction).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockTransaction as never), 100)
          )
      );

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.createProject({
          name: 'Test',
          description: 'Test',
          grantProgram: 'near-foundation',
        });
      });

      expect(result.current.isSaving).toBe(true);

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });
    });

    it('should throw when wallet not connected', async () => {
      vi.mocked(useWallet).mockReturnValue({
        status: 'disconnected',
        accountId: null,
        walletType: null,
        error: null,
        isConnected: false,
        isConnecting: false,
        isInitialized: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signMessage: vi.fn(),
      });

      const { result } = renderHook(() => useProjects());

      await expect(
        result.current.createProject({
          name: 'Test',
          description: 'Test',
          grantProgram: 'near-foundation',
        })
      ).rejects.toThrow();
    });
  });

  describe('deleteProject', () => {
    beforeEach(() => {
      // Setup with existing project
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'Test',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('should delete a project', async () => {
      const mockTransaction = {
        receiverId: 'v1.social08.testnet',
        actions: [
          {
            functionCall: {
              methodName: 'set',
              args: new Uint8Array(),
              gas: BigInt(30000000000000),
              deposit: BigInt(0),
            },
          },
        ],
      };

      vi.mocked(buildDeleteProjectTransaction).mockResolvedValueOnce(mockTransaction as never);

      const { result } = renderHook(() => useProjects());

      expect(result.current.projects).toHaveLength(1);

      await act(async () => {
        await result.current.deleteProject('proj-1');
      });

      expect(buildDeleteProjectTransaction).toHaveBeenCalled();
      // Should have optimistically removed from store
      expect(result.current.projects).toHaveLength(0);
    });

    it('should set deleting state during delete', async () => {
      const mockTransaction = {
        receiverId: 'test',
        actions: [
          {
            functionCall: {
              methodName: 'set',
              args: new Uint8Array(),
              gas: BigInt(30000000000000),
              deposit: BigInt(0),
            },
          },
        ],
      };

      vi.mocked(buildDeleteProjectTransaction).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockTransaction as never), 100)
          )
      );

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.deleteProject('proj-1');
      });

      expect(result.current.isDeleting).toBe(true);

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });
  });

  describe('selectProject', () => {
    beforeEach(() => {
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'Test',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('should select a project and fetch full details', async () => {
      const mockProjectData = {
        metadata: {
          name: 'Project 1',
          description: 'Test project',
          grantProgram: 'near-foundation',
          status: 'draft',
          visibility: 'private',
          createdAt: 1704067200000,
          updatedAt: 1704067200000,
        },
      };

      vi.mocked(getProject).mockResolvedValueOnce(mockProjectData);

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.selectProject('proj-1');
      });

      await waitFor(() => {
        expect(result.current.currentProject).not.toBeNull();
      });

      expect(result.current.currentProject?.id).toBe('proj-1');
    });

    it('should clear currentProject when selecting null', async () => {
      // First set a current project in the store before rendering hook
      useProjectsStore.getState().setCurrentProject({
        id: 'proj-1',
        ownerId: 'alice.near',
        metadata: {
          name: 'Test',
          description: 'Test',
          grantProgram: 'near-foundation',
          tags: [],
        },
        status: 'draft',
        visibility: 'private',
        team: [],
        documentIds: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.currentProject).not.toBeNull();
      });

      act(() => {
        result.current.selectProject(null);
      });

      await waitFor(() => {
        expect(result.current.currentProject).toBeNull();
      });
    });
  });

  describe('wallet disconnect', () => {
    it('should reset store when wallet disconnects', async () => {
      // Start with connected state and projects
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'Test',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);

      const { rerender } = renderHook(() => useProjects());

      expect(useProjectsStore.getState().projects).toHaveLength(1);

      // Simulate wallet disconnect
      vi.mocked(useWallet).mockReturnValue({
        status: 'disconnected',
        accountId: null,
        walletType: null,
        error: null,
        isConnected: false,
        isConnecting: false,
        isInitialized: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signMessage: vi.fn(),
      });

      rerender();

      await waitFor(() => {
        expect(useProjectsStore.getState().projects).toHaveLength(0);
      });
    });
  });
});
