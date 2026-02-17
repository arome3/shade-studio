import { describe, it, expect, vi, beforeEach } from 'vitest';
import { poseidonHash, poseidonHashString, resetPoseidon } from '../poseidon';

// Mock circomlibjs since WASM isn't available in test
vi.mock('circomlibjs', () => ({
  buildPoseidon: vi.fn(async () => {
    // Deterministic mock: poseidon.ts calls poseidon.hash(inputs) where inputs is bigint[]
    // So the mock function receives a single array argument.
    const mockPoseidon = (inputs: bigint[]) => {
      // Produce a deterministic "hash" by summing and mixing
      let hash = BigInt(0);
      for (const input of inputs) {
        // Simple mixing: multiply by a prime and add
        hash = (hash * BigInt(31) + input) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
      }
      // Return as Uint8Array (mock of field element)
      return new Uint8Array([Number(hash % BigInt(256))]);
    };

    mockPoseidon.F = {
      toString: (_val: Uint8Array, _radix?: number) => {
        // For testing, return a deterministic decimal string based on the byte
        return _val[0]?.toString() ?? '0';
      },
      toObject: (val: Uint8Array) => BigInt(val[0] ?? 0),
    };

    return mockPoseidon;
  }),
}));

describe('Poseidon Hash Utility', () => {
  beforeEach(() => {
    resetPoseidon();
  });

  describe('poseidonHash', () => {
    it('returns a decimal string', async () => {
      const result = await poseidonHash([BigInt(42)]);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });

    it('is deterministic (same input → same output)', async () => {
      const a = await poseidonHash([BigInt(100)]);
      const b = await poseidonHash([BigInt(100)]);
      expect(a).toBe(b);
    });

    it('produces different outputs for different inputs', async () => {
      const a = await poseidonHash([BigInt(1)]);
      const b = await poseidonHash([BigInt(2)]);
      expect(a).not.toBe(b);
    });

    it('accepts multiple inputs', async () => {
      const result = await poseidonHash([BigInt(1), BigInt(2), BigInt(3)]);
      expect(typeof result).toBe('string');
    });
  });

  describe('poseidonHashString', () => {
    it('hashes short strings (≤31 bytes) as a single chunk', async () => {
      const result = await poseidonHashString('hello');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+$/);
    });

    it('hashes strings between 32-64 bytes with chunking', async () => {
      // 64-char NEAR account ID — this is the key use case
      const nearAccountId = 'a]'.repeat(32); // 64 bytes
      const result = await poseidonHashString(nearAccountId);
      expect(typeof result).toBe('string');
    });

    it('produces different outputs for different inputs', async () => {
      const a = await poseidonHashString('grant-001');
      const b = await poseidonHashString('grant-002');
      expect(a).not.toBe(b);
    });

    it('hashes empty string as Poseidon(0)', async () => {
      const emptyResult = await poseidonHashString('');
      const zeroResult = await poseidonHash([BigInt(0)]);
      expect(emptyResult).toBe(zeroResult);
    });

    it('throws for strings exceeding 496 bytes', async () => {
      const longString = 'x'.repeat(497);
      await expect(poseidonHashString(longString)).rejects.toThrow(
        /exceeds maximum of 496 bytes/
      );
    });

    it('accepts strings at the 496-byte boundary', async () => {
      const maxString = 'x'.repeat(496);
      const result = await poseidonHashString(maxString);
      expect(typeof result).toBe('string');
    });

    it('handles multi-byte UTF-8 characters correctly', async () => {
      // "€" is 3 bytes in UTF-8 — 11 of them = 33 bytes, triggers chunking
      const multiByteStr = '€'.repeat(11);
      const result = await poseidonHashString(multiByteStr);
      expect(typeof result).toBe('string');
    });
  });

  describe('resetPoseidon', () => {
    it('resets the singleton so next call reinitializes', async () => {
      // First call initializes
      await poseidonHash([BigInt(1)]);
      // Reset
      resetPoseidon();
      // Should not throw (re-initializes)
      const result = await poseidonHash([BigInt(1)]);
      expect(typeof result).toBe('string');
    });
  });
});
