/**
 * Grant Registry Contract Client
 *
 * Exported functions for interacting with the grant-registry
 * NEAR smart contract. View calls use JSON-RPC directly; change calls
 * go through WalletSelector — matching the agent registry-client pattern.
 *
 * Resilience features:
 * - Exponential backoff retry on transient HTTP errors (429/502/503/504)
 * - RPC endpoint failover (primary → archival)
 * - In-memory view cache with configurable TTLs
 * - Structured error classification
 * - Snake_case → camelCase mapping
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type {
  GrantProgram,
  GrantProject,
  GrantApplication,
  EcosystemStats,
  GrantCategory,
  GrantChain,
  ProgramStatus,
  ProjectTeamMember,
} from '@/types/grants';
import { config } from '@/lib/config';
import { getNetworkConfig } from '@/lib/near/config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONTRACT_ID = config.grantRegistry.contractId;

/** 80 TGas for register_program */
const REGISTER_PROGRAM_GAS = '80000000000000';
/** 50 TGas for register_project */
const REGISTER_PROJECT_GAS = '50000000000000';
/** 30 TGas for record_application */
const RECORD_APPLICATION_GAS = '30000000000000';
/** 30 TGas for update_application */
const UPDATE_APPLICATION_GAS = '30000000000000';

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
  search_programs: 60 * 1000,
  get_program: 5 * 60 * 1000,
  get_project: 5 * 60 * 1000,
  get_project_history: 2 * 60 * 1000,
  get_ecosystem_stats: 30 * 1000,
  get_projects_by_owner: 60 * 1000,
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

/** Clear the grant registry view cache. */
export function clearGrantRegistryCache(): void {
  viewCache.clear();
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GrantRegistryError extends Error {
  readonly method: string;
  constructor(method: string, message: string) {
    super(`Grant registry error: ${method} — ${message}`);
    this.name = 'GrantRegistryError';
    this.method = method;
  }
}

export class ProgramNotFoundError extends GrantRegistryError {
  constructor(programId: string) {
    super('get_program', `Program not found: ${programId}`);
    this.name = 'ProgramNotFoundError';
  }
}

export class ProjectNotFoundError extends GrantRegistryError {
  constructor(projectId: string) {
    super('get_project', `Project not found: ${projectId}`);
    this.name = 'ProjectNotFoundError';
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
        throw new GrantRegistryError(method, String(msg));
      }

      if (!json.result?.result) {
        throw new GrantRegistryError(method, 'Empty result from RPC');
      }

      const bytes = new Uint8Array(json.result.result);
      const decoded = new TextDecoder().decode(bytes);
      const result = JSON.parse(decoded) as T;

      setCache(cacheKey, result, method);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof GrantRegistryError) throw err;
    }
  }

  throw lastError ?? new GrantRegistryError(method, 'All RPC endpoints failed');
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

interface RawProgram {
  id: string;
  name: string;
  description: string;
  organization: string;
  chains: string[];
  categories: string[];
  funding_pool: string;
  min_amount?: string;
  max_amount?: string;
  deadline?: string;
  website: string;
  application_url?: string;
  status: string;
  registered_by: string;
  registered_at: number;
  application_count: number;
  funded_count: number;
}

interface RawProject {
  id: string;
  name: string;
  description: string;
  website?: string;
  team_members: Array<{
    account_id: string;
    name: string;
    role: string;
    profile_url?: string;
  }>;
  registered_by: string;
  registered_at: number;
  total_funded: string;
  application_count: number;
  success_rate: number;
}

interface RawApplication {
  id: string;
  program_id: string;
  project_id: string;
  applicant_account_id: string;
  title: string;
  requested_amount: string;
  status: string;
  submitted_at?: number;
  funded_amount?: string;
  completed_at?: number;
}

interface RawEcosystemStats {
  total_programs: number;
  total_projects: number;
  total_funded: string;
  total_applications: number;
  active_programs: number;
}

const nsToISO = (ns: number) => new Date(ns / 1_000_000).toISOString();

function parseProgram(raw: RawProgram): GrantProgram {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    organization: raw.organization,
    chains: raw.chains as GrantChain[],
    categories: raw.categories as GrantCategory[],
    fundingPool: raw.funding_pool,
    minAmount: raw.min_amount,
    maxAmount: raw.max_amount,
    deadline: raw.deadline,
    website: raw.website,
    applicationUrl: raw.application_url,
    status: raw.status as ProgramStatus,
    registeredBy: raw.registered_by,
    registeredAt: nsToISO(raw.registered_at),
    applicationCount: raw.application_count,
    fundedCount: raw.funded_count,
  };
}

function parseProject(raw: RawProject): GrantProject {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    website: raw.website,
    teamMembers: raw.team_members.map(
      (m): ProjectTeamMember => ({
        accountId: m.account_id,
        name: m.name,
        role: m.role,
        profileUrl: m.profile_url,
      })
    ),
    registeredBy: raw.registered_by,
    registeredAt: nsToISO(raw.registered_at),
    totalFunded: raw.total_funded,
    applicationCount: raw.application_count,
    successRate: raw.success_rate,
  };
}

function parseApplication(raw: RawApplication): GrantApplication {
  return {
    id: raw.id,
    programId: raw.program_id,
    projectId: raw.project_id,
    applicantAccountId: raw.applicant_account_id,
    title: raw.title,
    requestedAmount: raw.requested_amount,
    status: raw.status as GrantApplication['status'],
    submittedAt: raw.submitted_at ? nsToISO(raw.submitted_at) : undefined,
    fundedAmount: raw.funded_amount,
    completedAt: raw.completed_at ? nsToISO(raw.completed_at) : undefined,
  };
}

