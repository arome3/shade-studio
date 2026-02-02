/**
 * TEE Attestation Verification
 *
 * Handles verification and formatting of Trusted Execution Environment (TEE)
 * attestations from NEAR AI Cloud. TEE attestations prove that AI inference
 * ran inside a secure enclave, protecting user data.
 */

import type { NEARAIAttestation, AttestationVerificationResult } from '@/types/ai';

/** Known TEE types and their properties */
const TEE_TYPES: Record<string, { name: string; description: string; provider: string }> = {
  'intel-tdx': {
    name: 'Intel TDX',
    description: 'Intel Trust Domain Extensions - hardware-based VM isolation with encrypted memory',
    provider: 'Intel',
  },
  'intel-sgx': {
    name: 'Intel SGX',
    description: 'Intel Software Guard Extensions - application-level enclaves for sensitive computation',
    provider: 'Intel',
  },
  'amd-sev': {
    name: 'AMD SEV',
    description: 'AMD Secure Encrypted Virtualization - encrypted VM memory protection',
    provider: 'AMD',
  },
  'amd-sev-snp': {
    name: 'AMD SEV-SNP',
    description: 'AMD SEV Secure Nested Paging - enhanced VM isolation with integrity protection',
    provider: 'AMD',
  },
  'arm-cca': {
    name: 'ARM CCA',
    description: 'ARM Confidential Compute Architecture - realm-based isolation for ARM processors',
    provider: 'ARM',
  },
};

/** Maximum age for attestation to be considered fresh (24 hours) */
const MAX_ATTESTATION_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Verify TEE attestation structure and validity
 *
 * Performs structural validation of attestation data:
 * - Required fields present
 * - Timestamp is recent
 * - TEE type is recognized
 *
 * Note: Full cryptographic verification requires server-side validation
 * against TEE manufacturer's attestation service.
 */
