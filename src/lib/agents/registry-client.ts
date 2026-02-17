/**
 * Shade Agent Registry Contract Client
 *
 * Exported functions for interacting with the shade-agent-registry
 * NEAR smart contract. View calls use JSON-RPC directly; change calls
 * go through WalletSelector — matching the async-processor.ts pattern.
 *
 * Resilience features:
 * - Exponential backoff retry on transient HTTP errors (429/502/503/504)
 * - RPC endpoint failover (primary → archival)
 * - In-memory view cache for near-static data (templates: 5min, stats: 30s)
 * - Structured error classification
 * - Snake_case → camelCase mapping
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type {
  AgentTemplate,
  AgentInstance,
  AgentCapability,
  AgentRegistryStats,
  AgentVerificationResult,
  CodehashAttestation,
} from '@/types/agents';
import { config } from '@/lib/config';
import { getNetworkConfig } from '@/lib/near/config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT_ID = config.agents.registryContractId;

/** 50 TGas for register_instance */
const REGISTER_GAS = '50000000000000';
/** 30 TGas for deactivate */
const DEACTIVATE_GAS = '30000000000000';
/** 30 TGas for record_attestation */
const ATTESTATION_GAS = '30000000000000';

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
  get_template: 5 * 60 * 1000,
  list_templates: 5 * 60 * 1000,
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

/** Clear the registry view cache. */
export function clearRegistryCache(): void {
  viewCache.clear();
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AgentRegistryError extends Error {
  readonly method: string;
  constructor(method: string, message: string) {
    super(`Agent registry error: ${method} — ${message}`);
    this.name = 'AgentRegistryError';
    this.method = method;
  }
}

export class AgentNotFoundError extends AgentRegistryError {
  constructor(agentAccountId: string) {
    super('get_instance', `Agent not found: ${agentAccountId}`);
    this.name = 'AgentNotFoundError';
  }
}

export class CodehashMismatchError extends AgentRegistryError {
  readonly expected: string;
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super('verify_instance', `Codehash mismatch: expected ${expected}, got ${actual}`);
    this.name = 'CodehashMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class TemplateNotFoundError extends AgentRegistryError {
  constructor(templateId: string) {
    super('get_template', `Template not found: ${templateId}`);
    this.name = 'TemplateNotFoundError';
  }
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
        throw new AgentRegistryError(method, String(msg));
      }

      if (!json.result?.result) {
        throw new AgentRegistryError(method, 'Empty result from RPC');
      }

      const bytes = new Uint8Array(json.result.result);
      const decoded = new TextDecoder().decode(bytes);
      const result = JSON.parse(decoded) as T;

      setCache(cacheKey, result, method);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof AgentRegistryError) throw err;
    }
  }

  throw lastError ?? new AgentRegistryError(method, 'All RPC endpoints failed');
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
  // Dual-format action: v8 wallets read type/params, v10 wallets (Meteor) read functionCall
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
    actions: [action as unknown as { type: 'FunctionCall'; params: typeof action.params }],
  });
  return outcome;
}

// ---------------------------------------------------------------------------
// Snake_case → camelCase mapping
// ---------------------------------------------------------------------------

interface RawTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  codehash: string;
  source_url: string;
  audit_url?: string;
  creator: string;
  capabilities: string[];
  required_permissions: Array<{
    receiver_id: string;
    method_names: string[];
    allowance: string;
    purpose: string;
  }>;
  created_at: number;
  deployments: number;
  is_audited: boolean;
}

interface RawInstance {
  account_id: string;
  owner_account_id: string;
  template_id: string;
  codehash: string;
  name: string;
  status: string;
  last_active_at?: number;
  deployed_at: number;
  last_attestation?: {
    codehash: string;
    tee_type: string;
    attestation_document: string;
    signature: string;
    timestamp: number;
    verified: boolean;
  };
  invocation_count: number;
  capabilities: string[];
}

const nsToISO = (ns: number) => new Date(ns / 1_000_000).toISOString();

function parseTemplate(raw: RawTemplate): AgentTemplate {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    version: raw.version,
    codehash: raw.codehash,
    sourceUrl: raw.source_url,
    auditUrl: raw.audit_url,
    creator: raw.creator,
    capabilities: raw.capabilities as AgentCapability[],
    requiredPermissions: raw.required_permissions.map((p) => ({
      receiverId: p.receiver_id,
      methodNames: p.method_names,
      allowance: p.allowance,
      purpose: p.purpose,
    })),
    createdAt: nsToISO(raw.created_at),
    deployments: raw.deployments,
    isAudited: raw.is_audited,
  };
}

function parseInstance(raw: RawInstance): AgentInstance {
  return {
    accountId: raw.account_id,
    ownerAccountId: raw.owner_account_id,
    templateId: raw.template_id,
    codehash: raw.codehash,
    name: raw.name,
    status: raw.status as AgentInstance['status'],
    lastActiveAt: raw.last_active_at ? nsToISO(raw.last_active_at) : undefined,
    deployedAt: nsToISO(raw.deployed_at),
    lastAttestation: raw.last_attestation
      ? {
          codehash: raw.last_attestation.codehash,
          teeType: raw.last_attestation.tee_type,
          attestationDocument: raw.last_attestation.attestation_document,
          signature: raw.last_attestation.signature,
          timestamp: nsToISO(raw.last_attestation.timestamp),
          verified: raw.last_attestation.verified,
        }
      : undefined,
    invocationCount: raw.invocation_count,
    capabilities: raw.capabilities as AgentCapability[],
  };
}