// ---------------------------------------------------------------------------
// View calls (no wallet needed)
// ---------------------------------------------------------------------------

/** Search programs with optional filters. Text filtering is client-side. */
export async function searchPrograms(
  filters: {
    searchText?: string;
    category?: GrantCategory;
    chain?: GrantChain;
    status?: ProgramStatus;
  } = {},
  contractId?: string
): Promise<GrantProgram[]> {
  const args: Record<string, unknown> = {};
  if (filters.category) args.category = filters.category;
  if (filters.chain) args.chain = filters.chain;
  if (filters.status) args.status = filters.status;

  const raw = await viewFunction<RawProgram[]>(
    'search_programs',
    args,
    contractId
  );

  let programs = raw.map(parseProgram);

  // Client-side text filtering (contract can't do full-text search)
  if (filters.searchText) {
    const query = filters.searchText.toLowerCase();
    programs = programs.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.organization.toLowerCase().includes(query)
    );
  }

  return programs;
}

/** Get a program by ID. Returns null if not found. */
export async function getProgram(
  programId: string,
  contractId?: string
): Promise<GrantProgram | null> {
  const raw = await viewFunction<RawProgram | null>(
    'get_program',
    { program_id: programId },
    contractId
  );
  return raw ? parseProgram(raw) : null;
}

/** Get a project by ID. Returns null if not found. */
export async function getProject(
  projectId: string,
  contractId?: string
): Promise<GrantProject | null> {
  const raw = await viewFunction<RawProject | null>(
    'get_project',
    { project_id: projectId },
    contractId
  );
  return raw ? parseProject(raw) : null;
}

/** Get a project's application history. */
export async function getProjectHistory(
  projectId: string,
  contractId?: string
): Promise<GrantApplication[]> {
  const raw = await viewFunction<RawApplication[]>(
    'get_project_history',
    { project_id: projectId },
    contractId
  );
  return raw.map(parseApplication);
}

/** Get all projects registered by a specific owner. */
export async function getProjectsByOwner(
  accountId: string,
  contractId?: string
): Promise<GrantProject[]> {
  const raw = await viewFunction<RawProject[]>(
    'get_projects_by_owner',
    { owner: accountId },
    contractId
  );
  return raw.map(parseProject);
}

/** Get ecosystem-wide statistics. */
export async function getEcosystemStats(
  contractId?: string
): Promise<EcosystemStats> {
  const raw = await viewFunction<RawEcosystemStats>(
    'get_ecosystem_stats',
    {},
    contractId
  );
  return {
    totalPrograms: raw.total_programs,
    totalProjects: raw.total_projects,
    totalFunded: raw.total_funded,
    totalApplications: raw.total_applications,
    activePrograms: raw.active_programs,
    topCategories: [],
    topChains: [],
  };
}

// ---------------------------------------------------------------------------
// Change calls (require wallet)
// ---------------------------------------------------------------------------

/** Register a new grant program on-chain. */
export async function registerProgram(
  input: {
    id: string;
    name: string;
    description: string;
    organization: string;
    chains: GrantChain[];
    categories: GrantCategory[];
    fundingPool: string;
    minAmount?: string;
    maxAmount?: string;
    deadline?: string;
    website: string;
    applicationUrl?: string;
    status: ProgramStatus;
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'register_program',
    {
      id: input.id,
      name: input.name,
      description: input.description,
      organization: input.organization,
      chains: input.chains,
      categories: input.categories,
      funding_pool: input.fundingPool,
      min_amount: input.minAmount || null,
      max_amount: input.maxAmount || null,
      deadline: input.deadline || null,
      website: input.website,
      application_url: input.applicationUrl || null,
      status: input.status,
    },
    REGISTER_PROGRAM_GAS,
    '0',
    contractId
  );
}

/** Register a new project on-chain. */
export async function registerProject(
  input: {
    id: string;
    name: string;
    description: string;
    website?: string;
    teamMembers: ProjectTeamMember[];
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'register_project',
    {
      id: input.id,
      name: input.name,
      description: input.description,
      website: input.website || null,
      team_members: input.teamMembers.map((m) => ({
        account_id: m.accountId,
        name: m.name,
        role: m.role,
        profile_url: m.profileUrl || null,
      })),
    },
    REGISTER_PROJECT_GAS,
    '0',
    contractId
  );
}

/** Record a new grant application on-chain. */
export async function recordApplication(
  input: {
    id: string;
    programId: string;
    projectId: string;
    title: string;
    requestedAmount: string;
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'record_application',
    {
      id: input.id,
      program_id: input.programId,
      project_id: input.projectId,
      title: input.title,
      requested_amount: input.requestedAmount,
    },
    RECORD_APPLICATION_GAS,
    '0',
    contractId
  );
}

/** Update an application's status on-chain. */
export async function updateApplication(
  input: {
    applicationId: string;
    newStatus: GrantApplication['status'];
    fundedAmount?: string;
  },
  walletSelector: WalletSelector,
  contractId?: string
): Promise<void> {
  await callFunction(
    walletSelector,
    'update_application',
    {
      application_id: input.applicationId,
      new_status: input.newStatus,
      funded_amount: input.fundedAmount || null,
    },
    UPDATE_APPLICATION_GAS,
    '0',
    contractId
  );
}