export function verifyAttestation(
  attestation: NEARAIAttestation | undefined | null
): AttestationVerificationResult {
  // No attestation provided
  if (!attestation) {
    return {
      isValid: false,
      status: 'unverified',
      message: 'No attestation data available',
    };
  }

  const warnings: string[] = [];

  // Check required fields
  const requiredFields = ['tee_type', 'enclave_id', 'code_hash', 'timestamp'];
  const missingFields = requiredFields.filter(
    (field) => !attestation[field as keyof NEARAIAttestation]
  );

  if (missingFields.length > 0) {
    return {
      isValid: false,
      status: 'invalid',
      message: `Missing required fields: ${missingFields.join(', ')}`,
      error: 'Attestation is malformed or incomplete',
    };
  }

  // Check TEE type is recognized
  const teeType = attestation.tee_type.toLowerCase();
  if (!TEE_TYPES[teeType]) {
    warnings.push(`Unknown TEE type: ${attestation.tee_type}`);
  }

  // Check timestamp freshness
  let attestationDate: Date;
  try {
    attestationDate = new Date(attestation.timestamp);
    if (isNaN(attestationDate.getTime())) {
      return {
        isValid: false,
        status: 'invalid',
        message: 'Invalid timestamp format',
        error: 'Timestamp could not be parsed',
      };
    }
  } catch {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Invalid timestamp format',
      error: 'Timestamp could not be parsed',
    };
  }

  const now = new Date();
  const age = now.getTime() - attestationDate.getTime();

  // Future timestamp is invalid
  if (age < -60000) {
    // Allow 1 minute clock skew
    return {
      isValid: false,
      status: 'invalid',
      message: 'Attestation timestamp is in the future',
      error: 'Clock synchronization issue or invalid attestation',
    };
  }

  // Check if attestation is too old
  if (age > MAX_ATTESTATION_AGE_MS) {
    return {
      isValid: false,
      status: 'expired',
      message: 'Attestation has expired',
      error: `Attestation is ${Math.floor(age / 3600000)} hours old (max: 24 hours)`,
      warnings,
    };
  }

  // Add warning for attestations approaching expiry
  if (age > MAX_ATTESTATION_AGE_MS * 0.75) {
    warnings.push('Attestation is approaching expiry');
  }

  // Check quote is present (required for full verification)
  if (!attestation.quote) {
    warnings.push('No quote data for cryptographic verification');
  }

  // Structural validation passed
  const teeInfo = TEE_TYPES[teeType];
  return {
    isValid: true,
    status: 'verified',
    message: teeInfo
      ? `Verified ${teeInfo.name} attestation`
      : `Verified ${attestation.tee_type} attestation`,
    verifiedAt: now.toISOString(),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Format attestation for human-readable display
 */
export function formatAttestation(attestation: NEARAIAttestation): string {
  const teeInfo = TEE_TYPES[attestation.tee_type.toLowerCase()];
  const timestamp = new Date(attestation.timestamp);

  const lines = [
    `TEE Type: ${teeInfo?.name || attestation.tee_type}`,
    `Enclave ID: ${formatHash(attestation.enclave_id)}`,
    `Code Hash: ${formatHash(attestation.code_hash)}`,
    `Timestamp: ${timestamp.toLocaleString()}`,
  ];

  if (attestation.version) {
    lines.unshift(`Version: ${attestation.version}`);
  }

  if (attestation.signature) {
    lines.push(`Signature: ${formatHash(attestation.signature)}`);
  }

  return lines.join('\n');
}

/**
 * Get description for TEE type
 */
export function getTeeDescription(teeType: string): {
  name: string;
  description: string;
  provider: string;
} {
  const info = TEE_TYPES[teeType.toLowerCase()];
  if (info) return info;

  return {
    name: teeType,
    description: 'Unknown TEE type - verification may be limited',
    provider: 'Unknown',
  };
}

/**
 * Format hash for display (truncated with ellipsis)
 */
export function formatHash(hash: string, length: number = 8): string {
  if (!hash) return 'N/A';
  if (hash.length <= length * 2 + 3) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

/**
 * Get verification status badge properties
 */
export function getVerificationBadge(result: AttestationVerificationResult): {
  color: 'green' | 'yellow' | 'red' | 'gray';
  label: string;
  icon: 'check' | 'alert' | 'x' | 'question';
} {
  switch (result.status) {
    case 'verified':
      return {
        color: result.warnings?.length ? 'yellow' : 'green',
        label: result.warnings?.length ? 'Verified (with warnings)' : 'Verified',
        icon: result.warnings?.length ? 'alert' : 'check',
      };
    case 'expired':
      return {
        color: 'yellow',
        label: 'Expired',
        icon: 'alert',
      };
    case 'invalid':
      return {
        color: 'red',
        label: 'Invalid',
        icon: 'x',
      };
    case 'unverified':
    default:
      return {
        color: 'gray',
        label: 'Unverified',
        icon: 'question',
      };
  }
}

/**
 * Create a verification report for attestation
 */
export function createVerificationReport(
  attestation: NEARAIAttestation | undefined | null
): string {
  if (!attestation) {
    return 'No attestation data available for verification.';
  }

  const result = verifyAttestation(attestation);
  const teeInfo = getTeeDescription(attestation.tee_type);

  const lines = [
    '# TEE Attestation Verification Report',
    '',
    `## Status: ${result.status.toUpperCase()}`,
    '',
    result.message,
    '',
    '## TEE Environment',
    '',
    `- **Type:** ${teeInfo.name}`,
    `- **Provider:** ${teeInfo.provider}`,
    `- **Description:** ${teeInfo.description}`,
    '',
    '## Attestation Details',
    '',
    `- **Enclave ID:** \`${attestation.enclave_id}\``,
    `- **Code Hash:** \`${attestation.code_hash}\``,
    `- **Timestamp:** ${new Date(attestation.timestamp).toLocaleString()}`,
  ];

  if (attestation.version) {
    lines.push(`- **Version:** ${attestation.version}`);
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of result.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
  }

  if (result.error) {
    lines.push('', '## Error', '', `❌ ${result.error}`);
  }

  lines.push(
    '',
    '---',
    '',
    '*Note: Full cryptographic verification requires server-side validation against the TEE manufacturer\'s attestation service.*'
  );

  return lines.join('\n');
}

/**
 * Check if attestation indicates private computation
 */
export function isPrivateComputation(
  attestation: NEARAIAttestation | undefined | null
): boolean {
  if (!attestation) return false;

  const result = verifyAttestation(attestation);
  return result.isValid;
}

/**
 * Get external verification URL for attestation
 *
 * Some TEE providers offer external verification services.
 */
export function getExternalVerificationUrl(
  attestation: NEARAIAttestation
): string | null {
  const teeType = attestation.tee_type.toLowerCase();

  // NEAR AI Cloud verification endpoint (hypothetical)
  if (attestation.quote) {
    return `https://verify.near.ai/attestation?quote=${encodeURIComponent(attestation.quote.slice(0, 64))}`;
  }

  // Intel Trust Authority for TDX/SGX
  if (teeType === 'intel-tdx' || teeType === 'intel-sgx') {
    return 'https://portal.trustauthority.intel.com/';
  }

  return null;
}
