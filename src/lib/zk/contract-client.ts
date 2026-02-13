/**
 * ZK Verifier Contract Client
 *
 * Exported functions (not a class) for interacting with the zk-verifier
 * NEAR smart contract. View calls use JSON-RPC directly; change calls
 * go through WalletSelector — matching the on-chain-verifier.ts pattern.
 *
 * Resilience features:
 * - Exponential backoff retry on transient HTTP errors (429/502/503/504)
 * - RPC endpoint failover (primary → archival)
 * - In-memory view cache for near-static data (config, storage cost, VK checks)
 * - Structured error classification from contract panic strings
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type {
  ZKCircuit,
  ZKProof,
  OnChainCredential,
  ContractVerificationResult,
  ContractStats,
  PaginatedCredentials,
} from '@/types/zk';
import { config } from '@/lib/config';
import { getNetworkConfig } from '@/lib/near/config';
import {
  ContractCallError,
  ContractPausedError,
  InsufficientDepositError,
} from './errors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT_ID = config.zk.verifierContractId;

/** 150 TGas — generous allocation for verification + optional credential storage */
const VERIFY_GAS = '150000000000000';

/** 30 TGas for simple change calls */
const SIMPLE_GAS = '30000000000000';

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
      // Retryable HTTP status — fall through to retry
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      // Network error — retryable
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

/** Cache TTLs in milliseconds */
const CACHE_TTLS: Record<string, number> = {
  get_config: 5 * 60 * 1000,
  get_storage_cost: 5 * 60 * 1000,
  has_verification_key: 1 * 60 * 1000,
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
  if (!ttl) return; // Not a cached method
  viewCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
}

/** Clear the contract view cache. Useful for testing or manual invalidation. */
export function clearContractCache(): void {
  viewCache.clear();
}

// ---------------------------------------------------------------------------
// Structured error classification
// ---------------------------------------------------------------------------

/**
 * Classify a contract error message into a typed error.
 * Parses known panic string patterns from the Rust contract.
 */
function classifyContractError(method: string, msg: string): Error {
  if (msg.includes('Contract is paused')) {
    return new ContractPausedError();
  }

  if (msg.includes('Unauthorized')) {
    return new ContractCallError(method, msg);
  }

  // Parse "Insufficient deposit: required X yoctoNEAR, attached Y"
  const depositMatch = msg.match(
    /Insufficient deposit: required (\d+) yoctoNEAR, attached (\d+)/
  );
  if (depositMatch) {
    return new InsufficientDepositError(depositMatch[1]!, depositMatch[2]!);
  }

  if (msg.includes('No verification key') || msg.includes('VerificationKeyNotFound')) {
    return new ContractCallError(method, msg);
  }

  return new ContractCallError(method, msg);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Call a view function on the verifier contract via JSON-RPC.
 * No wallet needed — view calls are free.
 * Uses retry, failover, and optional caching.
 */
async function viewFunction<T>(
  method: string,
  args: Record<string, unknown> = {},
  contractId: string = DEFAULT_CONTRACT_ID
): Promise<T> {
  // Check cache
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

  // Build endpoint list: primary (from config) + failover
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
        throw new ContractCallError(method, String(msg));
      }

      if (!json.result?.result) {
        throw new ContractCallError(method, 'Empty result from RPC');
      }

      // Decode the result bytes → UTF-8 → JSON
      const bytes = new Uint8Array(json.result.result);
      const decoded = new TextDecoder().decode(bytes);
      const result = JSON.parse(decoded) as T;

      // Cache the result if applicable
      setCache(cacheKey, result, method);

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If it's a contract-level error (not network), don't try failover
      if (err instanceof ContractCallError) throw err;
    }
  }

  throw lastError ?? new ContractCallError(method, 'All RPC endpoints failed');
}

/**
 * Call a change function on the verifier contract via WalletSelector.
 */
