/**
 * Zustand store for chain signature submission state.
 *
 * Intentionally has NO persist/devtools middleware — submission data
 * is transient. On-chain EVM state is the source of truth.
 * Matches the project-accounts-store pattern.
 */

import { create } from 'zustand';
import type {
  EVMChainId,
  SubmissionStep,
  CrossChainSubmission,
  DerivedAddress,
} from '@/types/chain-signatures';

// ============================================================================
// Status Type
// ============================================================================

export type ChainSignatureStatus =
  | 'idle'
  | 'deriving'
  | 'submitting'
  | 'error';

// ============================================================================
// State & Actions
// ============================================================================

export interface ChainSignaturesState {
  /** Current operation status */
  status: ChainSignatureStatus;
  /** Active submission step (when submitting) */
  currentStep: SubmissionStep | null;
  /** Submission ID → record mapping */
  submissions: Record<string, CrossChainSubmission>;
  /** "nearAccountId:chainId" → derived address mapping */
  derivedAddresses: Record<string, DerivedAddress>;
  /** Currently selected chain */
  selectedChain: EVMChainId;
  /** Last error */
  error: Error | null;
}

export interface ChainSignaturesActions {
  // Status
  setStatus: (status: ChainSignatureStatus) => void;
  setCurrentStep: (step: SubmissionStep | null) => void;
  setError: (error: Error) => void;
  clearError: () => void;

  // Submissions
  addSubmission: (submission: CrossChainSubmission) => void;
  updateSubmission: (id: string, updates: Partial<CrossChainSubmission>) => void;

  // Derived addresses
  setDerivedAddress: (key: string, address: DerivedAddress) => void;

  // Chain selection
  setSelectedChain: (chain: EVMChainId) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ChainSignaturesState = {
  status: 'idle',
  currentStep: null,
  submissions: {},
  derivedAddresses: {},
  selectedChain: 'ethereum',
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useChainSignaturesStore = create<
  ChainSignaturesState & ChainSignaturesActions
>()((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setError: (error) =>
    set({ status: 'error', error }),

  clearError: () =>
    set({ error: null, status: 'idle' }),

  addSubmission: (submission) =>
    set((state) => ({
      submissions: { ...state.submissions, [submission.id]: submission },
    })),

  updateSubmission: (id, updates) =>
    set((state) => {
      const existing = state.submissions[id];
      if (!existing) return state;
      return {
        submissions: {
          ...state.submissions,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  setDerivedAddress: (key, address) =>
    set((state) => ({
      derivedAddresses: { ...state.derivedAddresses, [key]: address },
    })),

  setSelectedChain: (chain) =>
    set({ selectedChain: chain }),

  reset: () => set(initialState),
}));

// ============================================================================
// Selector Hooks
// ============================================================================

// Stable empty references to prevent Zustand v5 re-render loops.
const EMPTY_SUBMISSIONS: Record<string, CrossChainSubmission> = {};

/** Get all submissions */
export const useChainSubmissions = () =>
  useChainSignaturesStore((state) =>
    Object.keys(state.submissions).length > 0
      ? state.submissions
      : EMPTY_SUBMISSIONS
  );

/** Get derived address for a specific account + chain */
export const useDerivedAddress = (nearAccountId: string, chain: EVMChainId) =>
  useChainSignaturesStore(
    (state) => state.derivedAddresses[`${nearAccountId}:${chain}`]
  );

/** Get the current operation status */
export const useChainSignatureStatus = () =>
  useChainSignaturesStore((state) => state.status);

/** Get the currently selected chain */
export const useSelectedChain = () =>
  useChainSignaturesStore((state) => state.selectedChain);

/** Get the current submission step */
export const useCurrentStep = () =>
  useChainSignaturesStore((state) => state.currentStep);

/** Get the current error */
export const useChainSignatureError = () =>
  useChainSignaturesStore((state) => state.error);
