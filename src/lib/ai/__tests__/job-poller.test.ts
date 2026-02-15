import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobPoller } from '../job-poller';
import type { AIJob } from '@/types/async-ai';

// ============================================================================
// Mock getAsyncJob
// ============================================================================

vi.mock('../async-processor', () => ({
  getAsyncJob: vi.fn(),
}));

import { getAsyncJob } from '../async-processor';
const mockGetAsyncJob = vi.mocked(getAsyncJob);

// ============================================================================
// Helpers
// ============================================================================

function makeJob(overrides: Partial<AIJob> = {}): AIJob {
  return {
    id: 'job-test',
    type: 'document-analysis',
    owner: 'alice.testnet',
    params: { type: 'document-analysis', documentIds: ['doc-1'], depth: 'standard' },
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

describe('JobPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetAsyncJob.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onStatusChange on first poll', async () => {
    const onStatusChange = vi.fn();
    mockGetAsyncJob.mockResolvedValue(makeJob({ status: 'pending', progress: 0 }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onStatusChange,
    });
    poller.start();

    // Advance past first poll
    await vi.advanceTimersByTimeAsync(100);

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));

    poller.stop();
  });

  it('calls onStatusChange when status changes', async () => {
    const onStatusChange = vi.fn();
    mockGetAsyncJob
      .mockResolvedValueOnce(makeJob({ status: 'pending' }))
      .mockResolvedValueOnce(makeJob({ status: 'processing', progress: 20 }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onStatusChange,
    });
    poller.start();

    // First poll
    await vi.advanceTimersByTimeAsync(100);
    expect(onStatusChange).toHaveBeenCalledTimes(1);

    // Second poll (status changed)
    await vi.advanceTimersByTimeAsync(200);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'processing' })
    );

    poller.stop();
  });

  it('stops on terminal status (completed)', async () => {
    const onComplete = vi.fn();
    mockGetAsyncJob
      .mockResolvedValueOnce(makeJob({ status: 'processing' }))
      .mockResolvedValueOnce(makeJob({ status: 'completed', progress: 100 }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onComplete,
    });
    poller.start();

    // First poll
    await vi.advanceTimersByTimeAsync(100);
    expect(poller.isRunning()).toBe(true);

    // Second poll (completed — poller stops)
    await vi.advanceTimersByTimeAsync(200);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(false);
  });

  it('stops on terminal status (failed)', async () => {
    const onStatusChange = vi.fn();
    mockGetAsyncJob
      .mockResolvedValueOnce(makeJob({ status: 'processing' }))
      .mockResolvedValueOnce(makeJob({ status: 'failed', error: 'AI error' }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onStatusChange,
    });
    poller.start();

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    expect(poller.isRunning()).toBe(false);
  });

  it('applies backoff when status unchanged', async () => {
    mockGetAsyncJob.mockResolvedValue(makeJob({ status: 'processing' }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      backoffMultiplier: 2,
      maxIntervalMs: 1000,
    });
    poller.start();

    // First poll at 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(mockGetAsyncJob).toHaveBeenCalledTimes(1);

    // Second poll at 100 + 200 = 300ms (backed off)
    await vi.advanceTimersByTimeAsync(200);
    expect(mockGetAsyncJob).toHaveBeenCalledTimes(2);

    // Third poll at 300 + 400 = 700ms (backed off again)
    await vi.advanceTimersByTimeAsync(400);
    expect(mockGetAsyncJob).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it('handles network errors gracefully (tolerates < 3)', async () => {
    const onError = vi.fn();
    mockGetAsyncJob
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makeJob({ status: 'processing' }));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onError,
    });
    poller.start();

    // First poll fails
    await vi.advanceTimersByTimeAsync(100);
    expect(onError).not.toHaveBeenCalled(); // Tolerated
    expect(poller.isRunning()).toBe(true);

    // Second poll succeeds
    await vi.advanceTimersByTimeAsync(200);
    expect(poller.isRunning()).toBe(true);

    poller.stop();
  });

  it('calls onError after 3 consecutive failures', async () => {
    const onError = vi.fn();
    mockGetAsyncJob.mockRejectedValue(new Error('Network error'));

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onError,
    });
    poller.start();

    // 3 consecutive failures
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(false);
  });

  it('calls onTimeout after max attempts', async () => {
    const onTimeout = vi.fn();
    mockGetAsyncJob.mockResolvedValue(makeJob({ status: 'processing' }));

    const poller = new JobPoller('job-test', {
      intervalMs: 10,
      maxPollAttempts: 3,
      backoffMultiplier: 1,
      onTimeout,
    });
    poller.start();

    // Exhaust all attempts
    await vi.advanceTimersByTimeAsync(10); // attempt 1
    await vi.advanceTimersByTimeAsync(10); // attempt 2
    await vi.advanceTimersByTimeAsync(10); // attempt 3
    await vi.advanceTimersByTimeAsync(10); // attempt 4 — exceeds max

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(false);
  });

  it('stop() clears timer and sets running to false', () => {
    const poller = new JobPoller('job-test', { intervalMs: 100 });
    poller.start();

    expect(poller.isRunning()).toBe(true);

    poller.stop();

    expect(poller.isRunning()).toBe(false);
  });

  it('start() is idempotent when already running', async () => {
    mockGetAsyncJob.mockResolvedValue(makeJob({ status: 'processing' }));

    const poller = new JobPoller('job-test', { intervalMs: 100 });
    poller.start();
    poller.start(); // no-op

    await vi.advanceTimersByTimeAsync(100);

    // Should only have one timer active
    expect(mockGetAsyncJob).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('calls onCheckpoint when checkpoint timestamp changes', async () => {
    const onCheckpoint = vi.fn();
    mockGetAsyncJob
      .mockResolvedValueOnce(
        makeJob({
          status: 'processing',
          checkpoint: {
            progress: 30,
            step: 'Step 1',
            state: '{}',
            timestamp: '2024-01-15T10:00:00Z',
          },
        })
      )
      .mockResolvedValueOnce(
        makeJob({
          status: 'processing',
          checkpoint: {
            progress: 60,
            step: 'Step 2',
            state: '{}',
            timestamp: '2024-01-15T10:01:00Z',
          },
        })
      );

    const poller = new JobPoller('job-test', {
      intervalMs: 100,
      onCheckpoint,
    });
    poller.start();

    await vi.advanceTimersByTimeAsync(100);
    expect(onCheckpoint).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(onCheckpoint).toHaveBeenCalledTimes(2);
    expect(onCheckpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({ step: 'Step 2', progress: 60 })
    );

    poller.stop();
  });

  it('getLastStatus returns null before first poll', () => {
    const poller = new JobPoller('job-test');
    expect(poller.getLastStatus()).toBeNull();
  });

  it('getLastStatus returns last observed status', async () => {
    mockGetAsyncJob.mockResolvedValueOnce(makeJob({ status: 'processing' }));

    const poller = new JobPoller('job-test', { intervalMs: 100 });
    poller.start();

    await vi.advanceTimersByTimeAsync(100);
    expect(poller.getLastStatus()).toBe('processing');

    poller.stop();
  });
});
