/**
 * Intelligence Store
 *
 * Manages daily briefing state including current briefing, history, and generation progress.
 * Uses Zustand with devtools and persist middleware.
 *
 * Privacy note: Briefing content is persisted locally but can be encrypted
 * before storage to NEAR Social.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import type {
  DailyBriefing,
  ItemStatus,
} from '@/types/intelligence';

// ============================================================================
// Constants
// ============================================================================

/** Default staleness threshold in milliseconds (12 hours) */
const DEFAULT_STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

/** Maximum days of history to keep */
const MAX_HISTORY_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

/** Intelligence store state */
export interface IntelligenceState {
  /** Current daily briefing */
  currentBriefing: DailyBriefing | null;
  /** Historical briefings keyed by date (YYYY-MM-DD) */
  briefingHistory: Record<string, DailyBriefing>;
  /** Loading state */
  isLoading: boolean;
  /** Generation progress (0-100) */
  generationProgress: number;
  /** Error message if any */
  error: string | null;
  /** Timestamp of last generation */
  lastGeneratedAt: number | null;
  /** Staleness threshold in milliseconds */
  staleThresholdMs: number;
}

/** Intelligence store actions */
export interface IntelligenceActions {
  // Briefing actions
  setBriefing: (briefing: DailyBriefing) => void;
  addToHistory: (briefing: DailyBriefing) => void;
  clearBriefing: () => void;

  // Item actions
  updateItemStatus: (itemId: string, status: ItemStatus) => void;
  markItemRead: (itemId: string) => void;
  dismissItem: (itemId: string) => void;

