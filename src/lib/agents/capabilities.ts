/**
 * Agent Capability Definitions
 *
 * Static definitions mapping each AgentCapability to human-readable
 * metadata, required NEAR access key permissions, and compatibility
 * helpers. Follows the PERMISSION_CONFIGS pattern from project-accounts.
 */

import { config } from '@/lib/config';
import type { AgentCapability, AgentPermission } from '@/types/agents';

// ============================================================================
// Capability Configuration
// ============================================================================

export interface CapabilityConfig {
  /** Human-readable label */
  label: string;
  /** Description of what this capability allows */
  description: string;
  /** Lucide icon name for UI rendering */
  icon: string;
  /** Risk level for display purposes */
  risk: 'low' | 'medium' | 'high';
  /** NEAR permissions required for this capability */
  requiredPermissions: AgentPermission[];
}

/** Full capability configuration mapping */
export const CAPABILITY_CONFIGS: Record<AgentCapability, CapabilityConfig> = {
  'read-documents': {
    label: 'Read Documents',
    description: 'Access and read project documents stored on NEAR Social',
    icon: 'FileText',
    risk: 'low',
    requiredPermissions: [{
      receiverId: config.near.socialContractId,
      methodNames: ['get'],
      allowance: '250000000000000000000000', // 0.25 NEAR
      purpose: 'Read document data from social contract',
    }],
  },
  'write-documents': {
    label: 'Write Documents',
    description: 'Create and modify project documents on NEAR Social',
    icon: 'FilePen',
    risk: 'high',
    requiredPermissions: [{
      receiverId: config.near.socialContractId,
      methodNames: ['set'],
      allowance: '500000000000000000000000', // 0.5 NEAR
      purpose: 'Write document data to social contract',
    }],
  },
  'ai-chat': {
    label: 'AI Chat',
    description: 'Send prompts to the AI service for conversational responses',
    icon: 'MessageSquare',
    risk: 'low',
    requiredPermissions: [],
  },
  'ai-analysis': {
    label: 'AI Analysis',
    description: 'Submit long-running AI analysis jobs via the async pipeline',
    icon: 'Brain',
    risk: 'medium',
    requiredPermissions: [{
      receiverId: config.asyncAI.contractId,
      methodNames: ['submit_job'],
      allowance: '100000000000000000000000', // 0.1 NEAR
      purpose: 'Submit AI analysis jobs to async processor',
    }],
  },
  'blockchain-read': {
    label: 'Blockchain Read',
    description: 'Query NEAR blockchain state via RPC',
    icon: 'Search',
    risk: 'low',
    requiredPermissions: [],
  },
  'blockchain-write': {
    label: 'Blockchain Write',
    description: 'Submit transactions to NEAR contracts',
    icon: 'Send',
    risk: 'high',
    requiredPermissions: [{
      receiverId: config.near.contractId,
      methodNames: [],
      allowance: '1000000000000000000000000', // 1 NEAR
      purpose: 'Execute transactions on the main contract',
    }],
  },
  'ipfs-read': {
    label: 'IPFS Read',
    description: 'Retrieve content from IPFS via the gateway',
    icon: 'Download',
    risk: 'low',
    requiredPermissions: [],
  },
  'ipfs-write': {
    label: 'IPFS Write',
    description: 'Pin content to IPFS via Pinata',
    icon: 'Upload',
    risk: 'medium',
    requiredPermissions: [],
  },
  'social-read': {
    label: 'Social Read',
    description: 'Read data from the NEAR Social contract',
    icon: 'Eye',
    risk: 'low',
    requiredPermissions: [{
      receiverId: config.near.socialContractId,
      methodNames: ['get'],
      allowance: '250000000000000000000000', // 0.25 NEAR
      purpose: 'Read social contract data',
    }],
  },
  'social-write': {
    label: 'Social Write',
    description: 'Write data to the NEAR Social contract',
    icon: 'Pencil',
    risk: 'high',
    requiredPermissions: [{
      receiverId: config.near.socialContractId,
      methodNames: ['set', 'grant_write_permission'],
      allowance: '1000000000000000000000000', // 1 NEAR
      purpose: 'Write and manage social contract data',
    }],
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the configuration for a specific capability.
 */
export function getCapabilityConfig(capability: AgentCapability): CapabilityConfig {
  return CAPABILITY_CONFIGS[capability];
}

/**
 * Aggregate all required permissions for a set of capabilities.
 * Deduplicates by receiverId, merging method names.
 */
export function aggregatePermissions(
  capabilities: AgentCapability[]
): AgentPermission[] {
  const permMap = new Map<string, AgentPermission>();

  for (const cap of capabilities) {
    const cfg = CAPABILITY_CONFIGS[cap];
    for (const perm of cfg.requiredPermissions) {
      const existing = permMap.get(perm.receiverId);
      if (existing) {
        // Merge method names (deduplicate)
        const methods = new Set([...existing.methodNames, ...perm.methodNames]);
        // Take the higher allowance
        const existingAllowance = BigInt(existing.allowance);
        const newAllowance = BigInt(perm.allowance);
        permMap.set(perm.receiverId, {
          ...existing,
          methodNames: [...methods],
          allowance: (existingAllowance > newAllowance ? existingAllowance : newAllowance).toString(),
          purpose: `${existing.purpose}; ${perm.purpose}`,
        });
      } else {
        permMap.set(perm.receiverId, { ...perm });
      }
    }
  }

  return [...permMap.values()];
}

/**
 * Get the maximum risk level from a set of capabilities.
 */
export function getMaxRiskLevel(
  capabilities: AgentCapability[]
): 'low' | 'medium' | 'high' {
  const riskOrder = { low: 0, medium: 1, high: 2 };
  let max: 'low' | 'medium' | 'high' = 'low';

  for (const cap of capabilities) {
    const cfg = CAPABILITY_CONFIGS[cap];
    if (riskOrder[cfg.risk] > riskOrder[max]) {
      max = cfg.risk;
    }
  }

  return max;
}
