/**
 * Agent Verification
 *
 * Codehash computation via Web Crypto API (SHA-256) and verification
 * against the on-chain registry. Also validates TEE attestation
 * documents against expected codehashes.
 *
 * Attestation verification uses a two-tier approach:
 * 1. Server-side: full cryptographic chain (preferred)
 * 2. Client-side: structural validation only (fallback)
 */

import type {
  AgentVerificationResult,
  CodehashAttestation,
} from '@/types/agents';
import { verifyAgent, getAgentInstance } from './registry-client';

// ============================================================================
// Codehash Computation
// ============================================================================

/**
 * Compute a SHA-256 codehash from a source bundle.
 *
 * Uses the Web Crypto API (crypto.subtle.digest) for browser-native
 * cryptographic hashing — no external dependencies needed.
 *
 * @param sourceBundle - Raw bytes of the agent source code bundle
 * @returns Hex-encoded SHA-256 hash
 */
export async function computeCodehash(sourceBundle: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', sourceBundle);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// On-Chain Verification
// ============================================================================

/**
 * Verify an agent's codehash against the on-chain registry.
 *
 * Calls the registry contract's `verify_instance` method which checks:
 * 1. The agent instance is registered
 * 2. The codehash matches the template's codehash
 * 3. Whether the template has been audited
 *
 * @param agentAccountId - Full NEAR account ID of the agent
 * @returns Structured verification result
 */
export async function verifyCodehash(
  agentAccountId: string
): Promise<AgentVerificationResult> {
  return verifyAgent(agentAccountId);
}

// ============================================================================
// Attestation Verification (Two-Tier)
// ============================================================================

/**
 * Verify a TEE attestation against an agent's expected codehash.
 *
 * Attempts server-side verification first (full crypto chain),
 * then falls back to client-side structural validation.
 *
 * @param agentAccountId - Full NEAR account ID of the agent
 * @param attestation - TEE attestation to verify
 * @returns Whether the attestation is valid and the verification level
 */
export async function verifyAttestation(
  agentAccountId: string,
  attestation: CodehashAttestation
): Promise<{ valid: boolean; reason?: string; level?: string }> {
  // Try server-side verification first (full crypto)
  try {
    const response = await fetch('/api/agents/verify-attestation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAccountId, attestation }),
    });
    if (response.ok) {
      const result = await response.json();
      return {
        valid: result.valid,
        reason: result.reason,
        level: result.level,
      };
    }
  } catch {
    // Fall through to client-side validation
  }

  // Fallback: client-side structural validation
  return verifyAttestationClientSide(agentAccountId, attestation);
}

/**
 * Client-side structural attestation validation.
 *
 * Checks that:
 * 1. The attestation's codehash matches the agent's registered codehash
 * 2. The attestation timestamp is recent (within 24 hours)
 * 3. The attestation document is non-empty
 */
async function verifyAttestationClientSide(
  agentAccountId: string,
  attestation: CodehashAttestation
): Promise<{ valid: boolean; reason?: string; level?: string }> {
  // Fetch the agent's registered instance
  const instance = await getAgentInstance(agentAccountId);
  if (!instance) {
    return { valid: false, reason: 'Agent instance not found in registry', level: 'none' };
  }

  // Check codehash match
  if (attestation.codehash !== instance.codehash) {
    return {
      valid: false,
      reason: `Codehash mismatch: attestation has ${attestation.codehash}, registry has ${instance.codehash}`,
      level: 'none',
    };
  }

  // Check attestation document is non-empty
  if (!attestation.attestationDocument || attestation.attestationDocument.length === 0) {
    return { valid: false, reason: 'Attestation document is empty', level: 'none' };
  }

  // Check attestation is recent (within 24 hours)
  const attestationTime = new Date(attestation.timestamp).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (now - attestationTime > twentyFourHours) {
    return { valid: false, reason: 'Attestation is older than 24 hours', level: 'none' };
  }

  return { valid: true, level: 'structural' };
}
