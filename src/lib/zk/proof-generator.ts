/**
 * ZK Proof Generator
 *
 * Core proof generation engine that wraps snarkjs with the existing
 * Module 14 infrastructure: artifact loading, input validation,
 * signal mapping, and typed error handling.
 *
 * Module 16 hardening:
 * - Concurrency guard via AsyncSemaphore (one proof at a time)
 * - Worker bridge for off-main-thread proving
 * - Synthetic progress callbacks during proving phase
 */

import { nanoid } from 'nanoid';
import type {
  ZKCircuit,
  ZKProof,
  CircuitInputsMap,
  ProofVerificationResult,
} from '@/types/zk';
import { loadCircuitArtifacts, type ArtifactLoadProgress } from './artifacts';
import { validateCircuitInputs } from './validation';
import {
  verifiedBuilderToCircuitSignals,
  grantTrackRecordToCircuitSignals,
  teamAttestationToCircuitSignals,
} from './input-preparation';
import { getCircuitConfig } from './circuit-registry';
import { ProofGenerationError, ProofVerificationError } from './errors';
import { getProofSemaphore } from './concurrency';
import { workerFullProve, workerVerify } from './worker-bridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for proof generation */
export interface ProofGenerationOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Progress callback for artifact loading */
  onProgress?: (progress: ArtifactLoadProgress) => void;
  /** Progress callback for proving phase (0-100) */
  onProvingProgress?: (percent: number) => void;
  /** Whether to self-verify after generation (default: true) */
  selfVerify?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map typed inputs to circuit signal names. */
function mapToCircuitSignals<T extends ZKCircuit>(
  circuitId: T,
  inputs: CircuitInputsMap[T]
): Record<string, unknown> {
  switch (circuitId) {
    case 'verified-builder':
      return verifiedBuilderToCircuitSignals(
        inputs as CircuitInputsMap['verified-builder']
      ) as unknown as Record<string, unknown>;
    case 'grant-track-record':
      return grantTrackRecordToCircuitSignals(
        inputs as CircuitInputsMap['grant-track-record']
      ) as unknown as Record<string, unknown>;
    case 'team-attestation':
      return teamAttestationToCircuitSignals(
        inputs as CircuitInputsMap['team-attestation']
      ) as unknown as Record<string, unknown>;
    default:
      throw new ProofGenerationError(circuitId, 'Unknown circuit ID');
  }
}

/** Check abort signal and throw if aborted. */
function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('Proof generation aborted');
    err.name = 'AbortError';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Proof expiration
// ---------------------------------------------------------------------------

