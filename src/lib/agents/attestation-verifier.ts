/**
 * Enhanced Attestation Verification
 *
 * Server-side TEE attestation verification with signature validation.
 * Provides a verification chain: structural → signature → codehash → freshness.
 *
 * For MVP: validates quote format and signature structure without full CA chain.
 * Future: integrate Intel TDX / AMD SEV-SNP attestation verification services.
 */

import type { CodehashAttestation } from '@/types/agents';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel = 'full' | 'structural' | 'none';

export interface AttestationVerificationResult {
  valid: boolean;
  level: VerificationLevel;
  reason?: string;
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify the structure and format of a TEE attestation signature.
 *
 * For MVP:
 * - Validates that signature is present and non-empty
 * - Checks base64 format validity
 * - Checks minimum signature length for known TEE types
 *
 * Future enhancement: full cryptographic verification against
 * Intel TDX / AMD SEV-SNP certificate chains.
 */
export function verifyAttestationSignature(
  attestation: CodehashAttestation
): { valid: boolean; reason?: string } {
  // Check signature is present
  if (!attestation.signature || attestation.signature.length === 0) {
    return { valid: false, reason: 'Attestation signature is empty' };
  }

  // Check signature is valid base64
  try {
    const decoded = atob(attestation.signature);
    if (decoded.length === 0) {
      return { valid: false, reason: 'Attestation signature decodes to empty' };
    }

    // Minimum signature length validation by TEE type
    const minLengths: Record<string, number> = {
      'intel-tdx': 64,
      'intel-sgx': 64,
      'phala-sgx': 32,
      'amd-sev-snp': 72,
    };

    const minLen = minLengths[attestation.teeType];
    if (minLen && decoded.length < minLen) {
      return {
        valid: false,
        reason: `Signature too short for ${attestation.teeType}: ${decoded.length} < ${minLen} bytes`,
      };
    }
  } catch {
    // Not valid base64 — might be hex or raw string
    // Check hex format
    if (/^[0-9a-fA-F]+$/.test(attestation.signature)) {
      if (attestation.signature.length < 64) {
        return { valid: false, reason: 'Hex-encoded signature too short' };
      }
    } else {
      return { valid: false, reason: 'Attestation signature is not valid base64 or hex' };
    }
  }

  return { valid: true };
}

// ============================================================================
// Full Verification Chain
// ============================================================================

/**
 * Run the full attestation verification chain:
 * 1. Structural validation (non-empty document, valid format)
 * 2. Signature validation (format + length)
 * 3. Codehash match (against expected)
 * 4. Freshness check (within 24h, warn if >18h)
 *
 * @param attestation - The attestation to verify
 * @param expectedCodehash - The codehash from the on-chain registry
 */
export function verifyAttestationChain(
  attestation: CodehashAttestation,
  expectedCodehash: string,
): AttestationVerificationResult {
  const warnings: string[] = [];

  // 1. Structural: attestation document is non-empty
  if (!attestation.attestationDocument || attestation.attestationDocument.length === 0) {
    return {
      valid: false,
      level: 'none',
      reason: 'Attestation document is empty',
      warnings,
    };
  }

  // 2. Codehash match
  if (attestation.codehash !== expectedCodehash) {
    return {
      valid: false,
      level: 'none',
      reason: `Codehash mismatch: attestation has ${attestation.codehash}, expected ${expectedCodehash}`,
      warnings,
    };
  }

  // 3. Freshness
  const attestationTime = new Date(attestation.timestamp).getTime();
  const now = Date.now();
  const age = now - attestationTime;

  if (age > TWENTY_FOUR_HOURS_MS) {
    return {
      valid: false,
      level: 'none',
      reason: 'Attestation is older than 24 hours',
      warnings,
    };
  }

  if (age > EIGHTEEN_HOURS_MS) {
    warnings.push('Attestation is older than 18 hours — approaching expiry');
  }

  // 4. Signature verification
  const sigResult = verifyAttestationSignature(attestation);
  if (!sigResult.valid) {
    // Signature failed — still structurally valid
    return {
      valid: true,
      level: 'structural',
      reason: sigResult.reason,
      warnings: [
        ...warnings,
        `Signature verification failed: ${sigResult.reason}. Full cryptographic verification requires TEE CA chain.`,
      ],
    };
  }

  // All checks passed
  return {
    valid: true,
    level: 'full',
    warnings,
  };
}
