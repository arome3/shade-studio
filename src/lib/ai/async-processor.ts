/**
 * Async AI Processor Contract Client
 *
 * Exported functions (not a class) for interacting with the async-ai-processor
 * NEAR smart contract. View calls use JSON-RPC directly; change calls
 * go through WalletSelector — matching the contract-client.ts pattern.
 *
 * Resilience features:
 * - Exponential backoff retry on transient HTTP errors (429/502/503/504)
 * - RPC endpoint failover (primary → archival)
 * - In-memory view cache for near-static data (config, stats)
 * - Structured error classification from contract panic strings
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type { AIJob, AIJobType, AIJobParams } from '@/types/async-ai';
import type { NEARAIAttestation } from '@/types/ai';
import { config } from '@/lib/config';
import { getNetworkConfig } from '@/lib/near/config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT_ID = config.asyncAI.contractId;

/** 50 TGas for submit_job (includes storage write + event) */
const SUBMIT_GAS = '50000000000000';

/** 30 TGas for cancel_job */
const CANCEL_GAS = '30000000000000';

// ---------------------------------------------------------------------------
// RPC failover endpoints
// ---------------------------------------------------------------------------

const RPC_ENDPOINTS: Record<string, string[]> = {
  testnet: [
    'https://rpc.testnet.near.org',
    'https://archival-rpc.testnet.near.org',
  ],
  mainnet: [
    'https://rpc.mainnet.near.org',
    'https://archival-rpc.mainnet.near.org',
  ],
};

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < maxRetries) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('fetchWithRetry: all attempts failed');
}

// ---------------------------------------------------------------------------
// In-memory view cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const viewCache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTLS: Record<string, number> = {
  get_config: 5 * 60 * 1000,
  get_stats: 30 * 1000,
};

function getCached<T>(cacheKey: string): T | undefined {
  const entry = viewCache.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    viewCache.delete(cacheKey);
    return undefined;
  }
  return entry.data as T;
}

function setCache<T>(cacheKey: string, data: T, method: string): void {
  const ttl = CACHE_TTLS[method];
  if (!ttl) return;
  viewCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
}

/** Clear the contract view cache. */
export function clearAsyncProcessorCache(): void {
  viewCache.clear();
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AsyncAIContractError extends Error {
  readonly method: string;
  constructor(method: string, message: string) {
    super(`Async AI contract error: ${method} — ${message}`);
    this.name = 'AsyncAIContractError';
    this.method = method;
  }
}

export class AsyncAIContractPausedError extends AsyncAIContractError {
  constructor() {
    super('', 'Contract is paused');
    this.name = 'AsyncAIContractPausedError';
  }
}

export class AsyncAIInsufficientDepositError extends AsyncAIContractError {
  readonly required: string;
  readonly attached: string;
  constructor(required: string, attached: string) {
    super('submit_job', `Insufficient deposit: required ${required}, attached ${attached}`);
    this.name = 'AsyncAIInsufficientDepositError';
    this.required = required;
    this.attached = attached;
  }
}

export class AsyncAIJobLimitError extends AsyncAIContractError {
  constructor(limit: string) {
    super('submit_job', `Active job limit exceeded: maximum ${limit} concurrent jobs`);
    this.name = 'AsyncAIJobLimitError';
  }
}

/**
 * Classify a contract error message into a typed error.
 */
export function classifyContractError(method: string, msg: string): Error {
  if (msg.includes('Contract is paused')) {
    return new AsyncAIContractPausedError();
  }
  if (msg.includes('not a registered worker') || msg.includes('Unauthorized')) {
    return new AsyncAIContractError(method, msg);
  }
  const depositMatch = msg.match(
    /Insufficient deposit: required (\d+) yoctoNEAR, attached (\d+)/
  );
  if (depositMatch) {
    return new AsyncAIInsufficientDepositError(depositMatch[1]!, depositMatch[2]!);
  }
  const limitMatch = msg.match(/maximum (\d+) concurrent jobs/);
  if (limitMatch) {
    return new AsyncAIJobLimitError(limitMatch[1]!);
  }
  if (msg.includes('Job not found')) {
    return new AsyncAIContractError(method, msg);
  }
  if (msg.includes('Invalid status transition')) {
    return new AsyncAIContractError(method, msg);
  }
  return new AsyncAIContractError(method, msg);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function viewFunction<T>(
  method: string,
  args: Record<string, unknown> = {},
  contractId: string = DEFAULT_CONTRACT_ID
): Promise<T> {
  const cacheKey = `${contractId}:${method}:${JSON.stringify(args)}`;
  const cached = getCached<T>(cacheKey);
  if (cached !== undefined) return cached;

  const { networkId, nodeUrl } = getNetworkConfig();
  const argsBase64 = btoa(JSON.stringify(args));

  const requestBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 'view',
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'optimistic',
      account_id: contractId,
      method_name: method,
      args_base64: argsBase64,
    },
  });

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  };

  const endpoints = [nodeUrl];
  const fallbacks = RPC_ENDPOINTS[networkId] ?? [];
  for (const fb of fallbacks) {
    if (fb !== nodeUrl && !endpoints.includes(fb)) {
      endpoints.push(fb);
    }
  }

  let lastError: Error | undefined;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithRetry(endpoint, fetchOptions);
      const json = await response.json();

      if (json.error) {
        const msg = json.error.data ?? json.error.message ?? JSON.stringify(json.error);
        throw new AsyncAIContractError(method, String(msg));
      }

      if (!json.result?.result) {
        throw new AsyncAIContractError(method, 'Empty result from RPC');
      }

      const bytes = new Uint8Array(json.result.result);
      const decoded = new TextDecoder().decode(bytes);
      const result = JSON.parse(decoded) as T;

      setCache(cacheKey, result, method);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof AsyncAIContractError) throw err;
    }
  }

  throw lastError ?? new AsyncAIContractError(method, 'All RPC endpoints failed');
}

