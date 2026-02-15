/**
 * Capability Boundary Enforcement
 *
 * Maps invocation types and payload operations to required capabilities.
 * Used by both the API route (server-side) and the executor to ensure
 * agents only perform actions within their declared capabilities.
 */

import type { AgentCapability } from '@/types/agents';

// ============================================================================
// Types
// ============================================================================

export interface EnforcementResult {
  allowed: boolean;
  violations: string[];
}

// ============================================================================
// Invocation Type → Required Capabilities Mapping
// ============================================================================

/**
 * Map of invocation types to the capabilities they require.
 * An invocation type requires ALL listed capabilities to proceed.
 */
const TYPE_CAPABILITY_MAP: Record<string, AgentCapability[]> = {
  // AI-related invocations
  'chat': ['ai-chat'],
  'analysis': ['ai-analysis'],
  'analyze': ['ai-analysis'],
  'summarize': ['ai-chat', 'read-documents'],

  // Document operations
  'read-document': ['read-documents'],
  'write-document': ['write-documents'],

  // Blockchain operations
  'blockchain-query': ['blockchain-read'],
  'blockchain-tx': ['blockchain-write'],

  // IPFS operations
  'ipfs-fetch': ['ipfs-read'],
  'ipfs-pin': ['ipfs-write'],

  // Social operations
  'social-read': ['social-read'],
  'social-write': ['social-write'],

  // Default / generic invocations
  'default': ['ai-chat'],
};

// ============================================================================
// Payload Operation → Required Capabilities
// ============================================================================

/** Keywords in payload that imply certain capability requirements */
const PAYLOAD_CAPABILITY_SIGNALS: Array<{
  /** Key in the payload to check */
  key: string;
  /** Values that trigger the capability requirement (empty = any truthy value) */
  values?: string[];
  /** Capability required */
  requires: AgentCapability;
}> = [
  { key: 'writeToChain', requires: 'blockchain-write' },
  { key: 'submitTransaction', requires: 'blockchain-write' },
  { key: 'pinToIPFS', requires: 'ipfs-write' },
  { key: 'updateSocial', requires: 'social-write' },
  { key: 'writeDocument', requires: 'write-documents' },
];

// ============================================================================
// Enforcement
// ============================================================================

/**
 * Enforce that an invocation's type and payload are within the agent's
 * declared capabilities.
 *
 * @param agentCapabilities - Capabilities the agent has
 * @param invocationType - The invocation type being requested
 * @param payload - The invocation payload
 * @returns Whether the invocation is allowed and any violations
 */
export function enforceCapabilities(
  agentCapabilities: AgentCapability[],
  invocationType: string,
  payload: Record<string, unknown>,
): EnforcementResult {
  const violations: string[] = [];
  const capSet = new Set(agentCapabilities);

  // 1. Check invocation type requirements
  const requiredForType = TYPE_CAPABILITY_MAP[invocationType];
  if (requiredForType) {
    for (const required of requiredForType) {
      if (!capSet.has(required)) {
        violations.push(
          `Invocation type "${invocationType}" requires capability "${required}"`
        );
      }
    }
  }
  // Unknown types: allow if agent has at least ai-chat (generic execution)
  if (!requiredForType && !capSet.has('ai-chat') && !capSet.has('ai-analysis')) {
    violations.push(
      `Unknown invocation type "${invocationType}" requires at least ai-chat or ai-analysis capability`
    );
  }

  // 2. Check payload signals
  for (const signal of PAYLOAD_CAPABILITY_SIGNALS) {
    const value = payload[signal.key];
    if (value === undefined || value === null || value === false) continue;

    if (signal.values && typeof value === 'string') {
      if (!signal.values.includes(value)) continue;
    }

    if (!capSet.has(signal.requires)) {
      violations.push(
        `Payload field "${signal.key}" requires capability "${signal.requires}"`
      );
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}
