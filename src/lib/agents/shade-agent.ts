/**
 * Shade Agent Management
 *
 * Core orchestration module for agent lifecycle: deploy, invoke,
 * deactivate. Chains together sub-account creation, key generation,
 * registry registration, and encrypted key storage.
 *
 * Reuses directly from Module 21:
 * - buildCreateSubAccountActions() for sub-account creation
 * - nearToYocto() for deposit conversion
 * - generateKeyPair() for ed25519 key generation
 * - checkAccountExists() for account existence checks
 * - validateSubAccountName() for slug validation
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type {
  AgentInstance,
  AgentInvocation,
  AgentTemplate,
  CodehashAttestation,
} from '@/types/agents';
import {
  validateSubAccountName,
  checkAccountExists,
  nearToYocto,
} from '@/lib/near/project-accounts';
import { generateKeyPair } from '@/lib/near/access-keys';
import type { WalletAction } from '@/types/project-accounts';
import {
  getTemplate,
  registerAgentInstance,
  deactivateAgentOnChain,
  getAgentInstance,
} from './registry-client';
import { verifyCodehash, verifyAttestation } from './verification';
import { storeAgentKey, removeAgentKey, clearAllAgentKeys } from './agent-keys';
import { aggregatePermissions } from './capabilities';
import {
  saveOrphanedDeployment,
  removeOrphanedDeployment,
} from './deploy-recovery';

// ============================================================================
// Error Types
// ============================================================================

export class AgentDeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentDeployError';
  }
}

export class AgentInvokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentInvokeError';
  }
}

// ============================================================================
// Deploy Lock
// ============================================================================

/** In-flight slug lock to prevent concurrent deploys of the same agent name */
const pendingSlugs = new Set<string>();

// ============================================================================
// Deploy
// ============================================================================

export interface DeployAgentOptions {
  templateId: string;
  name: string;
  slug: string;
  ownerAccountId: string;
  walletSelector: WalletSelector;
  encrypt: (data: string) => Promise<{ encrypted: string; nonce: string }>;
}

/**
 * Deploy a new Shade Agent as a NEAR sub-account.
 *
 * Steps:
 * 1. Validate slug via SubAccountNameSchema
 * 2. Fetch template from registry
 * 3. Check sub-account doesn't already exist
 * 4. Generate owner + execution key pairs
 * 5. Build wallet actions: CreateAccount, Transfer, AddKey(owner), AddKey(execution)
 * 6. Sign and send via wallet selector
 * 7. Register instance on-chain via registry contract
 * 8. Store encrypted keys
 * 9. Return AgentInstance
 */
export async function deployAgent(
  options: DeployAgentOptions
): Promise<AgentInstance> {
  const { slug, ownerAccountId } = options;

  // 0. Slug-level lock — prevent concurrent deploys of the same agent name
  const fullSlug = `${slug}.${ownerAccountId}`;
  if (pendingSlugs.has(fullSlug)) {
    throw new AgentDeployError('A deployment for this agent name is already in progress');
  }
  pendingSlugs.add(fullSlug);

  try {
    return await deployAgentInner(options);
  } finally {
    pendingSlugs.delete(fullSlug);
  }
}