async function callFunction(
  walletSelector: WalletSelector,
  method: string,
  args: Record<string, unknown>,
  gas: string,
  deposit: string = '0',
  contractId: string = DEFAULT_CONTRACT_ID
): Promise<unknown> {
  const wallet = await walletSelector.wallet();
  const argsBytes = new TextEncoder().encode(JSON.stringify(args));

  // Dual-format action: both property styles on one object.
  // - v8 wallets (MyNearWallet) use `switch(action.type)` → reads `type`/`params`
  // - v10 wallets (Meteor) use `if(action.functionCall)` → reads `functionCall`
  const action = {
    type: 'FunctionCall' as const,
    params: {
      methodName: method,
      args,
      gas,
      deposit,
    },
    functionCall: {
      methodName: method,
      args: argsBytes,
      gas: BigInt(gas),
      deposit: BigInt(deposit),
    },
  };
  const outcome = await wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [action as typeof action & { type: 'FunctionCall' }],
  });
  return outcome;
}

/**
 * Parse a transaction outcome from any WalletSelector adapter format.
 * Handles: direct status, transaction_outcome, receipts_outcome,
 * FinalExecutionOutcome (near-api-js v5), and raw string returns.
 */
function parseTransactionOutcome<T>(outcome: unknown): T | null {
  if (!outcome || typeof outcome !== 'object') return null;

  const tryDecode = (val: unknown): T | null => {
    if (typeof val !== 'string') return null;
    try {
      return JSON.parse(atob(val)) as T;
    } catch {
      return null;
    }
  };

  const obj = outcome as Record<string, unknown>;

  // Format 1: Direct status.SuccessValue
  if (typeof obj.status === 'object' && obj.status) {
    const s = obj.status as Record<string, unknown>;
    const result = tryDecode(s.SuccessValue);
    if (result !== null) return result;
  }

  // Format 2: transaction_outcome.outcome.status.SuccessValue
  if (typeof obj.transaction_outcome === 'object' && obj.transaction_outcome) {
    const txo = obj.transaction_outcome as Record<string, unknown>;
    if (typeof txo.outcome === 'object' && txo.outcome) {
      const oc = txo.outcome as Record<string, unknown>;
      if (typeof oc.status === 'object' && oc.status) {
        const result = tryDecode((oc.status as Record<string, unknown>).SuccessValue);
        if (result !== null) return result;
      }
    }
  }

  // Format 3: receipts_outcome — check last receipt first (most likely to have return value)
  if (Array.isArray(obj.receipts_outcome)) {
    for (let i = obj.receipts_outcome.length - 1; i >= 0; i--) {
      const ro = obj.receipts_outcome[i] as Record<string, unknown>;
      if (typeof ro?.outcome === 'object' && ro.outcome) {
        const oc = ro.outcome as Record<string, unknown>;
        if (typeof oc.status === 'object' && oc.status) {
          const result = tryDecode((oc.status as Record<string, unknown>).SuccessValue);
          if (result !== null) return result;
        }
      }
    }
  }

  // Format 4: FinalExecutionOutcome (near-api-js v5)
  if (typeof obj.final_execution_status === 'object' && obj.final_execution_status) {
    const fes = obj.final_execution_status as Record<string, unknown>;
    const result = tryDecode(fes.SuccessValue);
    if (result !== null) return result;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal type mapping (snake_case → camelCase)
// ---------------------------------------------------------------------------

interface RawJob {
  id: string;
  job_type: string;
  owner: string;
  params: string;
  status: string;
  progress: number;
  checkpoint?: {
    progress: number;
    step: string;
    state: string;
    timestamp: number;
  };
  result?: string;
  error?: string;
  attestation?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
  worker?: string;
}

function mapJob(raw: RawJob): AIJob {
  const nsToISO = (ns: number) => new Date(ns / 1_000_000).toISOString();

  return {
    id: raw.id,
    type: raw.job_type as AIJobType,
    owner: raw.owner,
    params: JSON.parse(raw.params),
    status: raw.status as AIJob['status'],
    progress: raw.progress,
    checkpoint: raw.checkpoint
      ? {
          progress: raw.checkpoint.progress,
          step: raw.checkpoint.step,
          state: raw.checkpoint.state,
          timestamp: nsToISO(raw.checkpoint.timestamp),
        }
      : undefined,
    result: raw.result ? JSON.parse(raw.result) : undefined,
    error: raw.error ?? undefined,
    attestation: raw.attestation
      ? (() => {
          try {
            return JSON.parse(atob(raw.attestation)) as NEARAIAttestation;
          } catch {
            // Not base64-encoded JSON — try raw JSON
            try {
              return JSON.parse(raw.attestation) as NEARAIAttestation;
            } catch {
              return undefined;
            }
          }
        })()
      : undefined,
    createdAt: nsToISO(raw.created_at),
    updatedAt: nsToISO(raw.updated_at),
    completedAt: raw.completed_at ? nsToISO(raw.completed_at) : undefined,
  };
}

// ---------------------------------------------------------------------------
// View calls (no wallet needed)
// ---------------------------------------------------------------------------

export interface AsyncProcessorConfig {
  min_deposit: string;
  max_active_jobs_per_user: number;
  job_timeout_ns: string;
}

export interface AsyncProcessorStats {
  total_jobs: number;
  pending_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  registered_workers: number;
  is_paused: boolean;
}

/** Get a job by ID. Returns null if not found. */
export async function getAsyncJob(
  jobId: string,
  contractId?: string
): Promise<AIJob | null> {
  const raw = await viewFunction<RawJob | null>(
    'get_job',
    { job_id: jobId },
    contractId
  );
  return raw ? mapJob(raw) : null;
}

/** Get jobs for an owner with pagination. */
export async function getAsyncJobsByOwner(
  owner: string,
  includeCompleted: boolean = false,
  offset: number = 0,
  limit: number = 50,
  contractId?: string
): Promise<{ jobs: AIJob[]; total: number; hasMore: boolean }> {
  const raw = await viewFunction<{
    jobs: RawJob[];
    total: number;
    has_more: boolean;
  }>(
    'get_jobs_by_owner',
    {
      owner,
      include_completed: includeCompleted,
      offset,
      limit,
    },
    contractId
  );
  return {
    jobs: raw.jobs.map(mapJob),
    total: raw.total,
    hasMore: raw.has_more,
  };
}

/** Get contract statistics. */
export async function getAsyncProcessorStats(
  contractId?: string
): Promise<AsyncProcessorStats> {
  return viewFunction<AsyncProcessorStats>('get_stats', {}, contractId);
}

/** Get the number of pending jobs. */
export async function getPendingJobCount(
  contractId?: string
): Promise<number> {
  return viewFunction<number>('get_pending_count', {}, contractId);
}

/** Get contract configuration. */
export async function getAsyncProcessorConfig(
  contractId?: string
): Promise<AsyncProcessorConfig> {
  return viewFunction<AsyncProcessorConfig>('get_config', {}, contractId);
}

// ---------------------------------------------------------------------------
// Change calls (require wallet)
// ---------------------------------------------------------------------------

/** Default deposit: 0.01 NEAR */
const DEFAULT_DEPOSIT = '10000000000000000000000';

/**
 * Submit a new async AI job.
 * Fetches the current min_deposit from contract config (cached 5 min).
 * @returns The job ID on success.
 */
export async function submitAsyncJob(
  params: AIJobParams,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<string> {
  try {
    // Fetch dynamic deposit from contract config (cached 5 min)
    let deposit = DEFAULT_DEPOSIT;
    try {
      const contractConfig = await getAsyncProcessorConfig(contractId);
      deposit = contractConfig.min_deposit;
    } catch {
      // Fallback to default if config fetch fails
    }

    const outcome = await callFunction(
      walletSelector,
      'submit_job',
      {
        job_type: params.type,
        params: JSON.stringify(params),
      },
      SUBMIT_GAS,
      deposit,
      contractId
    );
    const jobId = parseTransactionOutcome<string>(outcome);
    return jobId ?? '';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw classifyContractError('submit_job', msg);
  }
}

/** @internal Exported for testing only */
export { parseTransactionOutcome as _parseTransactionOutcome };

/**
 * Cancel a pending job.
 */
export async function cancelAsyncJob(
  jobId: string,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  try {
    await callFunction(
      walletSelector,
      'cancel_job',
      { job_id: jobId },
      CANCEL_GAS,
      '0',
      contractId
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw classifyContractError('cancel_job', msg);
  }
}