// ---------------------------------------------------------------------------
// View calls (no wallet needed)
// ---------------------------------------------------------------------------

/** Get a template by ID. Returns null if not found. */
export async function getTemplate(
  templateId: string,
  contractId?: string
): Promise<AgentTemplate | null> {
  const raw = await viewFunction<RawTemplate | null>(
    'get_template',
    { template_id: templateId },
    contractId
  );
  return raw ? parseTemplate(raw) : null;
}

/** List templates with pagination. */
export async function listTemplates(
  fromIndex: number = 0,
  limit: number = 50,
  contractId?: string
): Promise<AgentTemplate[]> {
  const raw = await viewFunction<RawTemplate[]>(
    'list_templates',
    { from_index: fromIndex, limit },
    contractId
  );
  return raw.map(parseTemplate);
}

/** Get an agent instance by account ID. Returns null if not found. */
export async function getAgentInstance(
  agentAccountId: string,
  contractId?: string
): Promise<AgentInstance | null> {
  const raw = await viewFunction<RawInstance | null>(
    'get_instance',
    { agent_account_id: agentAccountId },
    contractId
  );
  return raw ? parseInstance(raw) : null;
}

/** Get all agents owned by an account. */
export async function getMyAgents(
  ownerAccountId: string,
  contractId?: string
): Promise<AgentInstance[]> {
  const raw = await viewFunction<RawInstance[]>(
    'get_instances_by_owner',
    { owner_account_id: ownerAccountId },
    contractId
  );
  return raw.map(parseInstance);
}

/** Verify an agent's codehash against the registry. */
export async function verifyAgent(
  agentAccountId: string,
  contractId?: string
): Promise<AgentVerificationResult> {
  return viewFunction<AgentVerificationResult>(
    'verify_instance',
    { agent_account_id: agentAccountId },
    contractId
  );
}

/** Get registry statistics. */
export async function getRegistryStats(
  contractId?: string
): Promise<AgentRegistryStats> {
  const raw = await viewFunction<{
    total_templates: number;
    total_deployments: number;
    verified_codehashes: number;
  }>('get_stats', {}, contractId);
  return {
    totalTemplates: raw.total_templates,
    totalDeployments: raw.total_deployments,
    verifiedCodehashes: raw.verified_codehashes,
  };
}

// ---------------------------------------------------------------------------
// Change calls (require wallet)
// ---------------------------------------------------------------------------

/** 80 TGas for register_template */
const REGISTER_TEMPLATE_GAS = '80000000000000';

/** Register a new agent template on-chain. */
export async function registerTemplate(
  input: {
    id: string;
    name: string;
    description: string;
    version: string;
    codehash: string;
    sourceUrl: string;
    auditUrl?: string;
    capabilities: AgentCapability[];
    requiredPermissions: Array<{
      receiverId: string;
      methodNames: string[];
      allowance: string;
      purpose: string;
    }>;
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'register_template',
    {
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      codehash: input.codehash,
      source_url: input.sourceUrl,
      audit_url: input.auditUrl || null,
      capabilities: input.capabilities,
      required_permissions: input.requiredPermissions.map((p) => ({
        receiver_id: p.receiverId,
        method_names: p.methodNames,
        allowance: p.allowance,
        purpose: p.purpose,
      })),
    },
    REGISTER_TEMPLATE_GAS,
    '0',
    contractId
  );
}

/** Register a deployed agent instance on-chain. */
export async function registerAgentInstance(
  instance: {
    agentAccountId: string;
    ownerAccountId: string;
    templateId: string;
    codehash: string;
    name: string;
    capabilities: AgentCapability[];
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'register_instance',
    {
      agent_account_id: instance.agentAccountId,
      owner_account_id: instance.ownerAccountId,
      template_id: instance.templateId,
      codehash: instance.codehash,
      name: instance.name,
      capabilities: instance.capabilities,
    },
    REGISTER_GAS,
    '0',
    contractId
  );
}

/** Deactivate an agent instance on-chain. */
export async function deactivateAgentOnChain(
  agentAccountId: string,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'deactivate_instance',
    { agent_account_id: agentAccountId },
    DEACTIVATE_GAS,
    '0',
    contractId
  );
}

/** Record a TEE attestation for an agent instance. */
export async function recordAttestationOnChain(
  agentAccountId: string,
  attestation: CodehashAttestation,
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'record_attestation',
    {
      agent_account_id: agentAccountId,
      attestation: {
        codehash: attestation.codehash,
        tee_type: attestation.teeType,
        attestation_document: attestation.attestationDocument,
        signature: attestation.signature,
        timestamp: attestation.timestamp,
        verified: attestation.verified,
      },
    },
    ATTESTATION_GAS,
    '0',
    contractId
  );
}
