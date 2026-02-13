/**
 * Proof Composition — Composite Credential Generation
 *
 * Orchestrates sequential generation of multiple ZK proofs and bundles them
 * into a ProofBundle. Supports partial failure (some proofs succeed while
 * others fail) and abort via AbortSignal.
 */

import { nanoid } from 'nanoid';
import type {
  ZKCircuit,
  CircuitInputsMap,
  ProofBundle,
} from '@/types/zk';
import { generateProof } from './proof-generator';
import { verifyProofLocally } from './proof-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Single circuit request within a composite credential */
export interface CircuitRequest {
  circuitId: ZKCircuit;
  inputs: CircuitInputsMap[ZKCircuit];
}

/** Request to generate a composite credential */
export interface CompositeCredentialRequest {
  /** Circuits and inputs to generate proofs for */
  circuits: CircuitRequest[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Progress callback: circuitIndex (0-based), totalCircuits, per-circuit progress (0-100) */
  onProgress?: (circuitIndex: number, totalCircuits: number, circuitProgress: number) => void;
}

/** Result of verifying a proof bundle */
export interface ProofBundleVerificationResult {
  /** Whether all proofs in the bundle are valid */
  allValid: boolean;
  /** Per-proof verification results */
  results: Array<{
    circuit: ZKCircuit;
    isValid: boolean;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Composite generation
// ---------------------------------------------------------------------------

/**
 * Generate a composite credential by sequentially generating multiple proofs.
 *
 * - Runs proof generations sequentially (semaphore is permits=1 anyway)
 * - Partial failure: if some succeed and some fail → status 'partial'
 * - Checks abort signal before each sequential proof
 */
export async function generateCompositeCredential(
  request: CompositeCredentialRequest
): Promise<ProofBundle> {
  const { circuits, signal, onProgress } = request;
  const bundleId = nanoid(12);
  const totalCircuits = circuits.length;

  const bundle: ProofBundle = {
    id: bundleId,
    proofs: [],
    circuits: circuits.map((c) => c.circuitId),
    status: 'generating',
    createdAt: new Date().toISOString(),
    errors: [],
  };

  for (let i = 0; i < totalCircuits; i++) {
    // Check abort before each circuit
    if (signal?.aborted) {
      bundle.status = bundle.proofs.length > 0 ? 'partial' : 'failed';
      bundle.completedAt = new Date().toISOString();
      return bundle;
    }

    const circuitReq = circuits[i]!;

    try {
      const proof = await generateProof(
        circuitReq.circuitId,
        circuitReq.inputs,
        {
          signal,
          onProvingProgress: (percent) => {
            onProgress?.(i, totalCircuits, percent);
          },
        }
      );

      bundle.proofs.push(proof);
      onProgress?.(i, totalCircuits, 100);
    } catch (error) {
      // Abort errors should stop the entire bundle
      if (error instanceof Error && error.name === 'AbortError') {
        bundle.status = bundle.proofs.length > 0 ? 'partial' : 'failed';
        bundle.completedAt = new Date().toISOString();
        return bundle;
      }

      // Record per-circuit error and continue
      bundle.errors.push({
        circuit: circuitReq.circuitId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Determine final status
  if (bundle.proofs.length === totalCircuits) {
    bundle.status = 'complete';
  } else if (bundle.proofs.length > 0) {
    bundle.status = 'partial';
  } else {
    bundle.status = 'failed';
  }

  bundle.completedAt = new Date().toISOString();
  return bundle;
}

// ---------------------------------------------------------------------------
// Bundle verification
// ---------------------------------------------------------------------------

/**
 * Verify all proofs in a bundle locally.
 */
export async function verifyProofBundle(
  bundle: ProofBundle
): Promise<ProofBundleVerificationResult> {
  const results: ProofBundleVerificationResult['results'] = [];

  for (const proof of bundle.proofs) {
    try {
      const result = await verifyProofLocally(proof);
      results.push({
        circuit: proof.circuit,
        isValid: result.isValid,
        ...(result.error ? { error: result.error } : {}),
      });
    } catch (error) {
      results.push({
        circuit: proof.circuit,
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    allValid: results.length > 0 && results.every((r) => r.isValid),
    results,
  };
}
