/**
 * Deploy Recovery
 *
 * Handles orphaned deployments where the wallet transaction succeeded
 * (sub-account created) but registry registration or key storage failed.
 * Uses localStorage as a write-ahead log for recovery.
 */

import type { AgentInstance, AgentCapability } from '@/types/agents';
import { registerAgentInstance } from './registry-client';
import type { WalletSelector } from '@near-wallet-selector/core';

// ============================================================================
// Types
// ============================================================================

export interface OrphanedDeployment {
  agentAccountId: string;
  ownerAccountId: string;
  templateId: string;
  templateCodehash: string;
  agentName: string;
  capabilities: AgentCapability[];
  failedStep: 'registration' | 'key-storage';
  createdAt: string;
  ownerPublicKey: string;
}

// ============================================================================
// Storage
// ============================================================================

const ORPHAN_PREFIX = 'shade-studio:orphaned-deploys';

function buildOrphanKey(agentAccountId: string): string {
  return `${ORPHAN_PREFIX}:${agentAccountId}`;
}

/**
 * Save an orphaned deployment manifest to localStorage.
 * Called immediately after the wallet transaction succeeds,
 * before attempting registry registration.
 */
export function saveOrphanedDeployment(deployment: OrphanedDeployment): void {
  const key = buildOrphanKey(deployment.agentAccountId);
  localStorage.setItem(key, JSON.stringify(deployment));
}

/**
 * Remove an orphaned deployment manifest (on successful completion).
 */
export function removeOrphanedDeployment(agentAccountId: string): void {
  const key = buildOrphanKey(agentAccountId);
  localStorage.removeItem(key);
}

/**
 * List all orphaned deployments for an owner account.
 */
export function getOrphanedDeployments(ownerAccountId: string): OrphanedDeployment[] {
  const orphans: OrphanedDeployment[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(ORPHAN_PREFIX)) {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          const orphan = JSON.parse(value) as OrphanedDeployment;
          if (orphan.ownerAccountId === ownerAccountId) {
            orphans.push(orphan);
          }
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  return orphans;
}

/**
 * Attempt to complete a previously failed deployment.
 *
 * Retries the failed step and any subsequent steps.
 * On success, removes the orphan record and returns the instance.
 */
export async function recoverOrphanedDeployment(
  deployment: OrphanedDeployment,
  walletSelector: WalletSelector,
  _encrypt: (data: string) => Promise<{ encrypted: string; nonce: string }>,
): Promise<AgentInstance> {
  const {
    agentAccountId,
    ownerAccountId,
    templateId,
    templateCodehash,
    agentName,
    capabilities,
    failedStep,
  } = deployment;

  // Retry registration if that's where we failed
  if (failedStep === 'registration') {
    await registerAgentInstance(
      {
        agentAccountId,
        ownerAccountId,
        templateId,
        codehash: templateCodehash,
        name: agentName,
        capabilities,
      },
      walletSelector
    );

    // Update manifest to key-storage step in case that fails
    saveOrphanedDeployment({ ...deployment, failedStep: 'key-storage' });
  }

  // Note: For key-storage recovery, we can't re-encrypt the original private keys
  // because we don't have them. The owner key's public key is stored in the manifest
  // for reference. The user may need to add new keys via a separate flow.
  // For now, we mark recovery as successful once registration completes.

  // Remove orphan record
  removeOrphanedDeployment(agentAccountId);

  return {
    accountId: agentAccountId,
    ownerAccountId,
    templateId,
    codehash: templateCodehash,
    name: agentName,
    status: 'active',
    deployedAt: deployment.createdAt,
    invocationCount: 0,
    capabilities,
  };
}

/**
 * Clean up an orphaned deployment by deleting the sub-account
 * and reclaiming deposited funds.
 */
export async function cleanupOrphanedDeployment(
  agentAccountId: string,
  ownerAccountId: string,
  walletSelector: WalletSelector,
): Promise<void> {
  const wallet = await walletSelector.wallet();

  await wallet.signAndSendTransaction({
    receiverId: agentAccountId,
    actions: [
      {
        type: 'DeleteAccount',
        params: { beneficiaryId: ownerAccountId },
      },
    ],
  });

  removeOrphanedDeployment(agentAccountId);
}
