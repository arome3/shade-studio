/**
 * Poseidon Hash Utility
 *
 * Lazy singleton wrapper around circomlibjs Poseidon implementation.
 * The `buildPoseidon()` call is async (it compiles WASM internally),
 * so we cache the result like the `getAIClient()` pattern.
 *
 * String hashing uses a chunked strategy to stay within the BN128 field:
 *   - ≤31 bytes:  single field element (no chunking needed)
 *   - 32–496 bytes: split into 31-byte chunks, hash all chunks together
 *   - >496 bytes:  rejected (Poseidon supports ≤16 inputs)
 */

/** Maximum bytes per field element (BN128 field ≈ 254 bits → 31 full bytes) */
const MAX_BYTES_PER_FIELD = 31;

/** Maximum chunks Poseidon can hash in one call (circomlibjs limit) */
const MAX_POSEIDON_INPUTS = 16;

/** Maximum string byte length we support: 16 chunks × 31 bytes = 496 */
const MAX_STRING_BYTES = MAX_BYTES_PER_FIELD * MAX_POSEIDON_INPUTS;

// circomlibjs poseidon accepts an array of bigint-like values
type PoseidonFn = (inputs: any[]) => Uint8Array;

interface PoseidonHasher {
  hash: PoseidonFn;
  F: {
    toString: (val: Uint8Array, radix?: number) => string;
    toObject: (val: Uint8Array) => bigint;
  };
}

let poseidonInstance: PoseidonHasher | null = null;

/**
 * Get the singleton Poseidon hasher instance.
 * First call initializes the WASM-based hasher (async).
 */
export async function getPoseidon(): Promise<PoseidonHasher> {
  if (poseidonInstance) return poseidonInstance;

  // Dynamic import to avoid SSR issues — circomlibjs uses WASM
  const circomlibjs = await import('circomlibjs');
  const poseidon = await circomlibjs.buildPoseidon();

  poseidonInstance = {
    hash: poseidon as unknown as PoseidonFn,
    F: poseidon.F,
  };

  return poseidonInstance!;
}

/**
 * Hash inputs using Poseidon and return the result as a decimal string.
 * Convenience wrapper that handles initialization.
 *
 * @param inputs - Array of bigint values to hash
 * @returns Decimal string representation of the hash
 */
export async function poseidonHash(inputs: bigint[]): Promise<string> {
  const poseidon = await getPoseidon();
  // circomlibjs poseidon expects an array, NOT spread arguments
  const hash = poseidon.hash(inputs);
  return poseidon.F.toString(hash, 10);
}

/**
 * Convert a byte array to a BigInt (big-endian).
 * Each byte is shifted left and OR'd into the accumulator.
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i] as number);
  }
  return result;
}

/**
 * Hash a string value using Poseidon with chunked encoding.
 *
 * Strings are encoded as UTF-8 then split into 31-byte chunks (the maximum
 * that fits in a BN128 field element). Each chunk becomes a BigInt input
 * to Poseidon. This preserves collision resistance for strings up to 496
 * bytes (16 chunks × 31 bytes), which covers NEAR account IDs (≤64 chars),
 * UUIDs (36 chars), and other realistic identifiers.
 *
 * @param value - String to hash
 * @returns Decimal string representation of the hash
 * @throws Error if the string exceeds 496 bytes
 */
export async function poseidonHashString(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);

  // Empty string → canonical hash of zero
  if (bytes.length === 0) {
    return poseidonHash([BigInt(0)]);
  }

  // Reject strings that exceed the Poseidon input limit
  if (bytes.length > MAX_STRING_BYTES) {
    throw new Error(
      `String too long for Poseidon hashing: ${bytes.length} bytes exceeds maximum of ${MAX_STRING_BYTES} bytes`
    );
  }

  // Split into 31-byte chunks, each becoming a field element
  const chunks: bigint[] = [];
  for (let offset = 0; offset < bytes.length; offset += MAX_BYTES_PER_FIELD) {
    const end = Math.min(offset + MAX_BYTES_PER_FIELD, bytes.length);
    const chunk = bytes.slice(offset, end);
    chunks.push(bytesToBigInt(chunk));
  }

  return poseidonHash(chunks);
}

/**
 * Reset the Poseidon singleton (for testing).
 */
export function resetPoseidon(): void {
  poseidonInstance = null;
}
