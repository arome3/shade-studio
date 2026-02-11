/**
 * Weekly Synthesis Store
 *
 * Manages weekly synthesis reports state.
 * Uses Zustand with devtools and persist middleware.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { WeeklySynthesis } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Named generation stages for progress feedback */
export type GenerationStage = 'gathering' | 'analyzing' | 'generating' | 'finalizing' | null;

/** Human-readable labels for generation stages */
export const GENERATION_STAGE_LABELS: Record<NonNullable<GenerationStage>, string> = {
  gathering: 'Gathering weekly data…',
  analyzing: 'Analyzing patterns & trends…',
  generating: 'Generating AI synthesis…',
  finalizing: 'Finalizing report…',
};

/** Synthesis store state */
export interface SynthesisState {
  /** Weekly syntheses keyed by weekStart (YYYY-MM-DD) */
  syntheses: Record<string, WeeklySynthesis>;
  /** Currently selected week start date, or null for current week */
  selectedWeekStart: string | null;
  /** Whether a synthesis is currently being generated */
  isGenerating: boolean;
  /** Generation progress (0-100) */
  generationProgress: number;
  /** Current generation stage for descriptive progress */
  generationStage: GenerationStage;
  /** Error message if any */
  error: string | null;
}

/** Synthesis store actions */
export interface SynthesisActions {
  // Synthesis CRUD
  addSynthesis: (synthesis: WeeklySynthesis) => void;
  updateSynthesis: (weekStart: string, updates: Partial<WeeklySynthesis>) => void;
  removeSynthesis: (weekStart: string) => void;

  // Selection
  setSelectedWeek: (weekStart: string | null) => void;

  // Data portability
  exportData: () => {
    syntheses: Record<string, WeeklySynthesis>;
    selectedWeekStart: string | null;
    exportedAt: number;
  };
  importData: (data: { syntheses: Record<string, WeeklySynthesis> }) => void;

  // Loading/error actions
  setGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setGenerationStage: (stage: GenerationStage) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: SynthesisState = {
  syntheses: {},
  selectedWeekStart: null,
  isGenerating: false,
  generationProgress: 0,
  generationStage: null,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useSynthesisStore = create<SynthesisState & SynthesisActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Synthesis CRUD
        addSynthesis: (synthesis: WeeklySynthesis) =>
          set(
            (state) => ({
              syntheses: {
                ...state.syntheses,
                [synthesis.weekStart]: synthesis,
              },
            }),
            false,
            'addSynthesis'
          ),

        updateSynthesis: (weekStart: string, updates: Partial<WeeklySynthesis>) =>
          set(
            (state) => {
              const existing = state.syntheses[weekStart];
              if (!existing) return state;

              return {
                syntheses: {
                  ...state.syntheses,
                  [weekStart]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateSynthesis'
          ),

        removeSynthesis: (weekStart: string) =>
          set(
            (state) => {
              const { [weekStart]: _, ...remaining } = state.syntheses;
              return { syntheses: remaining };
            },
            false,
            'removeSynthesis'
          ),

        // Selection
        setSelectedWeek: (weekStart: string | null) =>
          set({ selectedWeekStart: weekStart }, false, 'setSelectedWeek'),

        // Data portability
        exportData: () => {
          const { syntheses, selectedWeekStart } = get();
          return { syntheses, selectedWeekStart, exportedAt: Date.now() };
        },

        importData: (data: { syntheses: Record<string, WeeklySynthesis> }) =>
          set(
            (state) => {
              const merged: Record<string, WeeklySynthesis> = { ...state.syntheses };
              for (const [weekStart, synthesis] of Object.entries(data.syntheses)) {
                if (!merged[weekStart]) {
                  merged[weekStart] = synthesis;
                }
              }

              return { syntheses: merged };
            },
            false,
            'importData'
          ),

        // Loading/error actions
        setGenerating: (generating: boolean) =>
          set(
            {
              isGenerating: generating,
              ...(generating
                ? { error: null, generationProgress: 0, generationStage: null }
                : { generationStage: null }),
            },
            false,
            'setGenerating'
          ),

        setGenerationProgress: (progress: number) =>
          set(
            { generationProgress: Math.min(100, Math.max(0, progress)) },
            false,
            'setGenerationProgress'
          ),

        setGenerationStage: (stage: GenerationStage) =>
          set({ generationStage: stage }, false, 'setGenerationStage'),

        setError: (error: string | null) =>
          set(
            {
              error,
              isGenerating: false,
              generationProgress: 0,
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
        name: 'synthesis-store',
        partialize: (state) => ({
          syntheses: state.syntheses,
          selectedWeekStart: state.selectedWeekStart,
        }),
      }
    ),
    {
      name: 'synthesis-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the syntheses record. */
export const useSynthesesRecord = () =>
  useSynthesisStore((state) => state.syntheses);

/** Get a single synthesis by week start date. */
export const useSynthesisById = (weekStart: string) =>
  useSynthesisStore((state) => state.syntheses[weekStart] ?? null);

/** Get the selected week start date. */
export const useSelectedWeekStart = () =>
  useSynthesisStore((state) => state.selectedWeekStart);

/** Check if currently generating. */
export const useSynthesisGenerating = () =>
  useSynthesisStore((state) => state.isGenerating);

/** Get the generation progress (0-100). */
export const useSynthesisProgress = () =>
  useSynthesisStore((state) => state.generationProgress);

/** Get the current generation stage. */
export const useSynthesisStage = () =>
  useSynthesisStore((state) => state.generationStage);

/** Get the current error. */
export const useSynthesisError = () =>
  useSynthesisStore((state) => state.error);
