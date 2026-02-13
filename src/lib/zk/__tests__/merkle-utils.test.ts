/**
 * Tests for Merkle tree utilities.
 *
 * Mocks poseidonHash with a deterministic numeric hash so tests
 * are fast and reproducible without initialising WASM.
 * Hash function: H(a, b) = (a * 7919 + b + 1) — always returns a
 * numeric decimal string that can be parsed back as BigInt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deterministic numeric hash mock: produces decimal strings safe for BigInt()
vi.mock('../poseidon', () => ({
  poseidonHash: vi.fn((inputs: bigint[]) => {
    // Simple deterministic hash: fold inputs with a prime multiplier
    let result = BigInt(0);
    for (const inp of inputs) {
      result = result * BigInt(7919) + inp + BigInt(1);
    }
    // Ensure positive
    if (result < 0) result = -result;
    return Promise.resolve(result.toString());
  }),
}));

import {
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  valuesToLeaves,
} from '../merkle-utils';

describe('buildMerkleTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build a depth-1 tree with 2 leaves', async () => {
    const tree = await buildMerkleTree(['1', '2'], 1);

    expect(tree.depth).toBe(1);
    expect(tree.leaves).toEqual(['1', '2']);
    expect(tree.levels).toHaveLength(2); // leaves + root
    // Root is H(1, 2), a numeric string
    expect(typeof tree.root).toBe('string');
    expect(() => BigInt(tree.root)).not.toThrow();
  });

  it('should pad leaves to 2^depth', async () => {
    const tree = await buildMerkleTree(['1'], 2);

    // Should pad to 4 leaves
    expect(tree.leaves).toEqual(['1', '0', '0', '0']);
    expect(tree.levels[0]).toHaveLength(4);
    expect(tree.levels[1]).toHaveLength(2);
    expect(tree.levels[2]).toHaveLength(1);
  });

  it('should reject too many leaves for depth', async () => {
    await expect(
      buildMerkleTree(['1', '2', '3'], 1) // 3 > 2^1
    ).rejects.toThrow('Too many leaves');
  });

  it('should reject depth < 1', async () => {
    await expect(buildMerkleTree(['1'], 0)).rejects.toThrow(
      'depth must be at least 1'
    );
  });

  it('should build a depth-2 tree with correct structure', async () => {
    const tree = await buildMerkleTree(['10', '20', '30', '40'], 2);

    // Level 0: leaves
    expect(tree.levels[0]).toEqual(['10', '20', '30', '40']);
    // Level 1: 2 parent nodes
    expect(tree.levels[1]).toHaveLength(2);
    // Level 2: root (1 node)
    expect(tree.levels[2]).toHaveLength(1);
    expect(tree.root).toBe(tree.levels[2]![0]);
  });

  it('should produce different roots for different leaves', async () => {
    const tree1 = await buildMerkleTree(['1', '2'], 1);
    const tree2 = await buildMerkleTree(['3', '4'], 1);

    expect(tree1.root).not.toBe(tree2.root);
  });
});

describe('generateMerkleProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate proof for first leaf (index 0)', async () => {
    const proof = await generateMerkleProof(['10', '20', '30', '40'], 0, 2);

    expect(proof.leaf).toBe('10');
    expect(proof.leafIndex).toBe(0);
    expect(proof.siblings).toHaveLength(2);
    expect(proof.pathIndices).toHaveLength(2);
    // Index 0 is left child at level 0
    expect(proof.pathIndices[0]).toBe(0);
  });

  it('should generate proof for right-child leaf (index 1)', async () => {
    const proof = await generateMerkleProof(['10', '20'], 1, 1);

    expect(proof.leaf).toBe('20');
    expect(proof.leafIndex).toBe(1);
    expect(proof.siblings).toEqual(['10']); // sibling is the left node
    expect(proof.pathIndices).toEqual([1]); // right child
  });

  it('should generate proof for last leaf in padded tree', async () => {
    // Only 2 real leaves in a depth-2 tree (4 total with padding)
    const proof = await generateMerkleProof(['100', '200'], 1, 2);

    expect(proof.leaf).toBe('200');
    expect(proof.siblings).toHaveLength(2);
    expect(proof.pathIndices).toHaveLength(2);
  });

  it('should reject out-of-range leaf index', async () => {
    await expect(
      generateMerkleProof(['1', '2'], 5, 1)
    ).rejects.toThrow('out of range');
  });

  it('should reject negative leaf index', async () => {
    await expect(
      generateMerkleProof(['1', '2'], -1, 1)
    ).rejects.toThrow('out of range');
  });
});

describe('verifyMerkleProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify a valid proof (depth 1)', async () => {
    const proof = await generateMerkleProof(['5', '10'], 0, 1);
    const isValid = await verifyMerkleProof(proof);
    expect(isValid).toBe(true);
  });

  it('should verify a valid proof (depth 2)', async () => {
    const proof = await generateMerkleProof(['10', '20', '30', '40'], 2, 2);
    const isValid = await verifyMerkleProof(proof);
    expect(isValid).toBe(true);
  });

  it('should verify proofs for all leaf indices', async () => {
    const leaves = ['10', '20', '30', '40'];
    for (let i = 0; i < 4; i++) {
      const proof = await generateMerkleProof(leaves, i, 2);
      const isValid = await verifyMerkleProof(proof);
      expect(isValid).toBe(true);
    }
  });

  it('should reject a proof with wrong root', async () => {
    const proof = await generateMerkleProof(['5', '10'], 0, 1);
    const tampered = { ...proof, root: '999999' };
    const isValid = await verifyMerkleProof(tampered);
    expect(isValid).toBe(false);
  });

  it('should reject a proof with wrong leaf', async () => {
    const proof = await generateMerkleProof(['5', '10'], 0, 1);
    const tampered = { ...proof, leaf: '777' };
    const isValid = await verifyMerkleProof(tampered);
    expect(isValid).toBe(false);
  });
});

describe('valuesToLeaves', () => {
  it('should convert values using the provided function', async () => {
    const values = [1, 2, 3];
    const toField = async (v: number) => String(v * 10);

    const leaves = await valuesToLeaves(values, toField);
    expect(leaves).toEqual(['10', '20', '30']);
  });

  it('should return empty array for empty input', async () => {
    const leaves = await valuesToLeaves([], async () => '0');
    expect(leaves).toEqual([]);
  });
});