async function callFunction(
  walletSelector: WalletSelector,
  method: string,
  args: Record<string, unknown>,
  gas: string,
  deposit: string = '0',
  contractId: string = DEFAULT_CONTRACT_ID
): Promise<unknown> {
  const wallet = await walletSelector.wallet();
  const outcome = await wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [
      {
        type: 'FunctionCall',
        params: {
          methodName: method,
          args: new TextEncoder().encode(JSON.stringify(args)),
          gas,
          deposit,
        },
      },
    ],
  });
  return outcome;
}

/**
 * Maps TypeScript circuit type to the contract's kebab-case string.
 * The Rust contract uses serde kebab-case, which matches our ZKCircuit type directly.
 */
function circuitTypeToContract(circuit: ZKCircuit): string {
  return circuit; // Already kebab-case: 'verified-builder', etc.
}

/**
 * Parse the transaction outcome to extract the return value.
 */
function parseTransactionOutcome<T>(outcome: unknown): T | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const obj = outcome as Record<string, unknown>;

  // Check status.SuccessValue (base64-encoded JSON)
  if (typeof obj.status === 'object' && obj.status) {
    const status = obj.status as Record<string, unknown>;
    if (typeof status.SuccessValue === 'string') {
      try {
        const decoded = atob(status.SuccessValue);
        return JSON.parse(decoded) as T;
      } catch {
        return null;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// View calls (no wallet needed)
// ---------------------------------------------------------------------------

export interface ContractConfig {
  owner: string;
  proposed_owner: string | null;
  is_paused: boolean;
  default_expiration_secs: number;
  storage_cost_per_credential: string;
}

/** Get the contract configuration. */
export async function getContractConfig(
  contractId?: string
): Promise<ContractConfig> {
  return viewFunction<ContractConfig>('get_config', {}, contractId);
}

/** Get contract statistics. */
export async function getContractStats(
  contractId?: string
): Promise<ContractStats> {
  return viewFunction<ContractStats>('get_stats', {}, contractId);
}

/** Get the required storage deposit for a credential in yoctoNEAR. */
export async function getCredentialStorageCost(
  contractId?: string
): Promise<string> {
  return viewFunction<string>('get_storage_cost', {}, contractId);
}

/** Get a credential by ID. */
export async function getOnChainCredential(
  credentialId: string,
  contractId?: string
): Promise<OnChainCredential | null> {
  const raw = await viewFunction<RawCredential | null>(
    'get_credential',
    { credential_id: credentialId },
    contractId
  );
  return raw ? mapCredential(raw) : null;
}

/** Check if a credential exists and is not expired. */
export async function isOnChainCredentialValid(
  credentialId: string,
  contractId?: string
): Promise<boolean | null> {
  return viewFunction<boolean | null>(
    'is_credential_valid',
    { credential_id: credentialId },
    contractId
  );
}

/** Check if a credential has been revoked. */
export async function isCredentialRevoked(
  credentialId: string,
  contractId?: string
): Promise<boolean> {
  return viewFunction<boolean>(
    'is_credential_revoked',
    { credential_id: credentialId },
    contractId
  );
}

/** Get credentials owned by an account with pagination. */
export async function getCredentialsByOwner(
  owner: string,
  includeExpired: boolean = false,
  contractId?: string,
  offset: number = 0,
  limit: number = 50
): Promise<PaginatedCredentials> {
  const raw = await viewFunction<{
    credentials: RawCredential[];
    total: number;
    has_more: boolean;
  }>(
    'get_credentials_by_owner',
    { owner, include_expired: includeExpired, offset, limit },
    contractId
  );
  return {
    credentials: raw.credentials.map(mapCredential),
    total: raw.total,
    has_more: raw.has_more,
  };
}

/** View-only proof verification (does not store anything). */
export async function verifyProofViewOnContract(
  proof: ZKProof,
  contractId?: string
): Promise<ContractVerificationResult> {
  return viewFunction<ContractVerificationResult>(
    'verify_proof_view',
    {
      input: {
        circuit_type: circuitTypeToContract(proof.circuit),
        proof: {
          pi_a: proof.proof.pi_a,
          pi_b: proof.proof.pi_b,
          pi_c: proof.proof.pi_c,
        },
        public_signals: proof.publicSignals,
        store_credential: false,
        custom_expiration: null,
        claim: null,
      },
    },
    contractId
  );
}

/** Check if a verification key is registered for a circuit type. */
export async function hasVerificationKey(
  circuitType: ZKCircuit,
  contractId?: string
): Promise<boolean> {
  return viewFunction<boolean>(
    'has_verification_key',
    { circuit_type: circuitTypeToContract(circuitType) },
    contractId
  );
}

// ---------------------------------------------------------------------------
// Change calls (require wallet)
// ---------------------------------------------------------------------------

export interface VerifyOnContractOptions {
  /** Override the default verifier contract ID */
  contractId?: string;
  /** Store a credential on-chain after successful verification */
  storeCredential?: boolean;
  /** Custom expiration in seconds (overrides contract default) */
  customExpiration?: number;
  /** Claim text to attach to the credential */
  claim?: string;
  /** Deposit in yoctoNEAR (required if storeCredential is true) */
  deposit?: string;
}

/**
 * Verify a ZK proof on-chain and optionally store a credential.
 * When `storeCredential` is true, the caller must attach sufficient deposit.
 */
export async function verifyProofOnContract(
  proof: ZKProof,
  walletSelector: WalletSelector,
  options: VerifyOnContractOptions = {}
): Promise<ContractVerificationResult> {
  const {
    contractId = DEFAULT_CONTRACT_ID,
    storeCredential = false,
    customExpiration,
    claim,
    deposit = '0',
  } = options;

  const args = {
    input: {
      circuit_type: circuitTypeToContract(proof.circuit),
      proof: {
        pi_a: proof.proof.pi_a,
        pi_b: proof.proof.pi_b,
        pi_c: proof.proof.pi_c,
      },
      public_signals: proof.publicSignals,
      store_credential: storeCredential,
      custom_expiration: customExpiration ?? null,
      claim: claim ?? null,
    },
  };

  try {
    const outcome = await callFunction(
      walletSelector,
      'verify_proof',
      args,
      VERIFY_GAS,
      storeCredential ? deposit : '0',
      contractId
    );

    const result = parseTransactionOutcome<ContractVerificationResult>(outcome);
    if (result) return result;

    // If we can't parse the outcome, return a minimal result
    return { valid: false, credential_id: null, gas_used: 0 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw classifyContractError('verify_proof', msg);
  }
}

/** Remove a credential from on-chain storage. Only the credential owner can do this. */
export async function removeOnChainCredential(
  credentialId: string,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<boolean> {
  try {
    const outcome = await callFunction(
      walletSelector,
      'remove_credential',
      { credential_id: credentialId },
      SIMPLE_GAS,
      '0',
      contractId
    );
    const result = parseTransactionOutcome<boolean>(outcome);
    return result ?? false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw classifyContractError('remove_credential', msg);
  }
}

/** Revoke a credential. Only callable by owner or admin. */
export async function revokeCredential(
  credentialId: string,
  reason: string,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  try {
    await callFunction(
      walletSelector,
      'revoke_credential',
      { credential_id: credentialId, reason },
      SIMPLE_GAS,
      '0',
      contractId
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw classifyContractError('revoke_credential', msg);
  }
}

// ---------------------------------------------------------------------------
// Internal type mapping
// ---------------------------------------------------------------------------

/** Raw credential shape from the contract (snake_case). */
interface RawCredential {
  id: string;
  owner: string;
  circuit_type: string;
  public_signals: string[];
  verified_at: number;
  expires_at: number;
  claim?: string;
}

/** Map contract snake_case credential to TypeScript camelCase. */
function mapCredential(raw: RawCredential): OnChainCredential {
  return {
    id: raw.id,
    owner: raw.owner,
    circuitType: raw.circuit_type as ZKCircuit,
    publicSignals: raw.public_signals,
    verifiedAt: raw.verified_at,
    expiresAt: raw.expires_at,
    claim: raw.claim,
  };
}
