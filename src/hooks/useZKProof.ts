'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet } from './use-wallet';
import {
  useProofStore,
  useProofsRecord,
  useProofOrder,
  useProofOperation,
  useProofBusy,
  useProofError,
  type ProofOperation,
} from '@/stores/proof-store';
import {
  generateProof,
  verifyProofLocally,
  exportProofCalldata,
  exportProofToJson,
  isProofExpired,
  estimateProofTime,
} from '@/lib/zk/proof-generator';
import {
  prepareVerifiedBuilderInputs,
  prepareGrantTrackRecordInputs,
  prepareTeamAttestationInputs,
  type VerifiedBuilderData,
  type GrantTrackRecordData,
  type TeamAttestationData,
} from '@/lib/zk/input-preparation';
import { loadCircuitArtifacts } from '@/lib/zk/artifacts';
import { verifyProofOnChain } from '@/lib/zk/on-chain-verifier';
import {
  generateCompositeCredential,
  type CompositeCredentialRequest,
} from '@/lib/zk/proof-composition';
import { getWalletSelector } from '@/lib/near/wallet';
import type { ZKCircuit, ZKProof, ProofBundle, ProofVerificationResult } from '@/types/zk';

// ============================================================================
// Types
// ============================================================================

/** Return type for the useZKProof hook. */
export interface UseZKProofReturn {
  // State
  proofs: ZKProof[];
  currentOperation: ProofOperation | null;
  isBusy: boolean;
  error: string | null;
  isConnected: boolean;

  // Circuit-specific generators
  generateVerifiedBuilderProof: (data: VerifiedBuilderData) => Promise<ZKProof>;
  generateGrantTrackRecordProof: (data: GrantTrackRecordData) => Promise<ZKProof>;
  generateTeamAttestationProof: (data: TeamAttestationData) => Promise<ZKProof>;

  // Operations
  verifyProof: (id: string) => Promise<boolean>;
  verifyOnChain: (id: string) => Promise<ProofVerificationResult>;
  exportForOnChain: (id: string) => Promise<string>;
  exportToJson: (id: string) => string | null;
  removeProof: (id: string) => void;
  cancelOperation: () => void;

  // Composite
  generateComposite: (request: CompositeCredentialRequest) => Promise<ProofBundle>;

  // Utility
  preloadCircuit: (circuitId: ZKCircuit) => Promise<void>;
  getEstimatedTime: (circuitId: ZKCircuit) => number;
  pruneExpired: () => number;
  isExpired: (id: string) => boolean;

  // Error
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for ZK proof operations.
 * Composes wallet state, proof store, and proof generation engine.
 */
export function useZKProof(): UseZKProofReturn {
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight proof generation on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Wallet state
  const { isConnected } = useWallet();

  // Store selectors
  const proofsRecord = useProofsRecord();
  const proofOrder = useProofOrder();
  const currentOperation = useProofOperation();
  const isBusy = useProofBusy();
  const error = useProofError();

  // Derive sorted proofs array from record + order
  const proofs = useMemo(
    () =>
      proofOrder
        .map((id) => proofsRecord[id])
        .filter((p): p is ZKProof => !!p),
    [proofsRecord, proofOrder]
  );

  // Store actions
  const addProof = useProofStore((s) => s.addProof);
  const updateProof = useProofStore((s) => s.updateProof);
  const removeProofAction = useProofStore((s) => s.removeProof);
  const setOperation = useProofStore((s) => s.setOperation);
  const updateOperationProgress = useProofStore((s) => s.updateOperationProgress);
  const clearOperation = useProofStore((s) => s.clearOperation);
  const setErrorAction = useProofStore((s) => s.setError);
  const clearErrorAction = useProofStore((s) => s.clearError);
  const pruneExpiredAction = useProofStore((s) => s.pruneExpired);

  // ---------------------------------------------------------------------------
  // Internal helper: run proof generation with operation tracking
  // ---------------------------------------------------------------------------
  const runGeneration = useCallback(
    async <T extends ZKCircuit>(
      circuitId: T,
      prepareInputs: () => Promise<Parameters<typeof generateProof<T>>[1]>
    ): Promise<ZKProof> => {
      // Cancel any in-flight operation
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
      const controller = abortRef.current;

      setOperation({ circuit: circuitId, phase: 'loading', progress: 0 });

      try {
        // Prepare inputs
        const inputs = await prepareInputs();

        // Generate proof with progress tracking
        setOperation({ circuit: circuitId, phase: 'proving', progress: 0 });

        const proof = await generateProof(circuitId, inputs, {
          signal: controller.signal,
          onProgress: (p) => {
            // Artifact loading progress — map to 0-30% of operation
            const phaseProgress =
              p.totalBytes && p.totalBytes > 0
                ? Math.round((p.bytesLoaded / p.totalBytes) * 30)
                : 0;
            updateOperationProgress(phaseProgress);
          },
          onProvingProgress: (percent) => {
            // Proving progress — map to 30-100% of operation
            const operationProgress = 30 + Math.round(percent * 0.7);
            updateOperationProgress(operationProgress);
          },
        });

        // Store the proof
        addProof(proof);
        clearOperation();

        return proof;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          clearOperation();
          throw err;
        }
        const message =
          err instanceof Error ? err.message : 'Proof generation failed';
        setErrorAction(message);
        throw err;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [addProof, setOperation, updateOperationProgress, clearOperation, setErrorAction]
  );

  // ---------------------------------------------------------------------------
  // Circuit-specific generators
  // ---------------------------------------------------------------------------

  const generateVerifiedBuilderProof = useCallback(
    (data: VerifiedBuilderData) =>
      runGeneration('verified-builder', () => prepareVerifiedBuilderInputs(data)),
    [runGeneration]
  );

  const generateGrantTrackRecordProof = useCallback(
    (data: GrantTrackRecordData) =>
      runGeneration('grant-track-record', () => prepareGrantTrackRecordInputs(data)),
    [runGeneration]
  );

  const generateTeamAttestationProof = useCallback(
    (data: TeamAttestationData) =>
      runGeneration('team-attestation', () => prepareTeamAttestationInputs(data)),
    [runGeneration]
  );

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const verifyProof = useCallback(
    async (id: string): Promise<boolean> => {
      const proof = useProofStore.getState().proofs[id];
      if (!proof) return false;

      setOperation({ circuit: proof.circuit, phase: 'verifying', progress: 0 });

      try {
        const result = await verifyProofLocally(proof);

        if (result.isValid) {
          updateProof(id, {
            status: 'verified',
            verifiedAt: result.timestamp,
          });
        }

        clearOperation();
        return result.isValid;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Verification failed';
        setErrorAction(message);
        return false;
      }
    },
    [updateProof, setOperation, clearOperation, setErrorAction]
  );

  const verifyOnChain = useCallback(
    async (id: string): Promise<ProofVerificationResult> => {
      const proof = useProofStore.getState().proofs[id];
      if (!proof) {
        return {
          isValid: false,
          timestamp: new Date().toISOString(),
          method: 'on-chain',
          error: `Proof not found: ${id}`,
        };
      }

      const selector = getWalletSelector();
      if (!selector) {
        return {
          isValid: false,
          timestamp: new Date().toISOString(),
          method: 'on-chain',
          error: 'Wallet not connected',
        };
      }

      setOperation({ circuit: proof.circuit, phase: 'verifying', progress: 0 });

      try {
        const result = await verifyProofOnChain(proof, selector);

        if (result.isValid) {
          updateProof(id, {
            status: 'verified',
            verifiedAt: result.timestamp,
          });
        }

        clearOperation();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'On-chain verification failed';
        setErrorAction(message);
        return {
          isValid: false,
          timestamp: new Date().toISOString(),
          method: 'on-chain',
          error: message,
        };
      }
    },
    [updateProof, setOperation, clearOperation, setErrorAction]
  );

  const exportForOnChain = useCallback(async (id: string): Promise<string> => {
    const proof = useProofStore.getState().proofs[id];
    if (!proof) throw new Error(`Proof not found: ${id}`);
    return exportProofCalldata(proof);
  }, []);

  const exportToJson = useCallback((id: string): string | null => {
    const proof = useProofStore.getState().proofs[id];
    if (!proof) return null;
    return exportProofToJson(proof);
  }, []);

  const removeProof = useCallback(
    (id: string) => {
      removeProofAction(id);
    },
    [removeProofAction]
  );

  const cancelOperation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    clearOperation();
  }, [clearOperation]);

