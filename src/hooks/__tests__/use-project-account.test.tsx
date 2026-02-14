import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectAccount } from '../use-project-account';
import { useProjectAccountsStore } from '@/stores/project-accounts-store';

// ============================================================================
// Mocks
// ============================================================================

const mockAccountId = 'alice.testnet';

// Mock useWallet
vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    accountId: mockAccountId,
    status: 'connected',
    walletType: 'my-near-wallet',
    error: null,
    isConnecting: false,
    isInitialized: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
  })),
}));

// Mock useEncryption
vi.mock('../use-encryption', () => ({
  useEncryption: vi.fn(() => ({
    status: 'ready',
    isReady: true,
    isInitializing: false,
    error: null,
    keyId: 'test-key',
    initialize: vi.fn(),
    encrypt: vi.fn(async (data: string) => ({
      ciphertext: 'encrypted-' + data,
      nonce: 'test-nonce',
      version: 1,
    })),
    decrypt: vi.fn(),
    encryptFileData: vi.fn(),
    decryptFileData: vi.fn(),
    lock: vi.fn(),
    isEncrypted: vi.fn(),
  })),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
      socialContractId: 'v1.social08.testnet',
    },
  },
}));

// Mock wallet selector
const mockSignAndSend = vi.fn();
const mockWallet = {
  signAndSendTransaction: mockSignAndSend,
};
const mockSelector = {
  wallet: vi.fn(async () => mockWallet),
};

vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: vi.fn(() => mockSelector),
}));

// Mock project-accounts lib
vi.mock('@/lib/near/project-accounts', () => ({
  validateSubAccountName: vi.fn((name: string, parent: string) => {
    if (name.length >= 2 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
      return { valid: true, fullAccountId: `${name}.${parent}` };
    }
    return { valid: false, error: 'Invalid name' };
  }),
  checkAccountExists: vi.fn(async () => null),
  getAccessKeyList: vi.fn(async () => ({ keys: [] })),
  buildCreateSubAccountActions: vi.fn(() => [
    { type: 'CreateAccount' },
    { type: 'Transfer', params: { deposit: '100000000000000000000000' } },
    { type: 'AddKey', params: { publicKey: 'ed25519:mock', accessKey: { permission: 'FullAccess' } } },
  ]),
  buildAddKeyAction: vi.fn(() => ({
    type: 'AddKey',
    params: {
      publicKey: 'ed25519:member-key',
      accessKey: {
        permission: {
          receiverId: 'v1.social08.testnet',
          methodNames: ['set'],
          allowance: '500000000000000000000000',
        },
      },
    },
  })),
  buildDeleteKeyAction: vi.fn((key: string) => ({
    type: 'DeleteKey',
    params: { publicKey: key },
  })),
  inferPermissionFromAccessKey: vi.fn(() => 'contributor'),
}));

// Mock access-keys lib
vi.mock('@/lib/near/access-keys', () => ({
  generateKeyPair: vi.fn(() => ({
    publicKey: 'ed25519:mock-pub-key',
    secretKey: 'ed25519:mock-secret-key',
  })),
  storeEncryptedKey: vi.fn(),
}));

// Mock isValidAccountId
vi.mock('@/lib/near/config', () => ({
  isValidAccountId: vi.fn((id: string) => {
    if (!id || id.length < 2 || id.length > 64) return false;
    return /^(?:[a-z\d]+[-_])*[a-z\d]+(?:\.[a-z\d]+[-_]*[a-z\d]+)*$/.test(id);
  }),
}));

// Mock NEAR errors
vi.mock('@/lib/near/errors', () => ({
  WalletNotConnectedError: class extends Error {
    constructor(msg?: string) {
      super(msg ?? 'Wallet not connected');
      this.name = 'WalletNotConnectedError';
    }
  },
  WalletNotInitializedError: class extends Error {
    constructor() {
      super('Wallet not initialized');
      this.name = 'WalletNotInitializedError';
    }
  },
}));

