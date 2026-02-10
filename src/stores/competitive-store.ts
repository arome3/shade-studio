/**
 * Competitive Tracker Store
 *
 * Manages competitor tracking state including competitors, entries, and summary.
 * Uses Zustand with devtools and persist middleware.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Competitor,
  CompetitiveEntry,
  CompetitiveSummary,
} from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Competitive store state */
export interface CompetitiveState {
  /** Tracked competitors keyed by ID */
  competitors: Record<string, Competitor>;
  /** Competitive entries keyed by ID */
  entries: Record<string, CompetitiveEntry>;
  /** Current competitive summary */
  summary: CompetitiveSummary | null;
  /** Loading state */
  isLoading: boolean;
  /** AI analysis in progress */
  isAnalyzing: boolean;
  /** Error message if any */
  error: string | null;
}

/** Competitive store actions */
export interface CompetitiveActions {
  // Competitor actions
  addCompetitor: (competitor: Competitor) => void;
  updateCompetitor: (id: string, updates: Partial<Competitor>) => void;
  removeCompetitor: (id: string) => void;

  // Entry actions
  addEntry: (entry: CompetitiveEntry) => void;
  updateEntry: (id: string, updates: Partial<CompetitiveEntry>) => void;
  removeEntry: (id: string) => void;

  // Data portability
  exportData: () => {
    competitors: Record<string, Competitor>;
    entries: Record<string, CompetitiveEntry>;
    summary: CompetitiveSummary | null;
    exportedAt: number;
  };
  importData: (data: {
    competitors: Record<string, Competitor>;
    entries: Record<string, CompetitiveEntry>;
  }) => void;

  // Summary
  setSummary: (summary: CompetitiveSummary) => void;

  // Loading/error actions
  setLoading: (loading: boolean) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: CompetitiveState = {
  competitors: {},
  entries: {},
  summary: null,
  isLoading: false,
  isAnalyzing: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useCompetitiveStore = create<CompetitiveState & CompetitiveActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Competitor actions
        addCompetitor: (competitor: Competitor) =>
          set(
            (state) => ({
              competitors: {
                ...state.competitors,
                [competitor.id]: competitor,
              },
            }),
            false,
            'addCompetitor'
          ),

        updateCompetitor: (id: string, updates: Partial<Competitor>) =>
          set(
            (state) => {
              const existing = state.competitors[id];
              if (!existing) return state;

              return {
                competitors: {
                  ...state.competitors,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateCompetitor'
          ),

        removeCompetitor: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remainingCompetitors } = state.competitors;

              // Cascade: remove all entries for this competitor
              const remainingEntries: Record<string, CompetitiveEntry> = {};
              for (const [entryId, entry] of Object.entries(state.entries)) {
                if (entry.competitorId !== id) {
                  remainingEntries[entryId] = entry;
                }
              }

              return {
                competitors: remainingCompetitors,
                entries: remainingEntries,
              };
            },
            false,
            'removeCompetitor'
          ),

        // Entry actions
        addEntry: (entry: CompetitiveEntry) =>
          set(
            (state) => ({
              entries: {
                ...state.entries,
                [entry.id]: entry,
              },
            }),
            false,
            'addEntry'
          ),

        updateEntry: (id: string, updates: Partial<CompetitiveEntry>) =>
          set(
            (state) => {
              const existing = state.entries[id];
              if (!existing) return state;

              return {
                entries: {
                  ...state.entries,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateEntry'
          ),

        removeEntry: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remainingEntries } = state.entries;
              return { entries: remainingEntries };
            },
            false,
            'removeEntry'
          ),

        // Data portability
        exportData: () => {
          const { competitors, entries, summary } = get();
          return { competitors, entries, summary, exportedAt: Date.now() };
        },

        importData: (data: {
          competitors: Record<string, Competitor>;
          entries: Record<string, CompetitiveEntry>;
        }) =>
          set(
            (state) => {
              const mergedCompetitors: Record<string, Competitor> = { ...state.competitors };
              for (const [id, competitor] of Object.entries(data.competitors)) {
                if (!mergedCompetitors[id]) {
                  mergedCompetitors[id] = competitor;
                }
              }

              const mergedEntries: Record<string, CompetitiveEntry> = { ...state.entries };
              for (const [id, entry] of Object.entries(data.entries)) {
                if (!mergedEntries[id]) {
                  mergedEntries[id] = entry;
                }
              }

              return {
                competitors: mergedCompetitors,
                entries: mergedEntries,
              };
            },
            false,
            'importData'
          ),

        // Summary
        setSummary: (summary: CompetitiveSummary) =>
          set({ summary }, false, 'setSummary'),

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

        setAnalyzing: (analyzing: boolean) =>
          set({ isAnalyzing: analyzing }, false, 'setAnalyzing'),

        setError: (error: string | null) =>
          set(
            {
              error,
              isLoading: false,
              isAnalyzing: false,
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
        name: 'competitive-store',
        partialize: (state) => ({
          competitors: state.competitors,
          entries: state.entries,
          summary: state.summary,
        }),
      }
    ),
    {
      name: 'competitive-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the competitors record. */
export const useCompetitorsRecord = () =>
  useCompetitiveStore((state) => state.competitors);

/** Get a single competitor by ID. */
export const useCompetitorById = (id: string) =>
  useCompetitiveStore((state) => state.competitors[id] ?? null);

/** Get the entries record. */
export const useEntriesRecord = () =>
  useCompetitiveStore((state) => state.entries);

/** Get the competitive summary. */
export const useCompetitiveSummary = () =>
  useCompetitiveStore((state) => state.summary);

/** Check if loading. */
export const useCompetitiveLoading = () =>
  useCompetitiveStore((state) => state.isLoading);

/** Get the current error. */
export const useCompetitiveError = () =>
  useCompetitiveStore((state) => state.error);