/** Default proof lifetime: 30 days. */
const DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/** Check whether a proof has expired. */
export function isProofExpired(proof: ZKProof): boolean {
  if (!proof.expiresAt) return false;
  return new Date(proof.expiresAt).getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Time estimation
// ---------------------------------------------------------------------------

/** Rough constraint-based time estimate (ms). */
export function estimateProofTime(circuitId: ZKCircuit): number {
  const config = getCircuitConfig(circuitId);
  // Browser Groth16 proving: ~0.5ms per constraint (WASM, single-threaded).
  // Node.js is ~5x faster, so browser estimate = Node time * 5.
  return Math.max(5000, Math.ceil(config.estimatedConstraints * 0.5));
}

// ---------------------------------------------------------------------------
// Core generation
// ---------------------------------------------------------------------------

/**
 * Generate a Groth16 ZK proof for a circuit.
 *
 * Flow:
 * 1. Acquire semaphore (serialises concurrent requests)
 * 2. Check abort signal
 * 3. Validate inputs with Zod schemas
 * 4. Map TS types to circuit signal names
 * 5. Load circuit artifacts (WASM, zkey, vkey)
 * 6. Run fullProve via Web Worker (with synthetic progress)
 * 7. Self-verify via Web Worker (optional, default true)
 * 8. Return ZKProof
 *
 * @throws ProofGenerationError on any failure
 */
export async function generateProof<T extends ZKCircuit>(
  circuitId: T,
  inputs: CircuitInputsMap[T],
  options: ProofGenerationOptions = {}
): Promise<ZKProof> {
  const { signal, onProgress, onProvingProgress, selfVerify = true } = options;

  // Acquire semaphore — serialise concurrent proof generation
  const release = await getProofSemaphore().acquire();

  try {
    // 1. Check abort
    checkAborted(signal);

    // 2. Validate inputs
    const validatedInputs = validateCircuitInputs(circuitId, inputs);

    // 3. Map to circuit signal names
    checkAborted(signal);
    const circuitSignals = mapToCircuitSignals(circuitId, validatedInputs);

    // 4. Load artifacts
    checkAborted(signal);
    const artifacts = await loadCircuitArtifacts(circuitId, onProgress);

    // 5. Run fullProve via Worker bridge (with synthetic progress)
    checkAborted(signal);
    const { proof, publicSignals } = await workerFullProve(
      circuitSignals,
      artifacts.wasm,
      artifacts.zkey,
      {
        signal,
        onProgress: onProvingProgress,
        estimatedMs: estimateProofTime(circuitId),
      }
    );

    // 6. Self-verify via Worker bridge
    checkAborted(signal);
    let status: ZKProof['status'] = 'ready';
    let verifiedAt: string | undefined;

    if (selfVerify) {
      const isValid = await workerVerify(
        artifacts.vkey,
        (publicSignals as string[]).map(String),
        proof,
        signal
      );

      if (!isValid) {
        throw new ProofVerificationError(
          circuitId,
          'Self-verification failed after proof generation'
        );
      }
      status = 'verified';
      verifiedAt = new Date().toISOString();
    }

    // 7. Build ZKProof
    const now = new Date();
    const zkProof: ZKProof = {
      id: nanoid(12),
      circuit: circuitId,
      proof: {
        pi_a: (proof as { pi_a: unknown[] }).pi_a.map(String),
        pi_b: (proof as { pi_b: unknown[][] }).pi_b.map((row: unknown[]) =>
          row.map(String)
        ),
        pi_c: (proof as { pi_c: unknown[] }).pi_c.map(String),
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: (publicSignals as string[]).map(String),
      status,
      generatedAt: now.toISOString(),
      verifiedAt,
      expiresAt: new Date(now.getTime() + DEFAULT_EXPIRY_MS).toISOString(),
    };

    return zkProof;
  } catch (error) {
    // Re-throw known error types
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (error instanceof ProofGenerationError) throw error;
    if (error instanceof ProofVerificationError) throw error;

    throw new ProofGenerationError(
      circuitId,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Local verification
// ---------------------------------------------------------------------------

/**
 * Verify a proof locally using snarkjs (via Worker bridge) and the circuit's
 * verification key.
 */
export async function verifyProofLocally(
  proof: ZKProof
): Promise<ProofVerificationResult> {
  try {
    const artifacts = await loadCircuitArtifacts(proof.circuit);

    // Reconstruct snarkjs-compatible proof object
    const snarkjsProof = {
      pi_a: proof.proof.pi_a,
      pi_b: proof.proof.pi_b,
      pi_c: proof.proof.pi_c,
      protocol: proof.proof.protocol,
      curve: proof.proof.curve,
    };

    const isValid = await workerVerify(
      artifacts.vkey,
      proof.publicSignals,
      snarkjsProof
    );

    return {
      isValid,
      timestamp: new Date().toISOString(),
      method: 'local',
      ...(isValid ? {} : { error: 'Proof verification returned false' }),
    };
  } catch (error) {
    return {
      isValid: false,
      timestamp: new Date().toISOString(),
      method: 'local',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/**
 * Export proof as Solidity-compatible calldata string.
 * Uses snarkjs.groth16.exportSolidityCallData under the hood.
 */
export async function exportProofCalldata(proof: ZKProof): Promise<string> {
  const snarkjs = await import('snarkjs');

  const snarkjsProof = {
    pi_a: proof.proof.pi_a,
    pi_b: proof.proof.pi_b,
    pi_c: proof.proof.pi_c,
    protocol: proof.proof.protocol,
    curve: proof.proof.curve,
  };

  return snarkjs.groth16.exportSolidityCallData(
    snarkjsProof,
    proof.publicSignals
  );
}

/**
 * Serialise a proof to a portable JSON string.
 */
export function exportProofToJson(proof: ZKProof): string {
  return JSON.stringify(proof);
}

/**
 * Deserialise a proof from a JSON string.
 */
export function importProofFromJson(json: string): ZKProof {
  const parsed = JSON.parse(json);

  // Minimal shape validation
  if (
    !parsed ||
    typeof parsed.id !== 'string' ||
    typeof parsed.circuit !== 'string' ||
    !parsed.proof ||
    !Array.isArray(parsed.publicSignals)
  ) {
    throw new Error('Invalid ZKProof JSON');
  }

  return parsed as ZKProof;
}
