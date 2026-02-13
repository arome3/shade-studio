/**
 * Proof Store
 *
 * Manages ZK proof state including generated proofs, operation tracking,
 * and proof lifecycle. Uses Zustand with devtools and persist middleware.
 * Follows the same pattern as decision-store.ts.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ZKCircuit, ZKProof, ProofStatus } from '@/types/zk';

// ============================================================================
// Types
// ============================================================================

/** Ongoing proof operation for UI feedback. */
export interface ProofOperation {
  /** Circuit being operated on */
  circuit: ZKCircuit;
  /** Current phase */
  phase: 'loading' | 'proving' | 'verifying';
  /** Progress 0-100 */
  progress: number;
}

/** Proof store state */
export interface ProofState {
  /** Generated proofs keyed by ID */
  proofs: Record<string, ZKProof>;
  /** Proof IDs in newest-first order */
  proofOrder: string[];
  /** Current operation (loading artifacts, proving, verifying) */
  currentOperation: ProofOperation | null;
  /** Error message if any */
  error: string | null;
}

/** Proof store actions */
export interface ProofActions {
  // CRUD
  addProof: (proof: ZKProof) => void;
  updateProof: (id: string, updates: Partial<ZKProof>) => void;
  removeProof: (id: string) => void;

  // Operation tracking
  setOperation: (operation: ProofOperation | null) => void;
  updateOperationProgress: (progress: number) => void;
  clearOperation: () => void;

  // Queries
  getProofsByCircuit: (circuit: ZKCircuit) => ZKProof[];
  getProofsByStatus: (status: ProofStatus) => ZKProof[];

  // Maintenance
  pruneExpired: () => number;

  // Data portability
  exportData: () => {
    proofs: Record<string, ZKProof>;
    proofOrder: string[];
    exportedAt: number;
  };
  importData: (data: { proofs: Record<string, ZKProof> }) => void;

  // Error / reset
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ProofState = {
  proofs: {},
  proofOrder: [],
  currentOperation: null,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useProofStore = create<ProofState & ProofActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // CRUD
        addProof: (proof: ZKProof) =>
          set(
            (state) => ({
              proofs: { ...state.proofs, [proof.id]: proof },
              proofOrder: [proof.id, ...state.proofOrder],
            }),
            false,
            'addProof'
          ),

        updateProof: (id: string, updates: Partial<ZKProof>) =>
          set(
            (state) => {
              const existing = state.proofs[id];
              if (!existing) return state;

              return {
                proofs: {
                  ...state.proofs,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateProof'
          ),

        removeProof: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remaining } = state.proofs;
              return {
                proofs: remaining,
                proofOrder: state.proofOrder.filter((pid) => pid !== id),
              };
            },
            false,
            'removeProof'
          ),

        // Operation tracking
        setOperation: (operation: ProofOperation | null) =>
          set(
            { currentOperation: operation, ...(operation ? { error: null } : {}) },
            false,
            'setOperation'
          ),

        updateOperationProgress: (progress: number) =>
          set(
            (state) => {
              if (!state.currentOperation) return state;
              return {
                currentOperation: { ...state.currentOperation, progress },
              };
            },
            false,
            'updateOperationProgress'
          ),

        clearOperation: () =>
          set({ currentOperation: null }, false, 'clearOperation'),

        // Queries (use get() — no set needed)
        getProofsByCircuit: (circuit: ZKCircuit) => {
          const { proofs, proofOrder } = get();
          return proofOrder
            .map((id) => proofs[id])
            .filter((p): p is ZKProof => !!p && p.circuit === circuit);
        },

        getProofsByStatus: (status: ProofStatus) => {
          const { proofs, proofOrder } = get();
          return proofOrder
            .map((id) => proofs[id])
            .filter((p): p is ZKProof => !!p && p.status === status);
        },

        // Maintenance
        pruneExpired: () => {
          const now = Date.now();
          const { proofs, proofOrder } = get();

          const expiredIds: string[] = [];
          for (const id of proofOrder) {
            const proof = proofs[id];
            if (proof?.expiresAt && new Date(proof.expiresAt).getTime() < now) {
              expiredIds.push(id);
            }
          }

          if (expiredIds.length === 0) return 0;

          const remainingProofs = { ...proofs };
          for (const id of expiredIds) {
            delete remainingProofs[id];
          }

          set(
            {
              proofs: remainingProofs,
              proofOrder: proofOrder.filter((id) => !expiredIds.includes(id)),
            },
            false,
            'pruneExpired'
          );

          return expiredIds.length;
        },

        // Data portability
        exportData: () => {
          const { proofs, proofOrder } = get();
          return { proofs, proofOrder, exportedAt: Date.now() };
        },

        importData: (data: { proofs: Record<string, ZKProof> }) =>
          set(
            (state) => {
              const merged: Record<string, ZKProof> = { ...state.proofs };
              const newOrder = [...state.proofOrder];

              for (const [id, proof] of Object.entries(data.proofs)) {
                if (!merged[id]) {
                  merged[id] = proof;
                  newOrder.push(id);
                }
              }

              return { proofs: merged, proofOrder: newOrder };
            },
            false,
            'importData'
          ),

        // Error / reset
        setError: (error: string | null) =>
          set(
            {
              error,
              currentOperation: null,
            },
            false,
            'setError'
          ),

        clearError: () => set({ error: null }, false, 'clearError'),

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'proof-store',
        partialize: (state) => ({
          proofs: state.proofs,
          proofOrder: state.proofOrder,
        }),
      }
    ),
    {
      name: 'proof-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the proofs record. */
export const useProofsRecord = () =>
  useProofStore((state) => state.proofs);

/** Get a single proof by ID. */
export const useProofById = (id: string) =>
  useProofStore((state) => state.proofs[id] ?? null);

/** Get the proof order array. */
export const useProofOrder = () =>
  useProofStore((state) => state.proofOrder);

/** Get the current operation. */
export const useProofOperation = () =>
  useProofStore((state) => state.currentOperation);

/** Check if a proof operation is in progress. */
export const useProofBusy = () =>
  useProofStore((state) => state.currentOperation !== null);

/** Get the current error. */
export const useProofError = () =>
  useProofStore((state) => state.error);
