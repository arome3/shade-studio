/**
 * Attestation Verification Types
 *
 * Comprehensive type definitions for TEE attestation verification system.
 * Provides multi-step verification with caching, detailed feedback, and
 * educational components for Private Grant Studio.
 */

import type { NEARAIAttestation } from './ai';

// ============================================================================
// TEE Types
// ============================================================================

/** Supported TEE technology types */
export type TEEType =
  | 'intel-tdx'
  | 'intel-sgx'
  | 'amd-sev'
  | 'amd-sev-snp'
  | 'arm-cca'
  | 'nvidia-cc'
  | 'unknown';

/** Security level rating (1-5, 5 being most secure) */
export type SecurityLevel = 1 | 2 | 3 | 4 | 5;

/** TEE information including provider details and security characteristics */
export interface TEEInfo {
  /** TEE type identifier */
  type: TEEType;
  /** Human-readable name */
  name: string;
  /** Hardware provider */
  provider: string;
  /** Detailed description of the TEE technology */
  description: string;
  /** Security level (1-5) */
  securityLevel: SecurityLevel;
  /** URL to official documentation */
  documentationUrl?: string;
  /** Key security features */
  features: string[];
}

// ============================================================================
// Attestation Types
// ============================================================================

/** Extended TEE attestation with all verification fields */
export interface TEEAttestation {
  /** Attestation version */
  version?: string;
  /** TEE type (e.g., 'intel-tdx', 'amd-sev') */
  tee_type: string;
  /** Enclave/VM identifier */
  enclave_id: string;
  /** Hash of code running in TEE */
  code_hash: string;
  /** Attestation timestamp (ISO 8601) */
  timestamp: string;
  /** Raw attestation quote (base64) */
  quote?: string;
  /** Additional claims */
  claims?: Record<string, unknown>;
  /** Signature over attestation (base64) */
  signature?: string;
  /** Public key for signature verification */
  public_key?: string;
  /** Certificate chain for verification */
  certificate_chain?: string[];
}

// ============================================================================
// Verification Types
// ============================================================================

/** Verification step identifiers */
export type VerificationStepId =
  | 'structure'
  | 'timestamp'
  | 'tee_type'
  | 'code_hash'
  | 'signature'
  | 'remote';

/** Status of a verification step */
export type VerificationStepStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'warning';

/** Error codes for verification failures */
export type VerificationErrorCode =
  | 'INVALID_STRUCTURE'
  | 'MISSING_FIELD'
  | 'INVALID_TIMESTAMP'
  | 'FUTURE_TIMESTAMP'
  | 'EXPIRED_ATTESTATION'
  | 'UNKNOWN_TEE_TYPE'
  | 'INVALID_CODE_HASH'
  | 'UNKNOWN_CODE_HASH'
  | 'INVALID_SIGNATURE'
  | 'SIGNATURE_MISMATCH'
  | 'REMOTE_VERIFICATION_FAILED'
  | 'REMOTE_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR';

/** Warning codes for non-fatal issues */
export type VerificationWarningCode =
  | 'ATTESTATION_APPROACHING_EXPIRY'
  | 'UNKNOWN_TEE_TYPE'
  | 'UNKNOWN_CODE_HASH'
  | 'NO_QUOTE_DATA'
  | 'NO_SIGNATURE'
  | 'UNVERIFIED_SIGNATURE'
  | 'REMOTE_VERIFICATION_SKIPPED';

/** Verification error with details */
export interface VerificationError {
  /** Error code */
  code: VerificationErrorCode;
  /** Human-readable message */
  message: string;
  /** Technical details */
  details?: string;
  /** Step where error occurred */
  step: VerificationStepId;
}

/** Verification warning with details */
export interface VerificationWarning {
  /** Warning code */
  code: VerificationWarningCode;
  /** Human-readable message */
  message: string;
  /** Technical details */
  details?: string;
  /** Step where warning was raised */
  step: VerificationStepId;
}

/** Individual verification step result */
export interface VerificationStep {
  /** Step identifier */
  id: VerificationStepId;
  /** Human-readable step name */
  name: string;
  /** Step description */
  description: string;
  /** Current status */
  status: VerificationStepStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Result message */
  message?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Overall verification status */
export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'expired'
  | 'invalid'
  | 'error'
  | 'pending';

/** Complete verification result */
export interface VerificationResult {
  /** Whether attestation is valid */
  isValid: boolean;
  /** Overall status */
  status: VerificationStatus;
  /** Human-readable summary message */
  message: string;
  /** When verification was performed */
  verifiedAt: string;
  /** Total verification duration in ms */
  totalDurationMs: number;
  /** Individual step results */
  steps: VerificationStep[];
  /** Errors (if any) */
  errors: VerificationError[];
  /** Warnings (if any) */
  warnings: VerificationWarning[];
  /** TEE information (if resolved) */
  teeInfo?: TEEInfo;
  /** Whether result came from cache */
  fromCache?: boolean;
  /** Cache key used */
  cacheKey?: string;
}

// ============================================================================
// Options Types
// ============================================================================

/** Options for verification behavior */
export interface VerificationOptions {
  /** Skip cache and perform fresh verification */
  bypassCache?: boolean;
  /** Include remote verification step */
  includeRemoteVerification?: boolean;
  /** Timeout for remote verification in ms */
  remoteTimeout?: number;
  /** Custom known code hashes */
  knownCodeHashes?: Record<string, { version: string; description: string; releaseDate: string }>;
  /** Callback for step updates (useful for UI) */
  onStepUpdate?: (step: VerificationStep) => void;
  /** Maximum attestation age in ms (default: 5 minutes) */
  maxAttestationAge?: number;
  /** Allow lenient mode (warnings instead of errors for some checks) */
  lenient?: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

/** Cache entry for verification results */
export interface CacheEntry {
  /** Cached verification result */
  result: VerificationResult;
  /** When entry was created */
  createdAt: number;
  /** When entry expires */
  expiresAt: number;
  /** Number of cache hits */
  hitCount: number;
}

/** Cache statistics */
export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Maximum entries allowed */
  maxSize: number;
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Hit rate percentage */
  hitRate: number;
}

// ============================================================================
// Adapter Types (Backward Compatibility)
// ============================================================================

/**
 * Adapt NEARAIAttestation to TEEAttestation
 * Provides backward compatibility with existing attestation format
 */
export function adaptNEARAIAttestation(attestation: NEARAIAttestation): TEEAttestation {
  return {
    version: attestation.version,
    tee_type: attestation.tee_type,
    enclave_id: attestation.enclave_id,
    code_hash: attestation.code_hash,
    timestamp: attestation.timestamp,
    quote: attestation.quote,
    claims: attestation.claims,
    signature: attestation.signature,
  };
}

/**
 * Type guard to check if value is NEARAIAttestation
 */
export function isNEARAIAttestation(value: unknown): value is NEARAIAttestation {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.tee_type === 'string' &&
    typeof obj.enclave_id === 'string' &&
    typeof obj.code_hash === 'string' &&
    typeof obj.timestamp === 'string'
  );
}

/**
 * Type guard to check if value is TEEAttestation
 */
export function isTEEAttestation(value: unknown): value is TEEAttestation {
  return isNEARAIAttestation(value);
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { NEARAIAttestation, AttestationVerificationResult } from './ai';
