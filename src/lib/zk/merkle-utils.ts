/**
 * Merkle Tree Utilities
 *
 * Builds binary Merkle trees and generates inclusion proofs using
 * the existing Poseidon hash. All operations are async because
 * poseidonHash() initialises WASM on first call.
 *
 * Trees are padded with '0' leaves to reach 2^depth, matching the
 * fixed-size arrays expected by the Circom circuits.
 */

import { poseidonHash } from './poseidon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Complete Merkle tree with all internal levels. */
export interface MerkleTree {
  /** Root hash (decimal string) */
  root: string;
  /** Tree depth */
  depth: number;
  /** Leaves (padded to 2^depth) */
  leaves: string[];
  /** All levels, from leaves (index 0) up to root (index depth) */
  levels: string[][];
}

/** Inclusion proof for a single leaf. */
export interface MerkleProof {
  /** Root hash (decimal string) */
  root: string;
  /** Leaf value being proved */
  leaf: string;
  /** Index of the leaf */
  leafIndex: number;
  /** Sibling hashes at each level (length = depth) */
  siblings: string[];
  /** Path direction at each level: 0 = left child, 1 = right child (length = depth) */
  pathIndices: number[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Hash two children into a parent node using Poseidon. */
async function hashPair(left: string, right: string): Promise<string> {
  return poseidonHash([BigInt(left), BigInt(right)]);
}

/** Pad an array of leaves to exactly 2^depth with '0'. */
function padLeaves(leaves: string[], depth: number): string[] {
  const targetLength = Math.pow(2, depth);

  if (leaves.length > targetLength) {
    throw new Error(
      `Too many leaves (${leaves.length}) for depth ${depth} (max ${targetLength})`
    );
  }

  const padded = [...leaves];
  while (padded.length < targetLength) {
    padded.push('0');
  }
  return padded;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete binary Merkle tree.
 *
 * @param leaves - Leaf values (decimal strings). Will be zero-padded to 2^depth.
 * @param depth  - Tree depth (number of levels above leaves).
 * @returns Full Merkle tree with root and all levels.
 */
export async function buildMerkleTree(
  leaves: string[],
  depth: number
): Promise<MerkleTree> {
  if (depth < 1) {
    throw new Error('Merkle tree depth must be at least 1');
  }

  const paddedLeaves = padLeaves(leaves, depth);

  // Build levels bottom-up
  const levels: string[][] = [paddedLeaves];

  let currentLevel = paddedLeaves;
  for (let i = 0; i < depth; i++) {
    const nextLevel: string[] = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j]!;
      const right = currentLevel[j + 1]!;
      nextLevel.push(await hashPair(left, right));
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0]!,
    depth,
    leaves: paddedLeaves,
    levels,
  };
}

/**
 * Generate an inclusion proof for a leaf at a given index.
 *
 * @param leaves    - Leaf values (will be padded to 2^depth).
 * @param leafIndex - Index of the leaf to prove.
 * @param depth     - Tree depth.
 * @returns Merkle proof with siblings and path indices.
 */
export async function generateMerkleProof(
  leaves: string[],
  leafIndex: number,
  depth: number
): Promise<MerkleProof> {
  const tree = await buildMerkleTree(leaves, depth);

  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(
      `Leaf index ${leafIndex} out of range [0, ${tree.leaves.length - 1}]`
    );
  }

  const siblings: string[] = [];
  const pathIndices: number[] = [];

  let idx = leafIndex;
  for (let level = 0; level < depth; level++) {
    const isRightChild = idx % 2 === 1;
    const siblingIdx = isRightChild ? idx - 1 : idx + 1;

    siblings.push(tree.levels[level]![siblingIdx]!);
    pathIndices.push(isRightChild ? 1 : 0);

    // Move to parent index
    idx = Math.floor(idx / 2);
  }

  return {
    root: tree.root,
    leaf: tree.leaves[leafIndex]!,
    leafIndex,
    siblings,
    pathIndices,
  };
}

/**
 * Verify a Merkle inclusion proof by recomputing the root.
 *
 * @param proof - The proof to verify.
 * @returns true if the recomputed root matches the proof's root.
 */
export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  let currentHash = proof.leaf;

  for (let i = 0; i < proof.siblings.length; i++) {
    const sibling = proof.siblings[i]!;
    const isRightChild = proof.pathIndices[i] === 1;

    if (isRightChild) {
      currentHash = await hashPair(sibling, currentHash);
    } else {
      currentHash = await hashPair(currentHash, sibling);
    }
  }

  return currentHash === proof.root;
}

/**
 * Convert an array of application values to Merkle-tree leaves
 * by applying a field-element conversion function to each.
 *
 * @param values         - Raw values to convert.
 * @param toFieldElement - Async function that hashes/converts a value to a decimal string.
 * @returns Array of decimal-string leaves.
 */
export async function valuesToLeaves<T>(
  values: T[],
  toFieldElement: (v: T) => Promise<string>
): Promise<string[]> {
  const leaves: string[] = [];
  for (const v of values) {
    leaves.push(await toFieldElement(v));
  }
  return leaves;
}
