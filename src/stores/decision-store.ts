/**
 * Decision Journal Store
 *
 * Manages decision tracking state including decisions and filters.
 * Uses Zustand with devtools and persist middleware.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Decision, DecisionFilter } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Decision store state */
export interface DecisionState {
  /** Tracked decisions keyed by ID */
  decisions: Record<string, Decision>;
  /** Active filter criteria */
  filter: DecisionFilter;
  /** Loading state */
  isLoading: boolean;
  /** ID of decision currently being analyzed, or null */
  analyzingId: string | null;
  /** Error message if any */
  error: string | null;
}

/** Decision store actions */
export interface DecisionActions {
  // Decision CRUD
  addDecision: (decision: Decision) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  removeDecision: (id: string) => void;

  // Filter
  setFilter: (filter: DecisionFilter) => void;
  clearFilter: () => void;

  // Data portability
  exportData: () => {
    decisions: Record<string, Decision>;
    filter: DecisionFilter;
    exportedAt: number;
  };
  importData: (data: { decisions: Record<string, Decision> }) => void;

  // Loading/error actions
  setLoading: (loading: boolean) => void;
  setAnalyzingId: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: DecisionState = {
  decisions: {},
  filter: {},
  isLoading: false,
  analyzingId: null,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useDecisionStore = create<DecisionState & DecisionActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Decision CRUD
        addDecision: (decision: Decision) =>
          set(
            (state) => ({
              decisions: {
                ...state.decisions,
                [decision.id]: decision,
              },
            }),
            false,
            'addDecision'
          ),

        updateDecision: (id: string, updates: Partial<Decision>) =>
          set(
            (state) => {
              const existing = state.decisions[id];
              if (!existing) return state;

              return {
                decisions: {
                  ...state.decisions,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateDecision'
          ),

        removeDecision: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remaining } = state.decisions;
              return { decisions: remaining };
            },
            false,
            'removeDecision'
          ),

        // Filter
        setFilter: (filter: DecisionFilter) =>
          set({ filter }, false, 'setFilter'),

        clearFilter: () =>
          set({ filter: {} }, false, 'clearFilter'),

        // Data portability
        exportData: () => {
          const { decisions, filter } = get();
          return { decisions, filter, exportedAt: Date.now() };
        },

        importData: (data: { decisions: Record<string, Decision> }) =>
          set(
            (state) => {
              const merged: Record<string, Decision> = { ...state.decisions };
              for (const [id, decision] of Object.entries(data.decisions)) {
                if (!merged[id]) {
                  merged[id] = decision;
                }
              }

              return { decisions: merged };
            },
            false,
            'importData'
          ),

        // Loading/error actions
        setLoading: (loading: boolean) =>
          set(
            {
              isLoading: loading,
              ...(loading ? { error: null } : {}),
            },
            false,
            'setLoading'
          ),

        setAnalyzingId: (id: string | null) =>
          set({ analyzingId: id }, false, 'setAnalyzingId'),

        setError: (error: string | null) =>
          set(
            {
              error,
              isLoading: false,
              analyzingId: null,
            },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        // Reset
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'decision-store',
        partialize: (state) => ({
          decisions: state.decisions,
          filter: state.filter,
        }),
      }
    ),
    {
      name: 'decision-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the decisions record. */
export const useDecisionsRecord = () =>
  useDecisionStore((state) => state.decisions);

/** Get a single decision by ID. */
export const useDecisionById = (id: string) =>
  useDecisionStore((state) => state.decisions[id] ?? null);

/** Get the active filter. */
export const useDecisionFilter = () =>
  useDecisionStore((state) => state.filter);

/** Check if loading. */
export const useDecisionLoading = () =>
  useDecisionStore((state) => state.isLoading);

/** Get the ID of the decision currently being analyzed, or null. */
export const useDecisionAnalyzing = () =>
  useDecisionStore((state) => state.analyzingId);

/** Get the current error. */
export const useDecisionError = () =>
  useDecisionStore((state) => state.error);
