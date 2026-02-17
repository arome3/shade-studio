import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — must be before imports; vi.mock is hoisted, so factories
// cannot reference variables declared in this scope.
// ---------------------------------------------------------------------------

vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/stores/async-ai-store', () => {
  const storeActions = {
    jobs: {} as Record<string, unknown>,
    jobOrder: [] as string[],
    lastFetchedAt: null as number | null,
    isFetching: false,
    error: null as string | null,
    setJobs: vi.fn(),
    addJob: vi.fn(),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setFetching: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    reset: vi.fn(),
  };

  const store = Object.assign(
    vi.fn((selector: (s: typeof storeActions) => unknown) =>
      selector(storeActions)
    ),
    { getState: vi.fn(() => storeActions) }
  );

  return {
    useAsyncAIStore: store,
    useAsyncJobs: vi.fn(() => storeActions.jobs),
    useAsyncJobOrder: vi.fn(() => storeActions.jobOrder),
    useAsyncJobsFetching: vi.fn(() => storeActions.isFetching),
    useAsyncJobsError: vi.fn(() => storeActions.error),
    __storeActions: storeActions,
  };
});

vi.mock('@/lib/ai/async-processor', () => ({
  getAsyncJobsByOwner: vi.fn(),
  getAsyncProcessorConfig: vi.fn(),
  submitAsyncJob: vi.fn(),
  cancelAsyncJob: vi.fn(),
  AsyncAIContractPausedError: class extends Error {
    constructor() {
      super('Contract is paused');
      this.name = 'AsyncAIContractPausedError';
    }
  },
  AsyncAIInsufficientDepositError: class extends Error {
    required: string;
    attached: string;
    constructor(r: string, a: string) {
      super(`Insufficient deposit: required ${r}, attached ${a}`);
      this.name = 'AsyncAIInsufficientDepositError';
      this.required = r;
      this.attached = a;
    }
  },
  AsyncAIJobLimitError: class extends Error {
    constructor(l: string) {
      super(`Active job limit exceeded: maximum ${l} concurrent jobs`);
      this.name = 'AsyncAIJobLimitError';
    }
  },
  AsyncAIContractError: class extends Error {
    method: string;
    constructor(m: string, msg: string) {
      super(`Async AI contract error: ${m} — ${msg}`);
      this.name = 'AsyncAIContractError';
      this.method = m;
    }
  },
}));

vi.mock('@/lib/ai/job-poller', () => ({
  JobPoller: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => false),
  })),
}));

