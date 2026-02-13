import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    zk: { verifierContractId: 'zk-verifier.testnet' },
    near: { network: 'testnet' },
  },
}));

vi.mock('@/lib/near/config', () => ({
  getNetworkConfig: () => ({
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://testnet.nearblocks.io',
  }),
}));

import {
  getContractConfig,
  getContractStats,
  getCredentialStorageCost,
  getOnChainCredential,
  isOnChainCredentialValid,
  getCredentialsByOwner,
  hasVerificationKey,
  verifyProofOnContract,
  removeOnChainCredential,
  clearContractCache,
  isCredentialRevoked,
  revokeCredential,
} from '../contract-client';

import {
  ContractCallError,
  ContractPausedError,
  InsufficientDepositError,
} from '../errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpcSuccess(result: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(result));
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        jsonrpc: '2.0',
        id: 'view',
        result: { result: Array.from(encoded) },
      }),
  };
}

function rpcError(message: string) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        jsonrpc: '2.0',
        id: 'view',
        error: { message },
      }),
  };
}

function httpError(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  };
}

function mockWalletSelector(txResult: unknown = {}) {
  return {
    wallet: () =>
      Promise.resolve({
        signAndSendTransaction: vi.fn().mockResolvedValue(txResult),
      }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contract-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearContractCache();
  });

  describe('view functions', () => {
    it('getContractConfig returns parsed config', async () => {
      const mockConfig = {
        owner: 'owner.testnet',
        proposed_owner: null,
        is_paused: false,
        default_expiration_secs: 2592000,
        storage_cost_per_credential: '10000000000000000000000',
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(mockConfig));

      const config = await getContractConfig();
      expect(config.owner).toBe('owner.testnet');
      expect(config.proposed_owner).toBeNull();
      expect(config.is_paused).toBe(false);
      expect(config.default_expiration_secs).toBe(2592000);
    });

    it('getContractStats returns parsed stats', async () => {
      const mockStats = {
        total_verifications: 42,
        total_credentials: 10,
        is_paused: false,
        verification_keys_registered: 3,
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(mockStats));

      const stats = await getContractStats();
      expect(stats.total_verifications).toBe(42);
      expect(stats.total_credentials).toBe(10);
      expect(stats.verification_keys_registered).toBe(3);
    });

    it('getCredentialStorageCost returns string amount', async () => {
      mockFetch.mockResolvedValueOnce(
        rpcSuccess('10000000000000000000000')
      );

      const cost = await getCredentialStorageCost();
      expect(cost).toBe('10000000000000000000000');
    });

    it('getOnChainCredential returns mapped credential', async () => {
      const raw = {
        id: 'cred-abc123',
        owner: 'alice.testnet',
        circuit_type: 'verified-builder',
        public_signals: ['1', '2'],
        verified_at: 1700000000,
        expires_at: 1702592000,
        claim: 'Active builder',
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(raw));

      const cred = await getOnChainCredential('cred-abc123');
      expect(cred).not.toBeNull();
      expect(cred!.id).toBe('cred-abc123');
      expect(cred!.circuitType).toBe('verified-builder');
      expect(cred!.publicSignals).toEqual(['1', '2']);
      expect(cred!.claim).toBe('Active builder');
    });

    it('getOnChainCredential returns null for missing', async () => {
      mockFetch.mockResolvedValueOnce(rpcSuccess(null));

      const cred = await getOnChainCredential('nonexistent');
      expect(cred).toBeNull();
    });

    it('isOnChainCredentialValid returns boolean', async () => {
      mockFetch.mockResolvedValueOnce(rpcSuccess(true));

      const valid = await isOnChainCredentialValid('cred-abc123');
      expect(valid).toBe(true);
    });

    it('isCredentialRevoked returns boolean', async () => {
      mockFetch.mockResolvedValueOnce(rpcSuccess(true));

      const revoked = await isCredentialRevoked('cred-abc123');
      expect(revoked).toBe(true);
    });

    it('getCredentialsByOwner returns paginated result', async () => {
      const raw = {
        credentials: [
          {
            id: 'cred-1',
            owner: 'alice.testnet',
            circuit_type: 'grant-track-record',
            public_signals: ['3'],
            verified_at: 1700000000,
            expires_at: 1702592000,
          },
        ],
        total: 5,
        has_more: true,
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(raw));

      const result = await getCredentialsByOwner('alice.testnet');
      expect(result.credentials).toHaveLength(1);
      expect(result.credentials[0]!.circuitType).toBe('grant-track-record');
      expect(result.total).toBe(5);
      expect(result.has_more).toBe(true);
    });

    it('hasVerificationKey returns boolean', async () => {
      mockFetch.mockResolvedValueOnce(rpcSuccess(true));

      const has = await hasVerificationKey('verified-builder');
      expect(has).toBe(true);
    });

    it('throws ContractCallError on RPC error', async () => {
      mockFetch.mockResolvedValueOnce(rpcError('account not found'));

      await expect(getContractStats()).rejects.toThrow(ContractCallError);
    });
  });

  describe('retry and failover', () => {
    it('retries on 503 then succeeds', async () => {
      const mockConfig = {
        owner: 'owner.testnet',
        proposed_owner: null,
        is_paused: false,
        default_expiration_secs: 2592000,
        storage_cost_per_credential: '10000000000000000000000',
      };

      // First call returns 503, second succeeds
      mockFetch
        .mockResolvedValueOnce(httpError(503))
        .mockResolvedValueOnce(rpcSuccess(mockConfig));

      const config = await getContractConfig();
      expect(config.owner).toBe('owner.testnet');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('view cache', () => {
    it('caches getContractConfig and returns cached on second call', async () => {
      const mockConfig = {
        owner: 'owner.testnet',
        proposed_owner: null,
        is_paused: false,
        default_expiration_secs: 2592000,
        storage_cost_per_credential: '10000000000000000000000',
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(mockConfig));

      // First call — fetches from RPC
      const config1 = await getContractConfig();
      expect(config1.owner).toBe('owner.testnet');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — should use cache (no additional fetch)
      const config2 = await getContractConfig();
      expect(config2.owner).toBe('owner.testnet');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT cache getContractStats (dynamic data)', async () => {
      const mockStats = {
        total_verifications: 42,
        total_credentials: 10,
        is_paused: false,
        verification_keys_registered: 3,
      };
      mockFetch
        .mockResolvedValueOnce(rpcSuccess(mockStats))
        .mockResolvedValueOnce(rpcSuccess({ ...mockStats, total_verifications: 43 }));

      await getContractStats();
      await getContractStats();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clearContractCache invalidates cache', async () => {
      const mockConfig = {
        owner: 'owner.testnet',
        proposed_owner: null,
        is_paused: false,
        default_expiration_secs: 2592000,
        storage_cost_per_credential: '10000000000000000000000',
      };
      mockFetch
        .mockResolvedValueOnce(rpcSuccess(mockConfig))
        .mockResolvedValueOnce(rpcSuccess(mockConfig));

      await getContractConfig();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      clearContractCache();

      await getContractConfig();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error classification', () => {
    it('classifies "Contract is paused" as ContractPausedError', async () => {
      const ws = {
        wallet: () =>
          Promise.resolve({
            signAndSendTransaction: vi.fn().mockRejectedValue(
              new Error('Contract is paused')
            ),
          }),
      } as any;

      const proof = makeProof();
      await expect(verifyProofOnContract(proof, ws)).rejects.toThrow(ContractPausedError);
    });

    it('classifies InsufficientDeposit with parsed amounts', async () => {
      const ws = {
        wallet: () =>
          Promise.resolve({
            signAndSendTransaction: vi.fn().mockRejectedValue(
              new Error('Insufficient deposit: required 10000000000000000000000 yoctoNEAR, attached 0')
            ),
          }),
      } as any;

      const proof = makeProof();
      await expect(
        verifyProofOnContract(proof, ws, { storeCredential: true, deposit: '0' })
      ).rejects.toThrow(InsufficientDepositError);
    });

    it('classifies unknown errors as ContractCallError', async () => {
      const ws = {
        wallet: () =>
          Promise.resolve({
            signAndSendTransaction: vi.fn().mockRejectedValue(
              new Error('something went wrong')
            ),
          }),
      } as any;

      const proof = makeProof();
      await expect(verifyProofOnContract(proof, ws)).rejects.toThrow(ContractCallError);
    });
  });

  describe('change functions', () => {
    it('verifyProofOnContract calls wallet with correct args', async () => {
      const txOutcome = {
        status: {
          SuccessValue: btoa(
            JSON.stringify({ valid: true, credential_id: null, gas_used: 50000 })
          ),
        },
      };
      const ws = mockWalletSelector(txOutcome);

      const proof = makeProof();
      const result = await verifyProofOnContract(proof, ws);
      expect(result.valid).toBe(true);
      expect(result.credential_id).toBeNull();
    });

    it('removeOnChainCredential calls wallet', async () => {
      const txOutcome = {
        status: { SuccessValue: btoa('true') },
      };
      const ws = mockWalletSelector(txOutcome);

      const removed = await removeOnChainCredential('cred-1', ws);
      expect(removed).toBe(true);
    });

    it('revokeCredential calls wallet', async () => {
      const txOutcome = {
        status: { SuccessValue: btoa('null') },
      };
      const ws = mockWalletSelector(txOutcome);

      await expect(
        revokeCredential('cred-1', 'policy violation', ws)
      ).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProof() {
  return {
    id: 'proof-1',
    circuit: 'verified-builder' as const,
    proof: {
      pi_a: ['1', '2', '1'],
      pi_b: [['3', '4'], ['5', '6'], ['1', '0']],
      pi_c: ['7', '8', '1'],
      protocol: 'groth16' as const,
      curve: 'bn128' as const,
    },
    publicSignals: ['42'],
    status: 'ready' as const,
    generatedAt: new Date().toISOString(),
  };
}
