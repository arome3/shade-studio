'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from './use-wallet';
import {
  useAsyncAIStore,
  useAsyncJobs,
  useAsyncJobOrder,
  useAsyncJobsFetching,
  useAsyncJobsError,
} from '@/stores/async-ai-store';
import {
  getAsyncJobsByOwner,
  getAsyncProcessorConfig,
  submitAsyncJob,
  cancelAsyncJob,
  AsyncAIContractPausedError,
  AsyncAIInsufficientDepositError,
  AsyncAIJobLimitError,
  AsyncAIContractError,
} from '@/lib/ai/async-processor';
import { JobPoller } from '@/lib/ai/job-poller';
import { getWalletSelector } from '@/lib/near/wallet';
import type { AIJob, AIJobParams } from '@/types/async-ai';

// ============================================================================
// Helpers
// ============================================================================

/** Classify errors into user-friendly messages. */
function classifyHookError(err: unknown, fallback: string): string {
  if (err instanceof AsyncAIContractPausedError) {
    return 'AI processing contract is currently paused. Please try again later.';
  }
  if (err instanceof AsyncAIInsufficientDepositError) {
    return `Insufficient deposit. Required: 0.01 NEAR.`;
  }
  if (err instanceof AsyncAIJobLimitError) {
    return 'You have reached the maximum number of active jobs. Wait for existing jobs to complete.';
  }
  if (err instanceof AsyncAIContractError) {
    return `Contract error: ${err.message}`;
  }
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

/** Check if a job is in an active (non-terminal) state. */
function isActiveJob(job: AIJob): boolean {
  return job.status === 'pending' || job.status === 'processing' || job.status === 'paused';
}

// ============================================================================
// Return type
// ============================================================================

export interface UseAsyncAIJobReturn {
  // Data
  jobs: AIJob[];
  activeJobs: AIJob[];
  completedJobs: AIJob[];
  trackedJob: AIJob | null;
  /** Minimum deposit in yoctoNEAR (fetched from contract config) */
  minDeposit: string;

  // State
  isFetching: boolean;
  isSubmitting: boolean;
  error: string | null;
  isConnected: boolean;
  isReady: boolean;

  // Actions
  submitJob: (params: AIJobParams) => Promise<string | null>;
  cancelJob: (jobId: string) => Promise<void>;
  trackJob: (jobId: string) => void;
  stopTracking: () => void;
  refreshJobs: () => Promise<void>;
  clearError: () => void;
  retryLastAction: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useAsyncAIJob(): UseAsyncAIJobReturn {
  const { accountId, isConnected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [minDeposit, setMinDeposit] = useState('10000000000000000000000');
  const hasFetchedRef = useRef(false);
  const retryActionRef = useRef<(() => void) | null>(null);
  const pollersRef = useRef<Map<string, JobPoller>>(new Map());

  // Store selectors
  const jobsRecord = useAsyncJobs();
  const jobOrder = useAsyncJobOrder();
  const isFetching = useAsyncJobsFetching();
  const storeError = useAsyncJobsError();

  // Store actions
  const setJobs = useAsyncAIStore((s) => s.setJobs);
  const addJob = useAsyncAIStore((s) => s.addJob);
  const updateJob = useAsyncAIStore((s) => s.updateJob);
  const removeJob = useAsyncAIStore((s) => s.removeJob);
  const completeJob = useAsyncAIStore((s) => s.completeJob);
  const setFetching = useAsyncAIStore((s) => s.setFetching);
  const setStoreError = useAsyncAIStore((s) => s.setError);

  // Combined error
  const error = storeError;

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------

  const jobs = useMemo(() => {
    return jobOrder
      .map((id) => jobsRecord[id])
      .filter((j): j is AIJob => j !== undefined);
  }, [jobsRecord, jobOrder]);

  const activeJobs = useMemo(
    () => jobs.filter(isActiveJob),
    [jobs]
  );

  const completedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'completed'),
    [jobs]
  );

  const trackedJob = trackedJobId ? (jobsRecord[trackedJobId] ?? null) : null;

  const isReady = isConnected && !!accountId;

  // --------------------------------------------------------------------------
  // Poller management
  // --------------------------------------------------------------------------

  const startPollerForJob = useCallback(
    (jobId: string) => {
      if (pollersRef.current.has(jobId)) return;

      const poller = new JobPoller(jobId, {
        onStatusChange: (job) => {
          updateJob(job.id, {
            status: job.status,
            progress: job.progress,
            checkpoint: job.checkpoint,
            error: job.error,
            updatedAt: job.updatedAt,
          });
        },
        onCheckpoint: () => {
          // Updates handled by onStatusChange
        },
        onComplete: (job) => {
          if (job.result) {
            completeJob(job.id, job.result);
          }
          pollersRef.current.delete(jobId);
        },
        onError: () => {
          pollersRef.current.delete(jobId);
        },
        onTimeout: () => {
          updateJob(jobId, { status: 'timeout' });
          pollersRef.current.delete(jobId);
        },
      });

      pollersRef.current.set(jobId, poller);
      poller.start();
    },
    [updateJob, completeJob]
  );

  const stopAllPollers = useCallback(() => {
    for (const [, poller] of pollersRef.current) {
      poller.stop();
    }
    pollersRef.current.clear();
  }, []);

  // --------------------------------------------------------------------------
  // Auto-fetch on wallet connect
  // --------------------------------------------------------------------------

  const refreshJobs = useCallback(async () => {
    if (!accountId) return;
    setFetching(true);
    try {
      // Fetch config for dynamic deposit (fire-and-forget on failure)
      getAsyncProcessorConfig()
        .then((cfg) => setMinDeposit(cfg.min_deposit))
        .catch(() => { /* keep existing default */ });

      const PAGE_LIMIT = 50;
      const MAX_PAGES = 20;
      let offset = 0;
      let page = 0;
      const allJobs: AIJob[] = [];

      while (page < MAX_PAGES) {
        const result = await getAsyncJobsByOwner(
          accountId,
          true,
          offset,
          PAGE_LIMIT
        );
        allJobs.push(...result.jobs);
        if (!result.hasMore) break;
        offset += PAGE_LIMIT;
        page++;
      }

      setJobs(allJobs);

      // Start pollers for active jobs
      for (const job of allJobs) {
        if (isActiveJob(job)) {
          startPollerForJob(job.id);
        }
      }
    } catch (err) {
      const msg = classifyHookError(err, 'Failed to fetch jobs');
      setStoreError(msg);
      retryActionRef.current = () => refreshJobs();
    }
  }, [accountId, setFetching, setJobs, setStoreError, startPollerForJob]);

  useEffect(() => {
    if (isConnected && accountId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refreshJobs();
    }
    if (!isConnected) {
      hasFetchedRef.current = false;
      stopAllPollers();
    }
  }, [isConnected, accountId, refreshJobs, stopAllPollers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllPollers();
    };
  }, [stopAllPollers]);

  // --------------------------------------------------------------------------
  // Submit job (with optimistic update)
  // --------------------------------------------------------------------------

  const submitJob = useCallback(
    async (params: AIJobParams): Promise<string | null> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return null;

      setIsSubmitting(true);
      const tempId = `temp-${Date.now()}`;

      // Optimistic: add placeholder job
      const optimisticJob: AIJob = {
        id: tempId,
        type: params.type,
        owner: accountId,
        params,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addJob(optimisticJob);

      try {
        const jobId = await submitAsyncJob(params, selector);

        // Remove placeholder, refresh to get real job
        removeJob(tempId);

        if (jobId) {
          await refreshJobs();
          return jobId;
        }
        return null;
      } catch (err) {
        // Rollback optimistic update
        removeJob(tempId);
        const msg = classifyHookError(err, 'Failed to submit job');
        setStoreError(msg);
        retryActionRef.current = () => submitJob(params);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [accountId, addJob, removeJob, refreshJobs, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Cancel job (with optimistic update)
  // --------------------------------------------------------------------------

  const cancelJob = useCallback(
    async (jobId: string) => {
      const selector = getWalletSelector();
      if (!selector) return;

      // Capture snapshot BEFORE optimistic remove
      const snapshot = useAsyncAIStore.getState().jobs[jobId];
      if (!snapshot) return; // Already removed — nothing to cancel

      // Optimistic: remove from store
      removeJob(jobId);

      // Stop poller
      const poller = pollersRef.current.get(jobId);
      if (poller) {
        poller.stop();
        pollersRef.current.delete(jobId);
      }

      try {
        await cancelAsyncJob(jobId, selector);
      } catch (err) {
        // Rollback
        if (snapshot) {
          addJob(snapshot);
          if (isActiveJob(snapshot)) {
            startPollerForJob(snapshot.id);
          }
        }
        const msg = classifyHookError(err, 'Failed to cancel job');
        setStoreError(msg);
        retryActionRef.current = () => cancelJob(jobId);
      }
    },
    [removeJob, addJob, setStoreError, startPollerForJob]
  );

  // --------------------------------------------------------------------------
  // Tracking
  // --------------------------------------------------------------------------

  const trackJob = useCallback(
    (jobId: string) => {
      setTrackedJobId(jobId);
      // Ensure poller is running for the tracked job
      startPollerForJob(jobId);
    },
    [startPollerForJob]
  );

  const stopTracking = useCallback(() => {
    setTrackedJobId(null);
  }, []);

  // --------------------------------------------------------------------------
  // Error recovery
  // --------------------------------------------------------------------------

  const clearError = useCallback(() => {
    useAsyncAIStore.getState().clearError();
    retryActionRef.current = null;
  }, []);

  const retryLastAction = useCallback(() => {
    retryActionRef.current?.();
  }, []);

  return {
    jobs,
    activeJobs,
    completedJobs,
    trackedJob,
    minDeposit,
    isFetching,
    isSubmitting,
    error,
    isConnected,
    isReady,
    submitJob,
    cancelJob,
    trackJob,
    stopTracking,
    refreshJobs,
    clearError,
    retryLastAction,
  };
}