describe('useProjectAccount', () => {
  beforeEach(() => {
    useProjectAccountsStore.getState().reset();
    vi.clearAllMocks();
    mockSignAndSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Initial State
  // ========================================================================

  describe('initial state', () => {
    it('should return idle status', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      expect(result.current.status).toBe('idle');
    });

    it('should return undefined subAccount', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      expect(result.current.subAccount).toBeUndefined();
    });

    it('should return empty teamMembers', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      expect(result.current.teamMembers).toEqual([]);
    });

    it('should have isCreating false', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      expect(result.current.isCreating).toBe(false);
    });
  });

  // ========================================================================
  // validateSubAccountName
  // ========================================================================

  describe('validateSubAccountName', () => {
    it('should validate a valid name', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      const validation = result.current.validateSubAccountName('my-project');
      expect(validation.valid).toBe(true);
      expect(validation.fullAccountId).toBe('my-project.alice.testnet');
    });

    it('should reject an invalid name', () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));
      const validation = result.current.validateSubAccountName('X');
      expect(validation.valid).toBe(false);
    });
  });

  // ========================================================================
  // createSubAccount
  // ========================================================================

  describe('createSubAccount', () => {
    it('should create a sub-account and update store', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      let account;
      await act(async () => {
        account = await result.current.createSubAccount({
          subAccountName: 'my-project',
          projectId: 'proj-1',
          initialDeposit: '0.1',
        });
      });

      expect(account).toBeDefined();
      expect(account!.accountId).toBe('my-project.alice.testnet');
      expect(account!.isCreated).toBe(true);
      expect(mockSignAndSend).toHaveBeenCalledOnce();

      // Store should be updated
      expect(result.current.subAccount).toBeDefined();
      expect(result.current.subAccount?.accountId).toBe(
        'my-project.alice.testnet'
      );
    });

    it('should add owner as first team member', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await act(async () => {
        await result.current.createSubAccount({
          subAccountName: 'my-project',
          projectId: 'proj-1',
        });
      });

      // Team members are keyed by subAccountId
      const members =
        useProjectAccountsStore.getState().teamMembers[
          'my-project.alice.testnet'
        ];
      expect(members).toHaveLength(1);
      expect(members![0]!.accountId).toBe('alice.testnet');
      expect(members![0]!.permission).toBe('owner');
    });

    it('should throw on wallet error', async () => {
      mockSignAndSend.mockRejectedValueOnce(new Error('User rejected'));

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await expect(
        act(async () => {
          await result.current.createSubAccount({
            subAccountName: 'my-project',
            projectId: 'proj-1',
          });
        })
      ).rejects.toThrow('User rejected');
    });
  });

  // ========================================================================
  // addTeamMember
  // ========================================================================

  describe('addTeamMember', () => {
    it('should add a contributor with a key', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      let addResult;
      await act(async () => {
        addResult = await result.current.addTeamMember({
          subAccountId: 'project.alice.testnet',
          memberAccountId: 'bob.testnet',
          permission: 'contributor',
        });
      });

      expect(addResult).toBeDefined();
      expect(addResult!.member.accountId).toBe('bob.testnet');
      expect(addResult!.member.permission).toBe('contributor');
      expect(addResult!.privateKey).toBe('ed25519:mock-secret-key');
      expect(mockSignAndSend).toHaveBeenCalledOnce();
    });

    it('should add a viewer without a key', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      let addResult;
      await act(async () => {
        addResult = await result.current.addTeamMember({
          subAccountId: 'project.alice.testnet',
          memberAccountId: 'carol.testnet',
          permission: 'viewer',
        });
      });

      expect(addResult!.member.permission).toBe('viewer');
      expect(addResult!.privateKey).toBe('');
      // No transaction should be sent for viewers
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // revokeTeamMember
  // ========================================================================

  describe('revokeTeamMember', () => {
    it('should send DeleteKey transaction and update member status', async () => {
      // Pre-populate store with a member
      useProjectAccountsStore
        .getState()
        .addTeamMember('project.alice.testnet', {
          accountId: 'bob.testnet',
          permission: 'contributor',
          publicKey: 'ed25519:bob-key',
          addedAt: '2025-01-01T00:00:00.000Z',
          keyStatus: 'active',
        });

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await act(async () => {
        await result.current.revokeTeamMember(
          'project.alice.testnet',
          'ed25519:bob-key'
        );
      });

      expect(mockSignAndSend).toHaveBeenCalledOnce();

      // Member should be marked as revoked
      const members =
        useProjectAccountsStore.getState().teamMembers[
          'project.alice.testnet'
        ];
      expect(members![0]!.keyStatus).toBe('revoked');
    });
  });

  // ========================================================================
  // Error States
  // ========================================================================

  describe('error states', () => {
    it('should set error in store on createSubAccount failure', async () => {
      mockSignAndSend.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      try {
        await act(async () => {
          await result.current.createSubAccount({
            subAccountName: 'my-project',
            projectId: 'proj-1',
          });
        });
      } catch {
        // Expected
      }

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  // ========================================================================
  // Account Already Exists
  // ========================================================================

  describe('createSubAccount — account already exists', () => {
    it('should throw when sub-account already exists on-chain', async () => {
      const { checkAccountExists } = await import('@/lib/near/project-accounts');
      vi.mocked(checkAccountExists).mockResolvedValueOnce({
        amount: '1000000000000000000000000',
        locked: '0',
        code_hash: '11111111111111111111111111111111',
        storage_usage: 182,
        storage_paid_at: 0,
        block_height: 100,
        block_hash: 'abc123',
      });

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await expect(
        act(async () => {
          await result.current.createSubAccount({
            subAccountName: 'my-project',
            projectId: 'proj-1',
          });
        })
      ).rejects.toThrow('already exists');
    });
  });

  // ========================================================================
  // RPC Failure in refreshAccessKeys
  // ========================================================================

  describe('refreshAccessKeys — RPC failure', () => {
    it('should set error state when getAccessKeyList throws', async () => {
      const { getAccessKeyList } = await import('@/lib/near/project-accounts');
      vi.mocked(getAccessKeyList).mockRejectedValueOnce(
        new Error('RPC node unavailable')
      );

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await act(async () => {
        await result.current.refreshAccessKeys('project.alice.testnet');
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('RPC node unavailable');
    });
  });

  // ========================================================================
  // Viewer Edge Case
  // ========================================================================

  describe('addTeamMember — viewer does not generate keys', () => {
    it('should not call generateKeyPair or signAndSendTransaction for viewer', async () => {
      const { generateKeyPair } = await import('@/lib/near/access-keys');

      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await act(async () => {
        await result.current.addTeamMember({
          subAccountId: 'project.alice.testnet',
          memberAccountId: 'dave.testnet',
          permission: 'viewer',
        });
      });

      expect(vi.mocked(generateKeyPair)).not.toHaveBeenCalled();
      expect(mockSignAndSend).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Invalid memberAccountId
  // ========================================================================

  describe('addTeamMember — invalid account ID', () => {
    it('should throw on invalid NEAR account ID', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await expect(
        act(async () => {
          await result.current.addTeamMember({
            subAccountId: 'project.alice.testnet',
            memberAccountId: 'INVALID!!',
            permission: 'contributor',
          });
        })
      ).rejects.toThrow('Invalid NEAR account ID');
    });

    it('should throw on empty account ID', async () => {
      const { result } = renderHook(() => useProjectAccount('proj-1'));

      await expect(
        act(async () => {
          await result.current.addTeamMember({
            subAccountId: 'project.alice.testnet',
            memberAccountId: '',
            permission: 'contributor',
          });
        })
      ).rejects.toThrow('Invalid NEAR account ID');
    });
  });
});