vi.mock('@/lib/near/wallet', () => ({
  getWalletSelector: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useWallet } from '../use-wallet';
import { useAsyncAIJob } from '../use-async-ai-job';
import { useAsyncAIStore } from '@/stores/async-ai-store';
import {
  getAsyncJobsByOwner,
  getAsyncProcessorConfig,
  submitAsyncJob,
  cancelAsyncJob,
} from '@/lib/ai/async-processor';
import { getWalletSelector } from '@/lib/near/wallet';
import type { AIJob } from '@/types/async-ai';

// Access the shared mock state via the store module
const mockStoreActions = (await import('@/stores/async-ai-store') as any).__storeActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockWallet = useWallet as ReturnType<typeof vi.fn>;
const mockGetJobs = getAsyncJobsByOwner as ReturnType<typeof vi.fn>;
const mockGetConfig = getAsyncProcessorConfig as ReturnType<typeof vi.fn>;
const mockSubmit = submitAsyncJob as ReturnType<typeof vi.fn>;
const mockCancel = cancelAsyncJob as ReturnType<typeof vi.fn>;
const mockGetSelector = getWalletSelector as ReturnType<typeof vi.fn>;
const mockStoreGetState = (useAsyncAIStore as unknown as { getState: ReturnType<typeof vi.fn> }).getState;

function makeJob(overrides: Partial<AIJob> = {}): AIJob {
  return {
    id: 'job-abc',
    type: 'document-analysis',
    owner: 'alice.testnet',
    params: { type: 'document-analysis', documentIds: ['doc-1'], depth: 'standard' },
    status: 'pending',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAsyncAIJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreActions.jobs = {};
    mockStoreActions.jobOrder = [];
    mockStoreActions.isFetching = false;
    mockStoreActions.error = null;
    mockWallet.mockReturnValue({ accountId: null, isConnected: false });
    mockGetSelector.mockReturnValue(null);
    mockGetConfig.mockResolvedValue({
      min_deposit: '10000000000000000000000',
      max_active_jobs_per_user: 5,
      job_timeout_ns: '600000000000',
    });
    mockStoreGetState.mockReturnValue(mockStoreActions);
  });

  // -------------------------------------------------------------------------
  // 1. Disconnected state
  // -------------------------------------------------------------------------

  it('returns isConnected: false when wallet disconnected', () => {
    const { result } = renderHook(() => useAsyncAIJob());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.jobs).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 2. Empty state
  // -------------------------------------------------------------------------

  it('returns empty arrays when no jobs', () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });

    const { result } = renderHook(() => useAsyncAIJob());

    expect(result.current.jobs).toEqual([]);
    expect(result.current.activeJobs).toEqual([]);
    expect(result.current.completedJobs).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 3. Auto-fetch on connect
  // -------------------------------------------------------------------------

  it('auto-fetches on wallet connect (once)', async () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });

    renderHook(() => useAsyncAIJob());

    await waitFor(() => {
      expect(mockGetJobs).toHaveBeenCalledTimes(1);
      expect(mockGetJobs).toHaveBeenCalledWith('alice.testnet', true, 0, 50);
    });
  });

  // -------------------------------------------------------------------------
  // 4. No re-fetch on re-render
  // -------------------------------------------------------------------------

  it('does not re-fetch on subsequent renders', async () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });

    const { rerender } = renderHook(() => useAsyncAIJob());

    await waitFor(() => expect(mockGetJobs).toHaveBeenCalledTimes(1));

    rerender();
    rerender();

    // Still only 1 call
    expect(mockGetJobs).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 5. Submit adds optimistic job and removes on success
  // -------------------------------------------------------------------------

  it('submitJob adds optimistic job, removes on success, refreshes', async () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });
    mockSubmit.mockResolvedValue('job-new-123');

    const { result } = renderHook(() => useAsyncAIJob());

    await waitFor(() => expect(mockGetJobs).toHaveBeenCalledTimes(1));

    let jobId: string | null = null;
    await act(async () => {
      jobId = await result.current.submitJob({
        type: 'document-analysis',
        documentIds: ['doc-1'],
        depth: 'standard',
      });
    });

    expect(jobId).toBe('job-new-123');
    expect(mockStoreActions.addJob).toHaveBeenCalledTimes(1);
    expect(mockStoreActions.removeJob).toHaveBeenCalledTimes(1);
    // refreshJobs called after submit
    expect(mockGetJobs).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 6. Submit rolls back on error
  // -------------------------------------------------------------------------

  it('submitJob rolls back optimistic job on error', async () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });
    mockSubmit.mockRejectedValue(new Error('TX failed'));

    const { result } = renderHook(() => useAsyncAIJob());

    await waitFor(() => expect(mockGetJobs).toHaveBeenCalledTimes(1));

    let jobId: string | null = null;
    await act(async () => {
      jobId = await result.current.submitJob({
        type: 'document-analysis',
        documentIds: ['doc-1'],
        depth: 'standard',
      });
    });

    expect(jobId).toBeNull();
    expect(mockStoreActions.addJob).toHaveBeenCalledTimes(1);
    expect(mockStoreActions.removeJob).toHaveBeenCalledTimes(1);
    expect(mockStoreActions.setError).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 7. Cancel removes job optimistically, rolls back on error
  // -------------------------------------------------------------------------

  it('cancelJob rolls back on error', async () => {
    const testJob = makeJob({ id: 'job-cancel-1' });
    mockStoreActions.jobs = { 'job-cancel-1': testJob };
    mockStoreGetState.mockReturnValue(mockStoreActions);

    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });
    mockCancel.mockRejectedValue(new Error('Cancel failed'));

    const { result } = renderHook(() => useAsyncAIJob());

    await act(async () => {
      await result.current.cancelJob('job-cancel-1');
    });

    expect(mockStoreActions.removeJob).toHaveBeenCalledWith('job-cancel-1');
    expect(mockStoreActions.addJob).toHaveBeenCalled();
    expect(mockStoreActions.setError).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 8. Cancel captures snapshot before remove (Issue #9 verification)
  // -------------------------------------------------------------------------

  it('cancelJob captures snapshot before optimistic remove', async () => {
    const testJob = makeJob({ id: 'job-snap' });
    mockStoreActions.jobs = { 'job-snap': testJob };
    mockStoreGetState.mockReturnValue(mockStoreActions);

    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });
    mockCancel.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAsyncAIJob());

    await act(async () => {
      await result.current.cancelJob('job-snap');
    });

    expect(mockStoreGetState).toHaveBeenCalled();
    expect(mockStoreActions.removeJob).toHaveBeenCalledWith('job-snap');
  });

  // -------------------------------------------------------------------------
  // 9. Cancel guard: skip if job already removed
  // -------------------------------------------------------------------------

  it('cancelJob skips if job already removed from store', async () => {
    mockStoreActions.jobs = {};
    mockStoreGetState.mockReturnValue(mockStoreActions);

    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });

    const { result } = renderHook(() => useAsyncAIJob());

    await act(async () => {
      await result.current.cancelJob('nonexistent-job');
    });

    expect(mockStoreActions.removeJob).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 10. Error classification for known types
  // -------------------------------------------------------------------------

  it('classifies contract paused error', async () => {
    mockWallet.mockReturnValue({ accountId: 'alice.testnet', isConnected: true });
    mockGetSelector.mockReturnValue({ wallet: vi.fn() });
    mockGetJobs.mockResolvedValue({ jobs: [], total: 0, hasMore: false });

    const { AsyncAIContractPausedError } = await import('@/lib/ai/async-processor');
    mockSubmit.mockRejectedValue(new AsyncAIContractPausedError());

    const { result } = renderHook(() => useAsyncAIJob());
    await waitFor(() => expect(mockGetJobs).toHaveBeenCalled());

    await act(async () => {
      await result.current.submitJob({
        type: 'document-analysis',
        documentIds: ['doc-1'],
        depth: 'standard',
      });
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith(
      expect.stringContaining('paused')
    );
  });

  // -------------------------------------------------------------------------
  // 11. clearError resets error state
  // -------------------------------------------------------------------------

  it('clearError resets error state', () => {
    mockWallet.mockReturnValue({ accountId: null, isConnected: false });

    const { result } = renderHook(() => useAsyncAIJob());

    act(() => {
      result.current.clearError();
    });

    expect(mockStoreActions.clearError).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 12. retryLastAction is safe when no action saved
  // -------------------------------------------------------------------------

  it('retryLastAction is callable without error when no action saved', () => {
    mockWallet.mockReturnValue({ accountId: null, isConnected: false });

    const { result } = renderHook(() => useAsyncAIJob());

    act(() => {
      result.current.retryLastAction();
    });
  });
});