  // Loading/error actions
  setLoading: (loading: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // History actions
  getBriefingByDate: (date: string) => DailyBriefing | null;
  cleanupOldHistory: () => void;

  // Staleness check
  isBriefingStale: () => boolean;
  setStaleThreshold: (ms: number) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: IntelligenceState = {
  currentBriefing: null,
  briefingHistory: {},
  isLoading: false,
  generationProgress: 0,
  error: null,
  lastGeneratedAt: null,
  staleThresholdMs: DEFAULT_STALE_THRESHOLD_MS,
};

// ============================================================================
// Store
// ============================================================================

/**
 * Intelligence store combining state and actions.
 * Manages daily briefings with history and staleness tracking.
 */
export const useIntelligenceStore = create<IntelligenceState & IntelligenceActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Briefing actions
        setBriefing: (briefing: DailyBriefing) => {
          const now = Date.now();
          set(
            (state) => ({
              currentBriefing: briefing,
              briefingHistory: {
                ...state.briefingHistory,
                [briefing.date]: briefing,
              },
              lastGeneratedAt: now,
              isLoading: false,
              generationProgress: 100,
              error: null,
            }),
            false,
            'setBriefing'
          );

          // Cleanup old history after setting
          get().cleanupOldHistory();
        },

        addToHistory: (briefing: DailyBriefing) =>
          set(
            (state) => ({
              briefingHistory: {
                ...state.briefingHistory,
                [briefing.date]: briefing,
              },
            }),
            false,
            'addToHistory'
          ),

        clearBriefing: () =>
          set(
            {
              currentBriefing: null,
              generationProgress: 0,
            },
            false,
            'clearBriefing'
          ),

        // Item actions
        updateItemStatus: (itemId: string, status: ItemStatus) =>
          set(
            (state) => {
              if (!state.currentBriefing) return state;

              const updatedItems = state.currentBriefing.items.map((item) =>
                item.id === itemId
                  ? { ...item, status, isRead: true }
                  : item
              );

              const updatedBriefing: DailyBriefing = {
                ...state.currentBriefing,
                items: updatedItems,
              };

              return {
                currentBriefing: updatedBriefing,
                briefingHistory: {
                  ...state.briefingHistory,
                  [updatedBriefing.date]: updatedBriefing,
                },
              };
            },
            false,
            'updateItemStatus'
          ),

        markItemRead: (itemId: string) =>
          set(
            (state) => {
              if (!state.currentBriefing) return state;

              const updatedItems = state.currentBriefing.items.map((item) =>
                item.id === itemId ? { ...item, isRead: true } : item
              );

              const updatedBriefing: DailyBriefing = {
                ...state.currentBriefing,
                items: updatedItems,
              };

              return {
                currentBriefing: updatedBriefing,
                briefingHistory: {
                  ...state.briefingHistory,
                  [updatedBriefing.date]: updatedBriefing,
                },
              };
            },
            false,
            'markItemRead'
          ),

        dismissItem: (itemId: string) =>
          set(
            (state) => {
              if (!state.currentBriefing) return state;

              const updatedItems = state.currentBriefing.items.map((item) =>
                item.id === itemId ? { ...item, isDismissed: true } : item
              );

              const updatedBriefing: DailyBriefing = {
                ...state.currentBriefing,
                items: updatedItems,
              };

              return {
                currentBriefing: updatedBriefing,
                briefingHistory: {
                  ...state.briefingHistory,
                  [updatedBriefing.date]: updatedBriefing,
                },
              };
            },
            false,
            'dismissItem'
          ),

        // Loading/error actions
        setLoading: (loading: boolean) =>
          set(
            {
              isLoading: loading,
              ...(loading ? { error: null, generationProgress: 0 } : {}),
            },
            false,
            'setLoading'
          ),

        setGenerationProgress: (progress: number) =>
          set(
            { generationProgress: Math.min(100, Math.max(0, progress)) },
            false,
            'setGenerationProgress'
          ),

        setError: (error: string | null) =>
          set(
            {
              error,
              isLoading: false,
              generationProgress: 0,
            },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        // History actions
        getBriefingByDate: (date: string) => {
          return get().briefingHistory[date] || null;
        },

        cleanupOldHistory: () =>
          set(
            (state) => {
              const cutoffDate = subDays(new Date(), MAX_HISTORY_DAYS);
              const cleanedHistory: Record<string, DailyBriefing> = {};

              Object.entries(state.briefingHistory).forEach(([date, briefing]) => {
                try {
                  const briefingDate = parseISO(date);
                  if (isAfter(briefingDate, cutoffDate)) {
                    cleanedHistory[date] = briefing;
                  }
                } catch {
                  // Skip invalid dates
                }
              });

              return { briefingHistory: cleanedHistory };
            },
            false,
            'cleanupOldHistory'
          ),

        // Staleness check
        isBriefingStale: () => {
          const state = get();
          const { currentBriefing, lastGeneratedAt, staleThresholdMs } = state;

          // No briefing = stale
          if (!currentBriefing) return true;

          // Different date = stale
          const today = format(new Date(), 'yyyy-MM-dd');
          if (currentBriefing.date !== today) return true;

          // Check time threshold
          if (!lastGeneratedAt) return true;
          const timeSinceGeneration = Date.now() - lastGeneratedAt;
          return timeSinceGeneration > staleThresholdMs;
        },

        setStaleThreshold: (ms: number) =>
          set({ staleThresholdMs: ms }, false, 'setStaleThreshold'),

        // Reset
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'intelligence-store',
        // Persist history and threshold, not transient states
        partialize: (state) => ({
          briefingHistory: state.briefingHistory,
          staleThresholdMs: state.staleThresholdMs,
        }),
      }
    ),
    {
      name: 'intelligence-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get the current daily briefing.
 */
export const useCurrentBriefing = () =>
  useIntelligenceStore((state) => state.currentBriefing);

/**
 * Check if briefing is loading.
 */
export const useIsBriefingLoading = () =>
  useIntelligenceStore((state) => state.isLoading);

/**
 * Get the generation progress (0-100).
 */
export const useGenerationProgress = () =>
  useIntelligenceStore((state) => state.generationProgress);

/**
 * Get the current error.
 */
export const useBriefingError = () =>
  useIntelligenceStore((state) => state.error);

/**
 * Get all briefing history as an array sorted by date (newest first).
 */
export const useBriefingHistory = () =>
  useIntelligenceStore((state) =>
    Object.values(state.briefingHistory).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  );

/**
 * Get briefing items from current briefing.
 */
export const useBriefingItems = () =>
  useIntelligenceStore((state) => state.currentBriefing?.items ?? []);

/**
 * Get unread/pending items count.
 */
export const usePendingItemsCount = () =>
  useIntelligenceStore((state) => {
    const items = state.currentBriefing?.items ?? [];
    return items.filter(
      (item) => !item.isDismissed && (!item.status || item.status === 'pending')
    ).length;
  });

/**
 * Get grant pipeline items.
 */
export const useGrantPipeline = () =>
  useIntelligenceStore((state) => state.currentBriefing?.grantPipeline ?? []);

/**
 * Get recommendations.
 */
export const useRecommendations = () =>
  useIntelligenceStore((state) => state.currentBriefing?.recommendations ?? []);

/**
 * Get briefing attestation.
 */
export const useBriefingAttestation = () =>
  useIntelligenceStore((state) => state.currentBriefing?.attestation);

/**
 * Check if briefing needs refresh.
 */
export const useNeedsBriefingRefresh = () =>
  useIntelligenceStore(() => {
    const store = useIntelligenceStore.getState();
    return store.isBriefingStale();
  });