  // ---------------------------------------------------------------------------
  // Composite
  // ---------------------------------------------------------------------------

  const generateComposite = useCallback(
    async (request: CompositeCredentialRequest): Promise<ProofBundle> => {
      // Cancel any in-flight operation
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
      const controller = abortRef.current;

      const totalCircuits = request.circuits.length;
      if (totalCircuits > 0) {
        setOperation({
          circuit: request.circuits[0]!.circuitId,
          phase: 'proving',
          progress: 0,
        });
      }

      try {
        const bundle = await generateCompositeCredential({
          ...request,
          signal: request.signal ?? controller.signal,
          onProgress: (circuitIndex, total, circuitProgress) => {
            const overallProgress = Math.round(
              ((circuitIndex * 100 + circuitProgress) / (total * 100)) * 100
            );
            const currentCircuit = request.circuits[circuitIndex];
            if (currentCircuit) {
              setOperation({
                circuit: currentCircuit.circuitId,
                phase: 'proving',
                progress: overallProgress,
              });
            }
            request.onProgress?.(circuitIndex, total, circuitProgress);
          },
        });

        // Add each generated proof to the store
        for (const proof of bundle.proofs) {
          addProof(proof);
        }

        clearOperation();
        return bundle;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          clearOperation();
          throw err;
        }
        const message =
          err instanceof Error ? err.message : 'Composite generation failed';
        setErrorAction(message);
        throw err;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [addProof, setOperation, clearOperation, setErrorAction]
  );

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  const preloadCircuit = useCallback(async (circuitId: ZKCircuit) => {
    await loadCircuitArtifacts(circuitId);
  }, []);

  const getEstimatedTime = useCallback((circuitId: ZKCircuit) => {
    return estimateProofTime(circuitId);
  }, []);

  const pruneExpired = useCallback(() => {
    return pruneExpiredAction();
  }, [pruneExpiredAction]);

  const isExpiredCheck = useCallback(
    (id: string): boolean => {
      const proof = proofsRecord[id];
      if (!proof) return false;
      return isProofExpired(proof);
    },
    [proofsRecord]
  );

  const clearError = useCallback(() => {
    clearErrorAction();
  }, [clearErrorAction]);

  return {
    // State
    proofs,
    currentOperation,
    isBusy,
    error,
    isConnected,

    // Generators
    generateVerifiedBuilderProof,
    generateGrantTrackRecordProof,
    generateTeamAttestationProof,

    // Operations
    verifyProof,
    verifyOnChain,
    exportForOnChain,
    exportToJson,
    removeProof,
    cancelOperation,

    // Composite
    generateComposite,

    // Utility
    preloadCircuit,
    getEstimatedTime,
    pruneExpired,
    isExpired: isExpiredCheck,

    // Error
    clearError,
  };
}
