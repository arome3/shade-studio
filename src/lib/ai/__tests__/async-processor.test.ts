import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAsyncJob,
  getAsyncJobsByOwner,
  getAsyncProcessorStats,
  getPendingJobCount,
  clearAsyncProcessorCache,
  classifyContractError,
  _parseTransactionOutcome,
  AsyncAIContractPausedError,
  AsyncAIInsufficientDepositError,
  AsyncAIJobLimitError,
  AsyncAIContractError,
} from '../async-processor';

// ============================================================================
// Mock fetch
// ============================================================================

const originalFetch = globalThis.fetch;

function mockRPCResponse(result: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(result));
  return {
    ok: true,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'view',
      result: {
        result: Array.from(bytes),
      },
    }),
  };
}

function mockRPCError(message: string) {
  return {
    ok: true,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'view',
      error: { message },
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('async-processor contract client', () => {
  beforeEach(() => {
    clearAsyncProcessorCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getAsyncJob', () => {
    it('maps snake_case response to camelCase AIJob', async () => {
      const rawJob = {
        id: 'job-abc123',
        job_type: 'document-analysis',
        owner: 'alice.testnet',
        params: '{"type":"document-analysis","documentIds":["doc-1"],"depth":"standard"}',
        status: 'processing',
        progress: 45,
        checkpoint: {
          progress: 45,
          step: 'Analyzing section 2/4',
          state: '{"section":2}',
          timestamp: 1700000000000000000,
        },
        result: null,
        error: null,
        attestation: null,
        created_at: 1700000000000000000,
        updated_at: 1700000050000000000,
        completed_at: null,
        worker: 'worker1.testnet',
      };

      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(rawJob));

      const job = await getAsyncJob('job-abc123');
      expect(job).not.toBeNull();
      expect(job!.id).toBe('job-abc123');
      expect(job!.type).toBe('document-analysis');
      expect(job!.owner).toBe('alice.testnet');
      expect(job!.status).toBe('processing');
      expect(job!.progress).toBe(45);
      expect(job!.createdAt).toContain('2023');
      expect(job!.checkpoint).toBeDefined();
      expect(job!.checkpoint!.step).toBe('Analyzing section 2/4');
      expect(job!.params).toEqual({
        type: 'document-analysis',
        documentIds: ['doc-1'],
        depth: 'standard',
      });
    });

    it('returns null for missing job', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(null));

      const job = await getAsyncJob('nonexistent');
      expect(job).toBeNull();
    });
  });

  describe('getAsyncJobsByOwner', () => {
    it('maps paginated response correctly', async () => {
      const rawResponse = {
        jobs: [
          {
            id: 'job-1',
            job_type: 'proposal-review',
            owner: 'alice.testnet',
            params: '{"type":"proposal-review","proposalId":"p1","grantProgram":"near"}',
            status: 'completed',
            progress: 100,
            checkpoint: null,
            result: '{"type":"proposal-review","data":{"score":90},"metadata":{"totalDuration":5000,"checkpointCount":2,"tokensUsed":3000}}',
            error: null,
            attestation: null,
            created_at: 1700000000000000000,
            updated_at: 1700000060000000000,
            completed_at: 1700000060000000000,
            worker: 'worker1.testnet',
          },
        ],
        total: 1,
        has_more: false,
      };

      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(rawResponse));

      const result = await getAsyncJobsByOwner('alice.testnet', true);
      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.jobs[0]!.result).toBeDefined();
      expect(result.jobs[0]!.result!.type).toBe('proposal-review');
    });
  });

  describe('getAsyncProcessorStats', () => {
    it('returns stats correctly', async () => {
      const stats = {
        total_jobs: 10,
        pending_jobs: 2,
        completed_jobs: 7,
        failed_jobs: 1,
        registered_workers: 3,
        is_paused: false,
      };

      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(stats));

      const result = await getAsyncProcessorStats();
      expect(result.total_jobs).toBe(10);
      expect(result.pending_jobs).toBe(2);
      expect(result.is_paused).toBe(false);
    });
  });

  describe('getPendingJobCount', () => {
    it('returns count', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(5));

      const count = await getPendingJobCount();
      expect(count).toBe(5);
    });
  });

  describe('cache', () => {
    it('caches get_stats responses', async () => {
      const stats = { total_jobs: 3, pending_jobs: 1, completed_jobs: 2, failed_jobs: 0, registered_workers: 1, is_paused: false };
      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(stats));

      await getAsyncProcessorStats();
      await getAsyncProcessorStats();

      // Should only have fetched once (second call hits cache)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('cache miss after clear', async () => {
      const stats = { total_jobs: 3, pending_jobs: 1, completed_jobs: 2, failed_jobs: 0, registered_workers: 1, is_paused: false };
      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCResponse(stats));

      await getAsyncProcessorStats();
      clearAsyncProcessorCache();
      await getAsyncProcessorStats();

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('throws AsyncAIContractError on RPC error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockRPCError('Something went wrong'));

      await expect(getAsyncJob('job-1')).rejects.toThrow(AsyncAIContractError);
    });
  });
});

