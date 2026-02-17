// @vitest-environment node
/**
 * E2E Integration Tests — Real ZK Proof Generation
 *
 * Unlike the 1000+ mock-based tests, these tests exercise the full pipeline:
 * Poseidon hashing → Merkle tree → circuit witness → Groth16 prove → verify.
 *
 * Requirements:
 *   - Compiled artifacts in build/circuits/ (run `npm run circuits:build`)
 *   - Node.js environment (real crypto, no jsdom)
 *
 * Gracefully skips if artifacts are not present.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Artifact paths from build output (not public/ — those are copies)
const BUILD_DIR = resolve(__dirname, '../../../../build/circuits');
const WASM_PATH = resolve(
  BUILD_DIR,
  'verified-builder/verified-builder_js/verified-builder.wasm'
);
const ZKEY_PATH = resolve(BUILD_DIR, 'verified-builder/verified-builder.zkey');
const VKEY_PATH = resolve(
  BUILD_DIR,
  'verified-builder/verified-builder.vkey.json'
);

const HAS_ARTIFACTS =
  existsSync(WASM_PATH) && existsSync(ZKEY_PATH) && existsSync(VKEY_PATH);

// Circuit parameters (must match the circom template instantiation)
const MAX_DAYS = 365;
const MERKLE_DEPTH = 20;

describe.skipIf(!HAS_ARTIFACTS)('E2E: verified-builder', () => {
  let snarkjs: any;
  let vkey: any;
  let wasmBuffer: Buffer;
  let zkeyBuffer: Buffer;

  beforeAll(async () => {
    snarkjs = await import('snarkjs');
    wasmBuffer = readFileSync(WASM_PATH);
    zkeyBuffer = readFileSync(ZKEY_PATH);
    vkey = JSON.parse(readFileSync(VKEY_PATH, 'utf-8'));
  });

  /**
   * Build Poseidon hasher from circomlibjs.
   * Returns a function that hashes bigint inputs to a decimal string.
   */
  async function buildPoseidonHasher() {
    const circomlibjs = await import('circomlibjs');
    const poseidon = await circomlibjs.buildPoseidon();
    return {
      hash: (...inputs: bigint[]): string => {
        const h = poseidon(...inputs);
        return poseidon.F.toString(h, 10);
      },
    };
  }

  /**
   * Build a Merkle tree and generate proofs for the given leaves.
   * Returns { root, proofs } where proofs[i] = { siblings, pathIndices }.
   */
  async function buildTreeAndProofs(
    leaves: string[],
    depth: number
  ): Promise<{
    root: string;
    proofs: Array<{ siblings: string[]; pathIndices: number[] }>;
  }> {
    const poseidon = await buildPoseidonHasher();

    // Pad leaves to 2^depth
    const targetLength = Math.pow(2, depth);
    const padded = [...leaves];
    while (padded.length < targetLength) {
      padded.push('0');
    }

    // Build levels bottom-up
    const levels: string[][] = [padded];
    let current = padded;
    for (let i = 0; i < depth; i++) {
      const next: string[] = [];
      for (let j = 0; j < current.length; j += 2) {
        next.push(poseidon.hash(BigInt(current[j]!), BigInt(current[j + 1]!)));
      }
      levels.push(next);
      current = next;
    }

    const root = current[0]!;

    // Generate proofs for each original leaf
    const proofs = leaves.map((_, leafIndex) => {
      const siblings: string[] = [];
      const pathIndices: number[] = [];

      let idx = leafIndex;
      for (let level = 0; level < depth; level++) {
        const isRight = idx % 2 === 1;
        const siblingIdx = isRight ? idx - 1 : idx + 1;
        siblings.push(levels[level]![siblingIdx]!);
        pathIndices.push(isRight ? 1 : 0);
        idx = Math.floor(idx / 2);
      }

      return { siblings, pathIndices };
    });

    return { root, proofs };
  }

  /**
   * Build full circuit input for verified-builder with `count` activity entries.
   */
  async function buildCircuitInput(count: number, minDays: number) {
    const poseidon = await buildPoseidonHasher();

    // Generate deterministic activity timestamps (one per day starting from 2024-01-01)
    const baseTimestamp = 1704067200; // 2024-01-01T00:00:00Z
    const timestamps: number[] = [];
    for (let i = 0; i < count; i++) {
      timestamps.push(baseTimestamp + i * 86400);
    }

    // Hash each timestamp with Poseidon
    const hashedDates: string[] = [];
    for (const ts of timestamps) {
      hashedDates.push(poseidon.hash(BigInt(ts)));
    }

    // Sort ascending (required by circuit's uniqueness constraint)
    hashedDates.sort((a, b) => {
      const bigA = BigInt(a);
      const bigB = BigInt(b);
      if (bigA < bigB) return -1;
      if (bigA > bigB) return 1;
      return 0;
    });

    // Build Merkle tree from the hashed dates
    const { root, proofs } = await buildTreeAndProofs(hashedDates, MERKLE_DEPTH);

    // Pad arrays to MAX_DAYS
    const activityDates = [...hashedDates];
    while (activityDates.length < MAX_DAYS) {
      activityDates.push('0');
    }

    const pathElements: string[][] = [];
    const pathIndicesArr: number[][] = [];

    for (let i = 0; i < MAX_DAYS; i++) {
      if (i < proofs.length) {
        pathElements.push(proofs[i]!.siblings);
        pathIndicesArr.push(proofs[i]!.pathIndices);
      } else {
        // Zero-padded entries — proof doesn't matter (circuit skips check)
        pathElements.push(new Array(MERKLE_DEPTH).fill('0'));
        pathIndicesArr.push(new Array(MERKLE_DEPTH).fill(0));
      }
    }

    // currentTimestamp must be in range [2020-01-01, 2050-01-01]
    const currentTimestamp = Math.floor(Date.now() / 1000);

    return {
      activityRoot: root,
      minDays,
      currentTimestamp,
      activityDates,
      pathElements,
      pathIndices: pathIndicesArr,
    };
  }

  it(
    'generates and verifies a valid proof',
    async () => {
      const input = await buildCircuitInput(5, 3);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmBuffer,
        zkeyBuffer
      );

      const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      expect(isValid).toBe(true);

      // The last public signal is the `valid` output
      // Public signals order: activityRoot, minDays, currentTimestamp, valid
      const validSignal = publicSignals[publicSignals.length - 1];
      expect(validSignal).toBe('1');
    },
    { timeout: 60_000 }
  );

  it(
    'rejects tampered public signals',
    async () => {
      const input = await buildCircuitInput(5, 3);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmBuffer,
        zkeyBuffer
      );

      // Tamper with the first public signal (activityRoot)
      const tampered = [...publicSignals];
      tampered[0] = '999999999999999999';

      const isValid = await snarkjs.groth16.verify(vkey, tampered, proof);
      expect(isValid).toBe(false);
    },
    { timeout: 60_000 }
  );

  it(
    'outputs valid=0 when minDays exceeds activity count',
    async () => {
      // Only 2 activities but minDays=5
      const input = await buildCircuitInput(2, 5);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmBuffer,
        zkeyBuffer
      );

      // Proof generates successfully but valid output should be 0
      const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      expect(isValid).toBe(true); // Proof itself is valid

      // But the circuit's `valid` output is 0 (threshold not met)
      const validSignal = publicSignals[publicSignals.length - 1];
      expect(validSignal).toBe('0');
    },
    { timeout: 60_000 }
  );
});
