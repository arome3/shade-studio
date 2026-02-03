/**
 * Attestation Verification Module
 *
 * Comprehensive TEE attestation verification for Private Grant Studio.
 * Provides multi-step verification, caching, and detailed feedback.
 *
 * @example
 * ```typescript
 * import { verifyAttestation, getTEEInfo, getVerificationCache } from '@/lib/attestation';
 *
 * // Verify an attestation
 * const result = await verifyAttestation(attestation, {
 *   includeRemoteVerification: true,
 *   onStepUpdate: (step) => console.log(`${step.name}: ${step.status}`),
 * });
 *
 * // Get TEE information
 * const teeInfo = getTEEInfo('intel-tdx');
 *
 * // Access cache
 * const cache = getVerificationCache();
 * console.log(cache.getStats());
 * ```
 */

// Constants
export {
  MAX_ATTESTATION_AGE_MS,
  VERIFICATION_CACHE_TTL_MS,
  DEFAULT_VERIFICATION_TIMEOUT_MS,
  CLOCK_SKEW_TOLERANCE_MS,
  ATTESTATION_EXPIRY_WARNING_THRESHOLD,
  MAX_CACHE_ENTRIES,
  TEE_INFO,
  KNOWN_CODE_HASHES,
  VERIFICATION_ENDPOINTS,
  NEAR_AI_VERIFICATION_ENDPOINT,
  VERIFICATION_STEP_INFO,
  ERROR_MESSAGES,
  SECURITY_LEVEL_DESCRIPTIONS,
  TEE_BENEFITS,
} from './constants';

// Cache
export {
  VerificationCache,
  getVerificationCache,
  resetVerificationCache,
  generateCacheKey,
} from './cache';

// Verification
export {
  verifyAttestation,
  verifyAttestationSync,
  getTEEInfo,
  formatAttestation,
  formatHash,
  getExternalVerificationUrl,
} from './verify';

// Re-export types for convenience
export type {
  TEEType,
  TEEInfo,
  TEEAttestation,
  SecurityLevel,
  VerificationResult,
  VerificationStep,
  VerificationStepId,
  VerificationStepStatus,
  VerificationError,
  VerificationWarning,
  VerificationErrorCode,
  VerificationWarningCode,
  VerificationOptions,
  CacheEntry,
  CacheStats,
} from '@/types/attestation';
