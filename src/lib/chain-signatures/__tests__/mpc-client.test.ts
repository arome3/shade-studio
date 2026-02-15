import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

import {
  deriveEVMAddress,
  requestMPCSignature,
  parseMPCSignatureFromOutcome,
  _resetRootKeyCache,
} from '../mpc-client';

// ============================================================================
// Mock Setup
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockWallet = {
  signAndSendTransaction: vi.fn(),
};

const mockSelector = {
  wallet: vi.fn().mockResolvedValue(mockWallet),
} as any;

/**
 * The MPC contract returns the root key as "secp256k1:BASE58_ENCODED_KEY".
 * We use the secp256k1 generator point G as a well-known valid key for testing.
 *
 * Generator point G (compressed, 33 bytes):
 * 02 79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
 *
 * We need to provide this as a base58-encoded string with checksum (NEAR format).
 * For test purposes, we mock the RPC to return bytes that our code can parse.
 */

/** Create a mock RPC response returning a secp256k1-prefixed base58 key */
function createPublicKeyResponse(base58WithChecksum: string) {
  const keyStr = `"secp256k1:${base58WithChecksum}"`;
  const jsonBytes = Array.from(new TextEncoder().encode(keyStr));
  return {
    ok: true,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'shade-studio-mpc',
      result: {
        result: jsonBytes,
        logs: [],
        block_height: 100,
        block_hash: 'abc',
      },
    }),
  };
}

/**
 * Base58 encoding of secp256k1 generator point G (compressed, 33 bytes).
 * NEAR uses plain base58 (no checksum) for secp256k1 keys.
 * Compressed G: 0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
 */
const G_BASE58 = 'jesTu2BpszP8DKSoi1R5G6ggjHrsrVnboLdx6V47vkoR';

describe('mpc-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRootKeyCache();
  });

  // ========================================================================
  // deriveEVMAddress
  // ========================================================================

  describe('deriveEVMAddress', () => {
    it('should call public_key and return a valid EVM address', async () => {
      mockFetch.mockResolvedValueOnce(
        createPublicKeyResponse(G_BASE58)
      );

      const address = await deriveEVMAddress('alice.testnet', 'ethereum');

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.params.request_type).toBe('call_function');
      expect(body.params.account_id).toBe('v1.signer-prod.testnet');
      expect(body.params.method_name).toBe('public_key');

      // Should return a valid 0x address
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should cache root key across calls', async () => {
      mockFetch.mockResolvedValueOnce(
        createPublicKeyResponse(G_BASE58)
      );

      // First call fetches from RPC
      const addr1 = await deriveEVMAddress('alice.testnet', 'ethereum');
      expect(mockFetch).toHaveBeenCalledOnce();

      // Second call should use cached root key — no additional RPC call
      const addr2 = await deriveEVMAddress('bob.testnet', 'ethereum');
      expect(mockFetch).toHaveBeenCalledOnce(); // Still just 1 call

      // Different accounts should get different addresses
      expect(addr1).not.toBe(addr2);
    });

    it('should derive different addresses for different paths', async () => {
      mockFetch.mockResolvedValueOnce(
        createPublicKeyResponse(G_BASE58)
      );

      const ethAddr = await deriveEVMAddress('alice.testnet', 'ethereum');

      // Polygon also uses 'ethereum-1' path, so address should be the same
      const polygonAddr = await deriveEVMAddress('alice.testnet', 'polygon');
      expect(ethAddr).toBe(polygonAddr);
    });

    it('should throw on RPC error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'shade-studio-mpc',
          error: { code: -32000, message: 'Account not found' },
        }),
      });

      await expect(
        deriveEVMAddress('nonexistent.testnet', 'ethereum')
      ).rejects.toThrow('RPC error');
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        deriveEVMAddress('alice.testnet', 'ethereum')
      ).rejects.toThrow('RPC request failed');
    });
  });

  // ========================================================================
  // requestMPCSignature
  // ========================================================================

  describe('requestMPCSignature', () => {
    it('should call wallet signAndSendTransaction with correct action', async () => {
      const payload = new Uint8Array(32).fill(0xab);
      mockWallet.signAndSendTransaction.mockResolvedValueOnce({ status: {} });

      await requestMPCSignature(payload, 'ethereum', mockSelector);

      expect(mockWallet.signAndSendTransaction).toHaveBeenCalledOnce();
      const call = mockWallet.signAndSendTransaction.mock.calls[0]![0];

      expect(call.receiverId).toBe('v1.signer-prod.testnet');
      expect(call.actions).toHaveLength(1);
      expect(call.actions[0].type).toBe('FunctionCall');
      expect(call.actions[0].params.methodName).toBe('sign');
      expect(call.actions[0].params.gas).toBe('300000000000000');
      // Verify 0.25 NEAR deposit
      expect(call.actions[0].params.deposit).toBe('250000000000000000000000');

      // Verify args contain the payload
      const argsStr = new TextDecoder().decode(call.actions[0].params.args);
      const args = JSON.parse(argsStr);
      expect(args.payload).toEqual(Array.from(payload));
      expect(args.path).toBe('ethereum-1');
      expect(args.key_version).toBe(0);
    });
  });

  // ========================================================================
  // parseMPCSignatureFromOutcome
  // ========================================================================

  describe('parseMPCSignatureFromOutcome', () => {
    const validSignature = {
      big_r: { affine_point: '02abc123' },
      s: { scalar: 'def456' },
      recovery_id: 0,
    };

    it('should parse from direct status.SuccessValue', () => {
      const outcome = {
        status: {
          SuccessValue: btoa(JSON.stringify(validSignature)),
        },
      };

      const result = parseMPCSignatureFromOutcome(outcome);
      expect(result).toEqual(validSignature);
    });

    it('should parse from receipts_outcome', () => {
      const outcome = {
        status: {},
        receipts_outcome: [
          {
            outcome: {
              status: {
                SuccessValue: btoa(JSON.stringify(validSignature)),
              },
            },
          },
        ],
      };

      const result = parseMPCSignatureFromOutcome(outcome);
      expect(result).toEqual(validSignature);
    });

    it('should throw for null outcome', () => {
      expect(() => parseMPCSignatureFromOutcome(null)).toThrow(
        'Invalid transaction outcome'
      );
    });

    it('should throw when no signature found', () => {
      expect(() =>
        parseMPCSignatureFromOutcome({ status: {} })
      ).toThrow('Could not extract MPC signature');
    });

    it('should throw for invalid signature format', () => {
      const outcome = {
        status: {
          SuccessValue: btoa(JSON.stringify({ wrong: 'format' })),
        },
      };

      expect(() => parseMPCSignatureFromOutcome(outcome)).toThrow(
        'Invalid MPC signature format'
      );
    });
  });
});
