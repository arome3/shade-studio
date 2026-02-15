/**
 * Async AI Job Store
 *
 * Manages async AI pipeline job state. Follows the same Zustand v5 pattern
 * as credential-store.ts: devtools + persist middleware with partialize.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AIJob, AIJobResult } from '@/types/async-ai';

// ============================================================================
// Types
// ============================================================================

export interface AsyncAIState {
  /** Jobs keyed by ID (stable reference for O(1) lookup) */
  jobs: Record<string, AIJob>;
  /** Job IDs in newest-first order */
  jobOrder: string[];
  /** Timestamp of last fetch from chain */
  lastFetchedAt: number | null;
  /** Whether jobs are currently being fetched */
  isFetching: boolean;
  /** Error message if any */
  error: string | null;
}

export interface AsyncAIActions {
  setJobs: (jobs: AIJob[]) => void;
  addJob: (job: AIJob) => void;
  updateJob: (id: string, partial: Partial<AIJob>) => void;
  removeJob: (id: string) => void;
  completeJob: (id: string, result: AIJobResult) => void;
  failJob: (id: string, error: string) => void;
  setFetching: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AsyncAIState = {
  jobs: {},
  jobOrder: [],
  lastFetchedAt: null,
  isFetching: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useAsyncAIStore = create<AsyncAIState & AsyncAIActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setJobs: (jobs: AIJob[]) =>
          set(
            () => {
              const record: Record<string, AIJob> = {};
              const order: string[] = [];
              for (const job of jobs) {
                record[job.id] = job;
                order.push(job.id);
              }
              return {
                jobs: record,
                jobOrder: order,
                lastFetchedAt: Date.now(),
                isFetching: false,
              };
            },
            false,
            'setJobs'
          ),

        addJob: (job: AIJob) =>
          set(
            (state) => ({
              jobs: { ...state.jobs, [job.id]: job },
              jobOrder: [job.id, ...state.jobOrder],
            }),
            false,
            'addJob'
          ),

        updateJob: (id: string, partial: Partial<AIJob>) =>
          set(
            (state) => {
              const existing = state.jobs[id];
              if (!existing) return state;
              return {
                jobs: {
                  ...state.jobs,
                  [id]: { ...existing, ...partial },
                },
              };
            },
            false,
            'updateJob'
          ),

        removeJob: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remaining } = state.jobs;
              return {
                jobs: remaining,
                jobOrder: state.jobOrder.filter((jid) => jid !== id),
              };
            },
            false,
            'removeJob'
          ),

        completeJob: (id: string, result: AIJobResult) =>
          set(
            (state) => {
              const existing = state.jobs[id];
              if (!existing) return state;
              return {
                jobs: {
                  ...state.jobs,
                  [id]: {
                    ...existing,
                    status: 'completed' as const,
                    progress: 100,
                    result,
                    completedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                },
              };
            },
            false,
            'completeJob'
          ),

        failJob: (id: string, error: string) =>
          set(
            (state) => {
              const existing = state.jobs[id];
              if (!existing) return state;
              return {
                jobs: {
                  ...state.jobs,
                  [id]: {
                    ...existing,
                    status: 'failed' as const,
                    error,
                    updatedAt: new Date().toISOString(),
                  },
                },
              };
            },
            false,
            'failJob'
          ),

        setFetching: (fetching: boolean) =>
          set(
            { isFetching: fetching, ...(fetching ? { error: null } : {}) },
            false,
            'setFetching'
          ),

        setError: (error: string | null) =>
          set(
            { error, isFetching: false },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        reset: () =>
          set(initialState, false, 'reset'),
      }),
      {
        name: 'async-ai-store',
        partialize: (state) => ({
          jobs: state.jobs,
          jobOrder: state.jobOrder,
          lastFetchedAt: state.lastFetchedAt,
        }),
      }
    ),
    {
      name: 'async-ai-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the jobs record. */
export const useAsyncJobs = () =>
  useAsyncAIStore((state) => state.jobs);

/** Get a single job by ID. */
export const useAsyncJobById = (id: string) =>
  useAsyncAIStore((state) => state.jobs[id] ?? null);

/** Get the job order array. */
export const useAsyncJobOrder = () =>
  useAsyncAIStore((state) => state.jobOrder);

/** Check if jobs are being fetched. */
export const useAsyncJobsFetching = () =>
  useAsyncAIStore((state) => state.isFetching);

/** Get the current error. */
export const useAsyncJobsError = () =>
  useAsyncAIStore((state) => state.error);
