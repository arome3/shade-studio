import { describe, it, expect, beforeEach } from 'vitest';
import { useAsyncAIStore } from '../async-ai-store';
import type { AIJob, AIJobResult } from '@/types/async-ai';

// ============================================================================
// Helpers
// ============================================================================

function makeJob(overrides: Partial<AIJob> = {}): AIJob {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    type: 'document-analysis',
    owner: 'alice.testnet',
    params: {
      type: 'document-analysis',
      documentIds: ['doc-1'],
      depth: 'standard',
    },
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('async-ai-store', () => {
  beforeEach(() => {
    useAsyncAIStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useAsyncAIStore.getState();
    expect(state.jobs).toEqual({});
    expect(state.jobOrder).toEqual([]);
    expect(state.lastFetchedAt).toBeNull();
    expect(state.isFetching).toBe(false);
    expect(state.error).toBeNull();
  });

  describe('setJobs', () => {
    it('replaces all jobs and sets order + lastFetchedAt', () => {
      const job1 = makeJob({ id: 'job-1' });
      const job2 = makeJob({ id: 'job-2' });

      useAsyncAIStore.getState().setJobs([job1, job2]);
      const state = useAsyncAIStore.getState();

      expect(Object.keys(state.jobs)).toHaveLength(2);
      expect(state.jobs['job-1']).toEqual(job1);
      expect(state.jobs['job-2']).toEqual(job2);
      expect(state.jobOrder).toEqual(['job-1', 'job-2']);
      expect(state.lastFetchedAt).toBeGreaterThan(0);
      expect(state.isFetching).toBe(false);
    });
  });

  describe('addJob', () => {
    it('prepends job to order', () => {
      const job1 = makeJob({ id: 'job-1' });
      const job2 = makeJob({ id: 'job-2' });

      useAsyncAIStore.getState().addJob(job1);
      useAsyncAIStore.getState().addJob(job2);

      const state = useAsyncAIStore.getState();
      expect(state.jobOrder).toEqual(['job-2', 'job-1']); // newest first
      expect(state.jobs['job-1']).toEqual(job1);
      expect(state.jobs['job-2']).toEqual(job2);
    });
  });

  describe('updateJob', () => {
    it('merges partial update into existing job', () => {
      const job = makeJob({ id: 'job-1', progress: 0, status: 'pending' });
      useAsyncAIStore.getState().addJob(job);

      useAsyncAIStore.getState().updateJob('job-1', {
        status: 'processing',
        progress: 30,
      });

      const updated = useAsyncAIStore.getState().jobs['job-1'];
      expect(updated?.status).toBe('processing');
      expect(updated?.progress).toBe(30);
      // Other fields preserved
      expect(updated?.owner).toBe('alice.testnet');
    });

    it('is a no-op for non-existent job', () => {
      const before = useAsyncAIStore.getState();
      useAsyncAIStore.getState().updateJob('nonexistent', { progress: 50 });
      const after = useAsyncAIStore.getState();
      expect(after.jobs).toEqual(before.jobs);
    });
  });

  describe('removeJob', () => {
    it('removes from record and order', () => {
      const job = makeJob({ id: 'job-1' });
      useAsyncAIStore.getState().addJob(job);

      useAsyncAIStore.getState().removeJob('job-1');

      const state = useAsyncAIStore.getState();
      expect(state.jobs['job-1']).toBeUndefined();
      expect(state.jobOrder).not.toContain('job-1');
    });
  });

  describe('completeJob', () => {
    it('sets status=completed, result, progress=100, and completedAt', () => {
      const job = makeJob({ id: 'job-1', status: 'processing', progress: 80 });
      useAsyncAIStore.getState().addJob(job);

      const result: AIJobResult = {
        type: 'document-analysis',
        data: { findings: ['finding-1'] },
        metadata: {
          totalDuration: 5000,
          checkpointCount: 2,
          tokensUsed: 1200,
        },
      };

      useAsyncAIStore.getState().completeJob('job-1', result);

      const completed = useAsyncAIStore.getState().jobs['job-1'];
      expect(completed?.status).toBe('completed');
      expect(completed?.progress).toBe(100);
      expect(completed?.result).toEqual(result);
      expect(completed?.completedAt).toBeDefined();
    });

    it('is a no-op for non-existent job', () => {
      const result: AIJobResult = {
        type: 'document-analysis',
        data: {},
        metadata: { totalDuration: 0, checkpointCount: 0, tokensUsed: 0 },
      };
      useAsyncAIStore.getState().completeJob('nonexistent', result);
      expect(useAsyncAIStore.getState().jobs['nonexistent']).toBeUndefined();
    });
  });

  describe('failJob', () => {
    it('sets status=failed and error message', () => {
      const job = makeJob({ id: 'job-1', status: 'processing' });
      useAsyncAIStore.getState().addJob(job);

      useAsyncAIStore.getState().failJob('job-1', 'Model inference timeout');

      const failed = useAsyncAIStore.getState().jobs['job-1'];
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('Model inference timeout');
    });
  });

  describe('setFetching', () => {
    it('sets isFetching and clears error when true', () => {
      useAsyncAIStore.getState().setError('previous error');
      useAsyncAIStore.getState().setFetching(true);

      const state = useAsyncAIStore.getState();
      expect(state.isFetching).toBe(true);
      expect(state.error).toBeNull();
    });

    it('sets isFetching to false without clearing error', () => {
      useAsyncAIStore.getState().setError('some error');
      useAsyncAIStore.getState().setFetching(false);

      const state = useAsyncAIStore.getState();
      expect(state.isFetching).toBe(false);
      expect(state.error).toBe('some error');
    });
  });

  describe('setError', () => {
    it('sets error and clears isFetching', () => {
      useAsyncAIStore.getState().setFetching(true);
      useAsyncAIStore.getState().setError('Network error');

      const state = useAsyncAIStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isFetching).toBe(false);
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useAsyncAIStore.getState().setError('some error');
      useAsyncAIStore.getState().clearError();
      expect(useAsyncAIStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      const job = makeJob({ id: 'job-1' });
      useAsyncAIStore.getState().addJob(job);
      useAsyncAIStore.getState().setError('error');

      useAsyncAIStore.getState().reset();

      const state = useAsyncAIStore.getState();
      expect(state.jobs).toEqual({});
      expect(state.jobOrder).toEqual([]);
      expect(state.lastFetchedAt).toBeNull();
      expect(state.isFetching).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('order maintenance', () => {
    it('maintains newest-first order with addJob', () => {
      useAsyncAIStore.getState().addJob(makeJob({ id: 'old' }));
      useAsyncAIStore.getState().addJob(makeJob({ id: 'middle' }));
      useAsyncAIStore.getState().addJob(makeJob({ id: 'newest' }));

      const order = useAsyncAIStore.getState().jobOrder;
      expect(order).toEqual(['newest', 'middle', 'old']);
    });

    it('preserves remaining order after remove', () => {
      useAsyncAIStore.getState().addJob(makeJob({ id: 'a' }));
      useAsyncAIStore.getState().addJob(makeJob({ id: 'b' }));
      useAsyncAIStore.getState().addJob(makeJob({ id: 'c' }));

      useAsyncAIStore.getState().removeJob('b');

      const order = useAsyncAIStore.getState().jobOrder;
      expect(order).toEqual(['c', 'a']);
    });
  });
});