// ============================================================================
// Error classification
// ============================================================================

describe('classifyContractError', () => {
  it('returns AsyncAIContractPausedError for paused message', () => {
    const err = classifyContractError('submit_job', 'Contract is paused');
    expect(err).toBeInstanceOf(AsyncAIContractPausedError);
  });

  it('returns AsyncAIInsufficientDepositError for deposit message', () => {
    const err = classifyContractError(
      'submit_job',
      'Insufficient deposit: required 10000000000000000000000 yoctoNEAR, attached 1'
    );
    expect(err).toBeInstanceOf(AsyncAIInsufficientDepositError);
  });

  it('returns AsyncAIJobLimitError for limit message', () => {
    const err = classifyContractError(
      'submit_job',
      'Active job limit exceeded: maximum 5 concurrent jobs'
    );
    expect(err).toBeInstanceOf(AsyncAIJobLimitError);
  });

  it('returns generic AsyncAIContractError for unknown messages', () => {
    const err = classifyContractError('get_job', 'Some unknown error');
    expect(err).toBeInstanceOf(AsyncAIContractError);
  });
});

// ============================================================================
// Transaction outcome parsing (Issue #5)
// ============================================================================

describe('parseTransactionOutcome', () => {
  /** Helper: base64-encode a JSON value */
  const b64 = (val: unknown) => btoa(JSON.stringify(val));

  it('returns null for null/undefined input', () => {
    expect(_parseTransactionOutcome(null)).toBeNull();
    expect(_parseTransactionOutcome(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(_parseTransactionOutcome('string')).toBeNull();
    expect(_parseTransactionOutcome(42)).toBeNull();
  });

  it('Format 1: direct status.SuccessValue', () => {
    const outcome = {
      status: { SuccessValue: b64('job-123') },
    };
    expect(_parseTransactionOutcome<string>(outcome)).toBe('job-123');
  });

  it('Format 2: transaction_outcome.outcome.status.SuccessValue', () => {
    const outcome = {
      transaction_outcome: {
        outcome: {
          status: { SuccessValue: b64('job-456') },
        },
      },
    };
    expect(_parseTransactionOutcome<string>(outcome)).toBe('job-456');
  });

  it('Format 3: receipts_outcome (last receipt)', () => {
    const outcome = {
      receipts_outcome: [
        {
          outcome: {
            status: { SuccessValue: b64('') }, // empty — skip
          },
        },
        {
          outcome: {
            status: { SuccessValue: b64('job-789') },
          },
        },
      ],
    };
    expect(_parseTransactionOutcome<string>(outcome)).toBe('job-789');
  });

  it('Format 4: final_execution_status.SuccessValue (near-api-js v5)', () => {
    const outcome = {
      final_execution_status: {
        SuccessValue: b64({ result: 'ok' }),
      },
    };
    expect(_parseTransactionOutcome<{ result: string }>(outcome)).toEqual({
      result: 'ok',
    });
  });

  it('returns null when SuccessValue is invalid base64', () => {
    const outcome = {
      status: { SuccessValue: '!!!not-base64!!!' },
    };
    expect(_parseTransactionOutcome(outcome)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(_parseTransactionOutcome({})).toBeNull();
  });

  it('prefers direct status over nested formats', () => {
    const outcome = {
      status: { SuccessValue: b64('direct') },
      transaction_outcome: {
        outcome: {
          status: { SuccessValue: b64('nested') },
        },
      },
    };
    // Format 1 is checked first
    expect(_parseTransactionOutcome<string>(outcome)).toBe('direct');
  });

  it('falls through to receipts_outcome when status has no SuccessValue', () => {
    const outcome = {
      status: { Failure: 'some error' },
      receipts_outcome: [
        {
          outcome: {
            status: { SuccessValue: b64('from-receipt') },
          },
        },
      ],
    };
    expect(_parseTransactionOutcome<string>(outcome)).toBe('from-receipt');
  });
});