async function deployAgentInner(
  options: DeployAgentOptions
): Promise<AgentInstance> {
  const { templateId, name, slug, ownerAccountId, walletSelector, encrypt } = options;

  // 1. Validate slug
  const validation = validateSubAccountName(slug, ownerAccountId);
  if (!validation.valid) {
    throw new AgentDeployError(validation.error ?? 'Invalid agent slug');
  }

  const agentAccountId = validation.fullAccountId!;

  // 2. Fetch template
  const template = await getTemplate(templateId);
  if (!template) {
    throw new AgentDeployError(`Template not found: ${templateId}`);
  }

  // 3. Check account doesn't exist
  const existing = await checkAccountExists(agentAccountId);
  if (existing) {
    throw new AgentDeployError(`Account already exists: ${agentAccountId}`);
  }

  // 4. Generate key pairs
  const ownerKeyPair = generateKeyPair();
  const executionKeyPair = generateKeyPair();

  // 5. Build wallet actions
  const aggregatedPerms = aggregatePermissions(template.capabilities);
  const actions = buildAgentDeployActions(
    ownerKeyPair.publicKey,
    executionKeyPair.publicKey,
    '0.5',
    aggregatedPerms,
    template,
  );

  // 6. Sign and send — POINT OF NO RETURN: sub-account is created
  const wallet = await walletSelector.wallet();
  await wallet.signAndSendTransaction({
    receiverId: agentAccountId,
    actions,
  });

  // Save orphan manifest BEFORE attempting registration so we can recover
  const orphanManifest = {
    agentAccountId,
    ownerAccountId,
    templateId: template.id,
    templateCodehash: template.codehash,
    agentName: name,
    capabilities: template.capabilities,
    failedStep: 'registration' as const,
    createdAt: new Date().toISOString(),
    ownerPublicKey: ownerKeyPair.publicKey,
  };
  saveOrphanedDeployment(orphanManifest);

  try {
    // 7. Register on-chain
    await registerAgentInstance(
      {
        agentAccountId,
        ownerAccountId,
        templateId: template.id,
        codehash: template.codehash,
        name,
        capabilities: template.capabilities,
      },
      walletSelector
    );

    // Update orphan manifest for key storage step
    saveOrphanedDeployment({ ...orphanManifest, failedStep: 'key-storage' });

    // 8. Store encrypted keys
    const ownerEncrypted = await encrypt(ownerKeyPair.secretKey);
    storeAgentKey({
      agentAccountId,
      keyType: 'owner',
      publicKey: ownerKeyPair.publicKey,
      encryptedPrivateKey: ownerEncrypted.encrypted,
      nonce: ownerEncrypted.nonce,
    });

    const execEncrypted = await encrypt(executionKeyPair.secretKey);
    storeAgentKey({
      agentAccountId,
      keyType: 'execution',
      publicKey: executionKeyPair.publicKey,
      encryptedPrivateKey: execEncrypted.encrypted,
      nonce: execEncrypted.nonce,
    });

    // 9. Success — remove orphan manifest
    removeOrphanedDeployment(agentAccountId);
  } catch (err) {
    // Orphan manifest already saved — user can recover later
    throw new AgentDeployError(
      `Agent sub-account created but registration failed. ` +
      `Use the recovery tool to complete setup. Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // 10. Return instance
  return {
    accountId: agentAccountId,
    ownerAccountId,
    templateId: template.id,
    codehash: template.codehash,
    name,
    status: 'active',
    deployedAt: new Date().toISOString(),
    invocationCount: 0,
    capabilities: template.capabilities,
  };
}

/**
 * Build wallet actions for creating an agent sub-account.
 */
function buildAgentDeployActions(
  ownerPublicKey: string,
  executionPublicKey: string,
  depositNear: string,
  permissions: { receiverId: string; methodNames: string[]; allowance: string }[],
  template: AgentTemplate,
): WalletAction[] {
  const actions: WalletAction[] = [
    { type: 'CreateAccount' },
    {
      type: 'Transfer',
      params: { deposit: nearToYocto(depositNear) },
    },
    // Owner key — FullAccess
    {
      type: 'AddKey',
      params: {
        publicKey: ownerPublicKey,
        accessKey: { permission: 'FullAccess' },
      },
    },
  ];

  // Execution key — FunctionCall with aggregated permissions
  // Use the first permission's receiverId or the registry contract as default
  if (permissions.length > 0) {
    const perm = permissions[0]!;
    actions.push({
      type: 'AddKey',
      params: {
        publicKey: executionPublicKey,
        accessKey: {
          permission: {
            receiverId: perm.receiverId,
            methodNames: perm.methodNames,
            allowance: perm.allowance,
          },
        },
      },
    });
  } else {
    // Default: FunctionCall key limited to the registry contract
    actions.push({
      type: 'AddKey',
      params: {
        publicKey: executionPublicKey,
        accessKey: {
          permission: {
            receiverId: template.id,
            methodNames: [],
            allowance: nearToYocto('0.25'),
          },
        },
      },
    });
  }

  return actions;
}

// ============================================================================
// Invoke
// ============================================================================

export interface InvokeAgentOptions {
  /** Whether to verify codehash before invocation */
  verifyBeforeInvoke?: boolean;
  /** Whether to verify TEE attestation on response */
  verifyResponseAttestation?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Invoke an agent with a payload.
 *
 * Optionally verifies codehash before invocation and
 * TEE attestation on the response.
 */
export async function invokeAgent(
  agentAccountId: string,
  type: string,
  payload: Record<string, unknown>,
  options: InvokeAgentOptions = {}
): Promise<AgentInvocation> {
  const { verifyBeforeInvoke, verifyResponseAttestation, signal } = options;

  // Optional pre-invocation codehash verification
  if (verifyBeforeInvoke) {
    const verification = await verifyCodehash(agentAccountId);
    if (!verification.valid) {
      throw new AgentInvokeError(
        `Codehash verification failed: ${verification.reason ?? 'unknown reason'}`
      );
    }
  }

  // Call the agent invocation API
  const invocationId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const response = await fetch('/api/agents/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentAccountId,
      type,
      payload,
      invocationId,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new AgentInvokeError(`Agent invocation failed: ${response.status} — ${errorText}`);
  }

  const result = await response.json();

  // Optional post-invocation attestation verification
  if (verifyResponseAttestation && result.attestation) {
    const attestation: CodehashAttestation = result.attestation;
    const attestVerify = await verifyAttestation(agentAccountId, attestation);
    if (!attestVerify.valid) {
      throw new AgentInvokeError(
        `Response attestation verification failed: ${attestVerify.reason ?? 'unknown reason'}`
      );
    }
  }

  return {
    id: invocationId,
    agentAccountId,
    type,
    payload,
    response: result.data,
    attestation: result.attestation,
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Deactivate
// ============================================================================

/**
 * Deactivate an agent and clean up its keys.
 *
 * 1. Deactivate on-chain via registry contract
 * 2. Remove execution key (keep owner key for recovery)
 */
export async function deactivateAgent(
  agentAccountId: string,
  walletSelector: WalletSelector
): Promise<void> {
  // 1. Deactivate on-chain
  await deactivateAgentOnChain(agentAccountId, walletSelector);

  // 2. Remove execution key
  removeAgentKey(agentAccountId, 'execution');
}

/**
 * Fully remove an agent and all its keys.
 * Use with caution — this is irreversible.
 */
export async function removeAgent(
  agentAccountId: string,
  walletSelector: WalletSelector
): Promise<void> {
  await deactivateAgentOnChain(agentAccountId, walletSelector);
  clearAllAgentKeys(agentAccountId);
}

/**
 * Fetch the current on-chain state of an agent instance.
 */
export async function refreshAgentState(
  agentAccountId: string
): Promise<AgentInstance | null> {
  return getAgentInstance(agentAccountId);
}
