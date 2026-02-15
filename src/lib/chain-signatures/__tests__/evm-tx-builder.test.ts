import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

// Mock ethers JsonRpcProvider
const mockProvider = {
  getTransactionCount: vi.fn(),
  getFeeData: vi.fn(),
  estimateGas: vi.fn(),
  broadcastTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
};

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: vi.fn().mockImplementation(() => mockProvider),
    },
  };
});

import {
  buildUnsignedTx,
  serializeForSigning,
  assembleSignedTx,
  encodeFunctionCall,
} from '../evm-tx-builder';
import type { UnsignedEVMTransaction, MPCSignatureResponse } from '@/types/chain-signatures';

describe('evm-tx-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // buildUnsignedTx
  // ========================================================================

  describe('buildUnsignedTx', () => {
    it('should build EIP-1559 transaction with correct fields', async () => {
      mockProvider.getTransactionCount.mockResolvedValue(5);
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1500000000n,
      });
      mockProvider.estimateGas.mockResolvedValue(21000n);

      const tx = await buildUnsignedTx(
        'ethereum',
        '0x1234567890123456789012345678901234567890',
        '0xabcdef1234567890abcdef1234567890abcdef12',
        '0x',
        '1000000000000000000' // 1 ETH
      );

      expect(tx.type).toBe(2);
      expect(tx.nonce).toBe(5);
      expect(tx.chainId).toBe(1);
      expect(tx.to).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(tx.value).toBe('1000000000000000000');
      expect(tx.data).toBe('0x');
      expect(tx.maxFeePerGas).toBe('30000000000');
      expect(tx.maxPriorityFeePerGas).toBe('1500000000');
      // Gas limit should include 20% buffer: 21000 * 120 / 100 = 25200
      expect(tx.gasLimit).toBe('25200');
    });

    it('should throw when chain does not support EIP-1559', async () => {
      mockProvider.getTransactionCount.mockResolvedValue(0);
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      });
      mockProvider.estimateGas.mockResolvedValue(21000n);

      await expect(
        buildUnsignedTx(
          'ethereum',
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x'
        )
      ).rejects.toThrow('does not support EIP-1559');
    });
  });

  // ========================================================================
  // serializeForSigning
  // ========================================================================

  describe('serializeForSigning', () => {
    it('should return 32-byte hash', () => {
      const tx: UnsignedEVMTransaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0',
        data: '0x',
        nonce: 0,
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '1500000000',
        gasLimit: '21000',
        chainId: 1,
        type: 2,
      };

      const hash = serializeForSigning(tx);
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });

    it('should produce deterministic output', () => {
      const tx: UnsignedEVMTransaction = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '0',
        data: '0xdeadbeef',
        nonce: 42,
        maxFeePerGas: '50000000000',
        maxPriorityFeePerGas: '2000000000',
        gasLimit: '100000',
        chainId: 10,
        type: 2,
      };

      const hash1 = serializeForSigning(tx);
      const hash2 = serializeForSigning(tx);
      expect(hash1).toEqual(hash2);
    });
  });

  // ========================================================================
  // assembleSignedTx
  // ========================================================================

  describe('assembleSignedTx', () => {
    it('should produce a valid hex-encoded signed transaction', () => {
      const tx: UnsignedEVMTransaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0',
        data: '0x',
        nonce: 0,
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '1500000000',
        gasLimit: '21000',
        chainId: 1,
        type: 2,
      };

      // Use a well-formed r and s (64 hex chars each after removing prefix)
      const mpcSignature: MPCSignatureResponse = {
        big_r: {
          affine_point:
            '02' +
            'c6b506e21e0bde60935e52e3a1e3c7b16a535e2b8ff5d95f63aab8d6a1f5c7e2',
        },
        s: {
          scalar:
            '7e3b14e2f5c8d9a6b3c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
        },
        recovery_id: 0,
      };

      const signed = assembleSignedTx(tx, mpcSignature);
      expect(signed).toMatch(/^0x/);
      expect(signed.length).toBeGreaterThan(10);
    });
  });

  // ========================================================================
  // encodeFunctionCall
  // ========================================================================

  describe('encodeFunctionCall', () => {
    it('should ABI-encode a simple function call', () => {
      const abi = ['function transfer(address to, uint256 amount) external'];
      const encoded = encodeFunctionCall(abi, 'transfer', [
        '0x1234567890123456789012345678901234567890',
        '1000000',
      ]);

      expect(encoded).toMatch(/^0x/);
      // transfer(address,uint256) selector = 0xa9059cbb
      expect(encoded.startsWith('0xa9059cbb')).toBe(true);
    });

    it('should encode function with no arguments', () => {
      const abi = ['function pause() external'];
      const encoded = encodeFunctionCall(abi, 'pause', []);

      expect(encoded).toMatch(/^0x/);
      // Only the 4-byte selector
      expect(encoded.length).toBe(10);
    });
  });
});
