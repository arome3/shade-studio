/**
 * Shade Agents Domain Types
 *
 * Types for user-owned AI agents deployed as NEAR sub-accounts with
 * on-chain codehash verification, TEE attestation, and granular
 * permission boundaries via access keys.
 */

import { z } from 'zod';
import type { NEARAIAttestation } from '@/types/ai';

// ============================================================================
// Capability & Permission Types
// ============================================================================

/** Agent capability — what the agent can do */
export type AgentCapability =
  | 'read-documents'
  | 'write-documents'
  | 'ai-chat'
  | 'ai-analysis'
  | 'blockchain-read'
  | 'blockchain-write'
  | 'ipfs-read'
  | 'ipfs-write'
  | 'social-read'
  | 'social-write';

/** NEAR access key permission for an agent */
export interface AgentPermission {
  /** Contract the key can call */
  receiverId: string;
  /** Methods the key can call (empty = all) */
  methodNames: string[];
  /** Allowance in yoctoNEAR */
  allowance: string;
  /** Human-readable purpose */
  purpose: string;
}

// ============================================================================
// Agent Status
// ============================================================================

/** Lifecycle status of a deployed agent instance */
export type AgentStatus = 'active' | 'paused' | 'deactivated';

// ============================================================================
// Core Entities
// ============================================================================

/** Template registered in the on-chain registry */
export interface AgentTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the agent does */
  description: string;
  /** Semantic version string */
  version: string;
  /** SHA-256 hash of the agent source code bundle */
  codehash: string;
  /** URL to the source code repository */
  sourceUrl: string;
  /** URL to audit report (if audited) */
  auditUrl?: string;
  /** NEAR account of the template creator */
  creator: string;
  /** Capabilities this agent template requires */
  capabilities: AgentCapability[];
  /** NEAR access key permissions required */
  requiredPermissions: AgentPermission[];
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Total number of deployments */
  deployments: number;
  /** Whether the codehash has been audited */
  isAudited: boolean;
}

/** A deployed agent instance (NEAR sub-account) */
export interface AgentInstance {
  /** Full NEAR account ID (e.g., "my-agent.alice.testnet") */
  accountId: string;
  /** Owner's NEAR account ID */
  ownerAccountId: string;
  /** ID of the template this agent was deployed from */
  templateId: string;
  /** Expected codehash (from template at deploy time) */
  codehash: string;
  /** Human-readable name */
  name: string;
  /** Current lifecycle status */
  status: AgentStatus;
  /** ISO 8601 timestamp of last activity */
  lastActiveAt?: string;
  /** ISO 8601 deployment timestamp */
  deployedAt: string;
  /** Most recent TEE attestation */
  lastAttestation?: CodehashAttestation;
  /** Total invocation count */
  invocationCount: number;
  /** Capabilities granted to this instance */
  capabilities: AgentCapability[];
}

/** TEE codehash attestation */
export interface CodehashAttestation {
  /** SHA-256 codehash being attested */
  codehash: string;
  /** TEE type (e.g., "intel-tdx", "phala-sgx") */
  teeType: string;
  /** Raw attestation document */
  attestationDocument: string;
  /** Signature over the attestation */
  signature: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether the attestation has been verified */
  verified: boolean;
}

/** Agent invocation request/response record */
export interface AgentInvocation {
  /** Unique invocation ID */
  id: string;
  /** Agent account that handled the invocation */
  agentAccountId: string;
  /** Invocation type / action */
  type: string;
  /** Request payload */
  payload: Record<string, unknown>;
  /** Response data (if completed) */
  response?: Record<string, unknown>;
  /** TEE attestation for the response */
  attestation?: NEARAIAttestation;
  /** Invocation status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** ISO 8601 timestamp */
  timestamp: string;
}

/** On-chain verification result */
export interface AgentVerificationResult {
  /** Whether the agent's codehash matches the registry */
  valid: boolean;
  /** Reason if invalid */
  reason?: string;
  /** Whether the template has been audited */
  isAudited: boolean;
  /** Latest attestation (if any) */
  attestation?: CodehashAttestation;
}

/** Registry statistics */
export interface AgentRegistryStats {
  /** Total registered templates */
  totalTemplates: number;
  /** Total deployed agent instances */
  totalDeployments: number;
  /** Number of verified codehashes */
  verifiedCodehashes: number;
}

// ============================================================================
// Display Helpers
// ============================================================================

/** Human-readable status labels */
export const AGENT_STATUS_DISPLAY: Record<AgentStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  deactivated: { label: 'Deactivated', variant: 'error' },
};

/** Human-readable capability labels */
export const CAPABILITY_LABELS: Record<AgentCapability, string> = {
  'read-documents': 'Read Documents',
  'write-documents': 'Write Documents',
  'ai-chat': 'AI Chat',
  'ai-analysis': 'AI Analysis',
  'blockchain-read': 'Blockchain Read',
  'blockchain-write': 'Blockchain Write',
  'ipfs-read': 'IPFS Read',
  'ipfs-write': 'IPFS Write',
  'social-read': 'Social Read',
  'social-write': 'Social Write',
};

/** Lucide icon names for each capability */
export const CAPABILITY_ICONS: Record<AgentCapability, string> = {
  'read-documents': 'FileText',
  'write-documents': 'FilePen',
  'ai-chat': 'MessageSquare',
  'ai-analysis': 'Brain',
  'blockchain-read': 'Search',
  'blockchain-write': 'Send',
  'ipfs-read': 'Download',
  'ipfs-write': 'Upload',
  'social-read': 'Eye',
  'social-write': 'Pencil',
};

// ============================================================================
// Zod Schemas
// ============================================================================

/** All valid capability strings */
export const AGENT_CAPABILITIES = [
  'read-documents',
  'write-documents',
  'ai-chat',
  'ai-analysis',
  'blockchain-read',
  'blockchain-write',
  'ipfs-read',
  'ipfs-write',
  'social-read',
  'social-write',
] as const;

/** Validate a single capability */
export const AgentCapabilitySchema = z.enum(AGENT_CAPABILITIES);

/** Validate an agent permission */
export const AgentPermissionSchema = z.object({
  receiverId: z.string().min(2).max(64),
  methodNames: z.array(z.string()),
  allowance: z.string().regex(/^\d+$/, 'Must be a numeric string (yoctoNEAR)'),
  purpose: z.string().min(1).max(200),
});

/** Validate deploy agent input */
export const DeployAgentSchema = z.object({
  templateId: z.string().min(1, 'Template is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(32, 'Slug must be at most 32 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Only lowercase letters, numbers, and hyphens (cannot start/end with hyphen)'
    ),
});

/** Validate invoke agent input */
export const InvokeAgentSchema = z.object({
  agentAccountId: z.string().min(2).max(64),
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  verifyCodehash: z.boolean().optional(),
  verifyAttestation: z.boolean().optional(),
});
