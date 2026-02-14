import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateSubAccountName,
  checkAccountExists,
  buildCreateSubAccountActions,
  buildAddKeyAction,
  buildDeleteKeyAction,
  getPermissionConfig,
  inferPermissionFromAccessKey,
  nearToYocto,
  yoctoToNear,
} from '../project-accounts';
import type { AccessKeyInfo } from '@/types/project-accounts';

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

// Mock isValidAccountId
vi.mock('@/lib/near/config', () => ({
  isValidAccountId: vi.fn((id: string) => {
    if (!id || id.length < 2 || id.length > 64) return false;
    return /^(?:[a-z\d]+[-_])*[a-z\d]+(?:\.[a-z\d]+[-_]*[a-z\d]+)*$/.test(id);
  }),
}));

// Mock global fetch for RPC tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('project-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // nearToYocto / yoctoToNear
  // ========================================================================

  describe('nearToYocto', () => {
    it('should convert 1 NEAR to yoctoNEAR', () => {
      expect(nearToYocto('1')).toBe('1000000000000000000000000');
    });

    it('should convert 0.1 NEAR to yoctoNEAR', () => {
      expect(nearToYocto('0.1')).toBe('100000000000000000000000');
    });

    it('should convert 0 NEAR to yoctoNEAR', () => {
      expect(nearToYocto('0')).toBe('0');
    });

    it('should handle decimal amounts', () => {
      expect(nearToYocto('0.5')).toBe('500000000000000000000000');
    });
  });

  describe('yoctoToNear', () => {
    it('should convert 1 NEAR in yocto back to NEAR', () => {
      expect(yoctoToNear('1000000000000000000000000')).toBe('1.00');
    });

    it('should convert 0.1 NEAR in yocto back to NEAR', () => {
      expect(yoctoToNear('100000000000000000000000')).toBe('0.10');
    });

    it('should convert 0 yocto to NEAR', () => {
      expect(yoctoToNear('0')).toBe('0.00');
    });

    it('should round-trip 0.5 NEAR', () => {
      const yocto = nearToYocto('0.5');
      expect(yoctoToNear(yocto)).toBe('0.50');
    });
  });

  // ========================================================================
  // validateSubAccountName
  // ========================================================================

  describe('validateSubAccountName', () => {
    const parent = 'alice.testnet';

    it('should accept valid sub-account name', () => {
      const result = validateSubAccountName('my-project', parent);
      expect(result.valid).toBe(true);
      expect(result.fullAccountId).toBe('my-project.alice.testnet');
    });

    it('should accept simple alphanumeric name', () => {
      const result = validateSubAccountName('project1', parent);
      expect(result.valid).toBe(true);
      expect(result.fullAccountId).toBe('project1.alice.testnet');
    });

    it('should accept minimum length name (2 chars)', () => {
      const result = validateSubAccountName('ab', parent);
      expect(result.valid).toBe(true);
    });

    it('should reject single character name', () => {
      const result = validateSubAccountName('a', parent);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject name starting with hyphen', () => {
      const result = validateSubAccountName('-project', parent);
      expect(result.valid).toBe(false);
    });

    it('should reject name ending with hyphen', () => {
      const result = validateSubAccountName('project-', parent);
      expect(result.valid).toBe(false);
    });

    it('should reject name with uppercase letters', () => {
      const result = validateSubAccountName('MyProject', parent);
      expect(result.valid).toBe(false);
    });

    it('should reject name with special characters', () => {
      const result = validateSubAccountName('my_project!', parent);
      expect(result.valid).toBe(false);
    });

    it('should reject if total length exceeds 64 chars', () => {
      // Parent is "alice.testnet" (13 chars), with dot = 14
      // So name can be at most 50 chars, but SubAccountNameSchema max is 32
      const longName = 'a'.repeat(33);
      const result = validateSubAccountName(longName, parent);
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validateSubAccountName('', parent);
      expect(result.valid).toBe(false);
    });
  });

  // ========================================================================
  // checkAccountExists
  // ========================================================================

  describe('checkAccountExists', () => {
    it('should return account info when account exists', async () => {
      const mockAccount = {
        amount: '1000000000000000000000000',
        locked: '0',
        code_hash: '11111111111111111111111111111111',
        storage_usage: 182,
        storage_paid_at: 0,
        block_height: 100,
        block_hash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'shade-studio',
          result: mockAccount,
        }),
      });

      const result = await checkAccountExists('alice.testnet');
      expect(result).toEqual(mockAccount);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should return null when account does not exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'shade-studio',
          error: {
            code: -32000,
            message: 'Server error',
            data: 'account alice.testnet does not exist while viewing',
          },
        }),
      });

      const result = await checkAccountExists('alice.testnet');
      expect(result).toBeNull();
    });

    it('should throw on unexpected RPC errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'shade-studio',
          error: {
            code: -32000,
            message: 'Internal error',
            data: 'Some unexpected error',
          },
        }),
      });

      await expect(checkAccountExists('alice.testnet')).rejects.toThrow();
    });

    it('should throw on HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(checkAccountExists('alice.testnet')).rejects.toThrow(
        'RPC request failed'
      );
    });
  });

  // ========================================================================
  // RPC Timeout
  // ========================================================================

  describe('RPC timeout', () => {
    it('should abort fetch after 10 seconds', async () => {
      // Mock fetch to capture the signal and never resolve
      let capturedSignal: AbortSignal | undefined;
      mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          // Listen for abort to reject like a real fetch would
          if (capturedSignal) {
            capturedSignal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        });
      });

      const promise = checkAccountExists('some-account.testnet');

      // Verify the signal was passed with a timeout
      expect(capturedSignal).toBeDefined();

      // The signal should abort — fast-forward and check the promise rejects
      await expect(promise).rejects.toThrow();
    }, 15_000);
  });

  // ========================================================================
  // buildCreateSubAccountActions
  // ========================================================================

  describe('buildCreateSubAccountActions', () => {
    it('should return 3 actions: CreateAccount, Transfer, AddKey', () => {
      const actions = buildCreateSubAccountActions('ed25519:abc123', '0.1');
      expect(actions).toHaveLength(3);
      expect(actions[0]).toEqual({ type: 'CreateAccount' });
      expect(actions[1]).toEqual({
        type: 'Transfer',
        params: { deposit: nearToYocto('0.1') },
      });
      expect(actions[2]).toEqual({
        type: 'AddKey',
        params: {
          publicKey: 'ed25519:abc123',
          accessKey: { permission: 'FullAccess' },
        },
      });
    });
  });

  // ========================================================================
  // buildAddKeyAction
  // ========================================================================

  describe('buildAddKeyAction', () => {
    it('should build FullAccess key for owner', () => {
      const action = buildAddKeyAction('ed25519:abc', 'owner');
      expect(action.type).toBe('AddKey');
      if (action.type === 'AddKey') {
        expect(action.params.accessKey).toEqual({
          permission: 'FullAccess',
        });
      }
    });

    it('should build FunctionCall key for editor with correct methods', () => {
      const action = buildAddKeyAction('ed25519:abc', 'editor');
      expect(action.type).toBe('AddKey');
      if (action.type === 'AddKey') {
        const accessKey = action.params.accessKey;
        expect('permission' in accessKey).toBe(true);
        if ('permission' in accessKey && typeof accessKey.permission === 'object') {
          expect(accessKey.permission.receiverId).toBe('v1.social08.testnet');
          expect(accessKey.permission.methodNames).toEqual([
            'set',
            'grant_write_permission',
          ]);
          expect(accessKey.permission.allowance).toBe(
            '1000000000000000000000000'
          );
        }
      }
    });

    it('should build FunctionCall key for contributor with set only', () => {
      const action = buildAddKeyAction('ed25519:abc', 'contributor');
      if (action.type === 'AddKey') {
        const accessKey = action.params.accessKey;
        if ('permission' in accessKey && typeof accessKey.permission === 'object') {
          expect(accessKey.permission.methodNames).toEqual(['set']);
          expect(accessKey.permission.allowance).toBe(
            '500000000000000000000000'
          );
        }
      }
    });

    it('should throw for viewer permission (no key needed)', () => {
      expect(() => buildAddKeyAction('ed25519:abc', 'viewer')).toThrow(
        'does not require an access key'
      );
    });
  });

  // ========================================================================
  // buildDeleteKeyAction
  // ========================================================================

  describe('buildDeleteKeyAction', () => {
    it('should build a DeleteKey action', () => {
      const action = buildDeleteKeyAction('ed25519:abc123');
      expect(action).toEqual({
        type: 'DeleteKey',
        params: { publicKey: 'ed25519:abc123' },
      });
    });
  });

  // ========================================================================
  // getPermissionConfig
  // ========================================================================

  describe('getPermissionConfig', () => {
    it('should return config for owner', () => {
      const config = getPermissionConfig('owner');
      expect(config.label).toBe('Owner');
      expect(config.requiresKey).toBe(true);
      expect(config.accessKeyPermission?.type).toBe('FullAccess');
    });

    it('should return config for viewer', () => {
      const config = getPermissionConfig('viewer');
      expect(config.requiresKey).toBe(false);
      expect(config.accessKeyPermission).toBeNull();
    });
  });

  // ========================================================================
  // inferPermissionFromAccessKey
  // ========================================================================

  describe('inferPermissionFromAccessKey', () => {
    it('should infer owner from FullAccess key', () => {
      const key: AccessKeyInfo = {
        public_key: 'ed25519:abc',
        access_key: { nonce: 0, permission: 'FullAccess' },
      };
      expect(inferPermissionFromAccessKey(key)).toBe('owner');
    });

    it('should infer editor from FunctionCall key with set + grant_write_permission', () => {
      const key: AccessKeyInfo = {
        public_key: 'ed25519:abc',
        access_key: {
          nonce: 0,
          permission: {
            FunctionCall: {
              allowance: '1000000000000000000000000',
              receiver_id: 'v1.social08.testnet',
              method_names: ['set', 'grant_write_permission'],
            },
          },
        },
      };
      expect(inferPermissionFromAccessKey(key)).toBe('editor');
    });

    it('should infer contributor from FunctionCall key with set only', () => {
      const key: AccessKeyInfo = {
        public_key: 'ed25519:abc',
        access_key: {
          nonce: 0,
          permission: {
            FunctionCall: {
              allowance: '500000000000000000000000',
              receiver_id: 'v1.social08.testnet',
              method_names: ['set'],
            },
          },
        },
      };
      expect(inferPermissionFromAccessKey(key)).toBe('contributor');
    });

    it('should infer contributor for non-social FunctionCall key', () => {
      const key: AccessKeyInfo = {
        public_key: 'ed25519:abc',
        access_key: {
          nonce: 0,
          permission: {
            FunctionCall: {
              allowance: '250000000000000000000000',
              receiver_id: 'some-other-contract.testnet',
              method_names: ['do_something'],
            },
          },
        },
      };
      expect(inferPermissionFromAccessKey(key)).toBe('contributor');
    });
  });
});
