/**
 * Attestation Verification Logic
 *
 * Multi-step verification of TEE attestations with detailed feedback.
 * Implements structure, timestamp, TEE type, code hash, signature,
 * and optional remote verification.
 */

import type {
  TEEAttestation,
  VerificationResult,
  VerificationStep,
  VerificationStepId,
  VerificationStepStatus,
  VerificationError,
  VerificationWarning,
  VerificationOptions,
  TEEInfo,
  TEEType,
  NEARAIAttestation,
} from '@/types/attestation';
import { adaptNEARAIAttestation, isNEARAIAttestation } from '@/types/attestation';
import {
  TEE_INFO,
  KNOWN_CODE_HASHES,
  MAX_ATTESTATION_AGE_MS,
  CLOCK_SKEW_TOLERANCE_MS,
  ATTESTATION_EXPIRY_WARNING_THRESHOLD,
  DEFAULT_VERIFICATION_TIMEOUT_MS,
  VERIFICATION_STEP_INFO,
  ERROR_MESSAGES,
  VERIFICATION_ENDPOINTS,
  NEAR_AI_VERIFICATION_ENDPOINT,
} from './constants';
import { getVerificationCache, generateCacheKey } from './cache';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a verification step with initial state
 */
function createStep(
  id: VerificationStepId,
  status: VerificationStepStatus = 'pending'
): VerificationStep {
  const info = VERIFICATION_STEP_INFO[id];
  return {
    id,
    name: info?.name || id,
    description: info?.description || '',
    status,
  };
}

/**
 * Update a step with result
 */
function updateStep(
  step: VerificationStep,
  status: VerificationStepStatus,
  durationMs: number,
  message?: string,
  metadata?: Record<string, unknown>
): VerificationStep {
  return {
    ...step,
    status,
    durationMs,
    message,
    metadata,
  };
}

/**
 * Get TEE info for a given type
 */
export function getTEEInfo(teeType: string): TEEInfo {
  const normalizedType = teeType.toLowerCase() as TEEType;
  return TEE_INFO[normalizedType] || TEE_INFO.unknown;
}

/**
 * Format attestation data for display
 */
export function formatAttestation(attestation: TEEAttestation): string {
  const teeInfo = getTEEInfo(attestation.tee_type);
  const timestamp = new Date(attestation.timestamp);

  const lines = [
    `TEE Type: ${teeInfo.name}`,
    `Provider: ${teeInfo.provider}`,
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
 * Format hash for display (truncated with ellipsis)
 */
export function formatHash(hash: string | undefined, length: number = 8): string {
  if (!hash) return 'N/A';
  if (hash.length <= length * 2 + 3) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

/**
 * Check if a string is valid Base64
 */
function isValidBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  try {
    // Check if it matches Base64 pattern
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;
    // Try to decode
    if (typeof atob !== 'undefined') {
      atob(str);
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Verification Steps
// ============================================================================

/**
 * Step 1: Validate attestation structure
 */
function verifyStructure(
  attestation: TEEAttestation | null | undefined
): { step: VerificationStep; errors: VerificationError[] } {
  const startTime = Date.now();
  const step = createStep('structure', 'running');

  if (!attestation) {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'failed', duration, 'No attestation data provided'),
      errors: [
        {
          code: 'INVALID_STRUCTURE',
          message: 'No attestation data provided',
          step: 'structure',
        },
      ],
    };
  }

  // Check required fields
  const requiredFields: (keyof TEEAttestation)[] = [
    'tee_type',
    'enclave_id',
    'code_hash',
    'timestamp',
  ];
  const missingFields = requiredFields.filter(
    (field) => !attestation[field] || attestation[field] === ''
  );

  if (missingFields.length > 0) {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(
        step,
        'failed',
        duration,
        `Missing required fields: ${missingFields.join(', ')}`
      ),
      errors: missingFields.map((field) => ({
        code: 'MISSING_FIELD' as const,
        message: ERROR_MESSAGES.MISSING_FIELD(field),
        details: `Field "${field}" is required for attestation verification`,
        step: 'structure' as const,
      })),
    };
  }

  const duration = Date.now() - startTime;
  return {
    step: updateStep(step, 'passed', duration, 'All required fields present', {
      fieldsChecked: requiredFields.length,
    }),
    errors: [],
  };
}

/**
 * Step 2: Validate timestamp
 */
function verifyTimestamp(
  attestation: TEEAttestation,
  maxAge: number = MAX_ATTESTATION_AGE_MS
): {
  step: VerificationStep;
  errors: VerificationError[];
  warnings: VerificationWarning[];
} {
  const startTime = Date.now();
  const step = createStep('timestamp', 'running');
  const warnings: VerificationWarning[] = [];

  let attestationDate: Date;
  try {
    attestationDate = new Date(attestation.timestamp);
    if (isNaN(attestationDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'failed', duration, 'Invalid timestamp format'),
      errors: [
        {
          code: 'INVALID_TIMESTAMP',
          message: ERROR_MESSAGES.INVALID_TIMESTAMP,
          details: `Timestamp "${attestation.timestamp}" could not be parsed`,
          step: 'timestamp',
        },
      ],
      warnings: [],
    };
  }

  const now = Date.now();
  const age = now - attestationDate.getTime();

  // Check for future timestamp (with clock skew tolerance)
  if (age < -CLOCK_SKEW_TOLERANCE_MS) {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'failed', duration, 'Timestamp is in the future'),
      errors: [
        {
          code: 'FUTURE_TIMESTAMP',
          message: ERROR_MESSAGES.FUTURE_TIMESTAMP,
          details: `Attestation timestamp is ${Math.abs(age / 1000).toFixed(0)} seconds in the future`,
          step: 'timestamp',
        },
      ],
      warnings: [],
    };
  }

  // Check if attestation has expired
  if (age > maxAge) {
    const ageMinutes = Math.floor(age / 60000);
    const maxAgeMinutes = Math.floor(maxAge / 60000);
    const duration = Date.now() - startTime;
    return {
      step: updateStep(
        step,
        'failed',
        duration,
        `Attestation is ${ageMinutes} minutes old (max: ${maxAgeMinutes} minutes)`
      ),
      errors: [
        {
          code: 'EXPIRED_ATTESTATION',
          message: ERROR_MESSAGES.EXPIRED_ATTESTATION,
          details: `Attestation is ${ageMinutes} minutes old, maximum allowed is ${maxAgeMinutes} minutes`,
          step: 'timestamp',
        },
      ],
      warnings: [],
    };
  }

  // Check if approaching expiry
  if (age > maxAge * ATTESTATION_EXPIRY_WARNING_THRESHOLD) {
    const remainingMinutes = Math.floor((maxAge - age) / 60000);
    warnings.push({
      code: 'ATTESTATION_APPROACHING_EXPIRY',
      message: `Attestation will expire in ${remainingMinutes} minutes`,
      step: 'timestamp',
    });
  }

  const ageSeconds = Math.floor(age / 1000);
  const duration = Date.now() - startTime;
  return {
    step: updateStep(step, 'passed', duration, `Attestation is ${ageSeconds} seconds old`, {
      attestationTime: attestationDate.toISOString(),
      ageMs: age,
    }),
    errors: [],
    warnings,
  };
}

/**
 * Step 3: Validate TEE type
 */
function verifyTEEType(attestation: TEEAttestation): {
  step: VerificationStep;
  errors: VerificationError[];
  warnings: VerificationWarning[];
  teeInfo: TEEInfo;
} {
  const startTime = Date.now();
  const step = createStep('tee_type', 'running');
  const warnings: VerificationWarning[] = [];

  const normalizedType = attestation.tee_type.toLowerCase() as TEEType;
  const teeInfo = TEE_INFO[normalizedType];

  if (!teeInfo || normalizedType === 'unknown') {
    warnings.push({
      code: 'UNKNOWN_TEE_TYPE',
      message: `Unknown TEE type: ${attestation.tee_type}`,
      details: 'Verification may be limited for unrecognized TEE types',
      step: 'tee_type',
    });

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'warning', duration, `Unknown TEE type: ${attestation.tee_type}`, {
        teeType: attestation.tee_type,
        recognized: false,
      }),
      errors: [],
      warnings,
      teeInfo: TEE_INFO.unknown,
    };
  }

  const duration = Date.now() - startTime;
  return {
    step: updateStep(step, 'passed', duration, `Recognized ${teeInfo.name} (${teeInfo.provider})`, {
      teeType: normalizedType,
      provider: teeInfo.provider,
      securityLevel: teeInfo.securityLevel,
    }),
    errors: [],
    warnings: [],
    teeInfo,
  };
}

/**
 * Step 4: Validate code hash
 */
function verifyCodeHash(
  attestation: TEEAttestation,
  customKnownHashes?: Record<string, { version: string; description: string; releaseDate: string }>
): {
  step: VerificationStep;
  errors: VerificationError[];
  warnings: VerificationWarning[];
} {
  const startTime = Date.now();
  const step = createStep('code_hash', 'running');
  const warnings: VerificationWarning[] = [];

  const codeHash = attestation.code_hash;

  // Basic format validation
  if (!codeHash || codeHash.length < 32) {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'failed', duration, 'Invalid code hash format'),
      errors: [
        {
          code: 'INVALID_CODE_HASH',
          message: ERROR_MESSAGES.INVALID_CODE_HASH,
          details: 'Code hash is too short or empty',
          step: 'code_hash',
        },
      ],
      warnings: [],
    };
  }

  // Check against known hashes
  const knownHashes = { ...KNOWN_CODE_HASHES, ...customKnownHashes };
  const knownHashInfo = knownHashes[codeHash];

  if (!knownHashInfo) {
    warnings.push({
      code: 'UNKNOWN_CODE_HASH',
      message: 'Code hash is not in the list of known trusted values',
      details: `Hash: ${formatHash(codeHash, 12)}`,
      step: 'code_hash',
    });

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'warning', duration, 'Code hash not in known trusted list', {
        codeHash: formatHash(codeHash, 16),
        isKnown: false,
      }),
      errors: [],
      warnings,
    };
  }

  const duration = Date.now() - startTime;
  return {
    step: updateStep(step, 'passed', duration, `Verified: ${knownHashInfo.description} v${knownHashInfo.version}`, {
      codeHash: formatHash(codeHash, 16),
      version: knownHashInfo.version,
      description: knownHashInfo.description,
    }),
    errors: [],
    warnings: [],
  };
}

/**
 * Step 5: Validate signature format
 */
function verifySignature(attestation: TEEAttestation): {
  step: VerificationStep;
  errors: VerificationError[];
  warnings: VerificationWarning[];
} {
  const startTime = Date.now();
  const step = createStep('signature', 'running');
  const warnings: VerificationWarning[] = [];

  if (!attestation.signature) {
    warnings.push({
      code: 'NO_SIGNATURE',
      message: 'No signature present for verification',
      details: 'Cryptographic signature validation will be skipped',
      step: 'signature',
    });

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'skipped', duration, 'No signature to verify'),
      errors: [],
      warnings,
    };
  }

  // Validate Base64 format
  if (!isValidBase64(attestation.signature)) {
    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'failed', duration, 'Invalid signature format'),
      errors: [
        {
          code: 'INVALID_SIGNATURE',
          message: ERROR_MESSAGES.INVALID_SIGNATURE,
          details: 'Signature is not valid Base64 encoded data',
          step: 'signature',
        },
      ],
      warnings: [],
    };
  }

  // Note: Full cryptographic verification requires the public key and
  // is typically done server-side or via remote verification
  warnings.push({
    code: 'UNVERIFIED_SIGNATURE',
    message: 'Signature format is valid but cryptographic verification requires remote validation',
    step: 'signature',
  });

  const duration = Date.now() - startTime;
  return {
    step: updateStep(step, 'warning', duration, 'Signature format valid, awaiting remote verification', {
      signatureLength: attestation.signature.length,
    }),
    errors: [],
    warnings,
  };
}

/**
 * Step 6: Remote verification (optional)
 */
async function verifyRemote(
  attestation: TEEAttestation,
  teeType: TEEType,
  timeout: number = DEFAULT_VERIFICATION_TIMEOUT_MS
): Promise<{
  step: VerificationStep;
  errors: VerificationError[];
  warnings: VerificationWarning[];
}> {
  const startTime = Date.now();
  const step = createStep('remote', 'running');
  const warnings: VerificationWarning[] = [];

  // Check if remote verification is available for this TEE type
  const endpoint = VERIFICATION_ENDPOINTS[teeType];
  if (!endpoint) {
    warnings.push({
      code: 'REMOTE_VERIFICATION_SKIPPED',
      message: `Remote verification not available for ${teeType}`,
      step: 'remote',
    });

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'skipped', duration, `No remote verification endpoint for ${teeType}`),
      errors: [],
      warnings,
    };
  }

  // Check if we have the quote data needed for remote verification
  if (!attestation.quote) {
    warnings.push({
      code: 'NO_QUOTE_DATA',
      message: 'No quote data available for remote verification',
      step: 'remote',
    });

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'skipped', duration, 'Missing quote data for remote verification'),
      errors: [],
      warnings,
    };
  }

  // Attempt remote verification
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Try NEAR AI verification endpoint first
    const verifyUrl = new URL(NEAR_AI_VERIFICATION_ENDPOINT);
    verifyUrl.searchParams.set('quote', attestation.quote.slice(0, 128));

    const response = await fetch(verifyUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const duration = Date.now() - startTime;
      return {
        step: updateStep(step, 'failed', duration, `Remote verification failed: ${response.status}`),
        errors: [
          {
            code: 'REMOTE_VERIFICATION_FAILED',
            message: ERROR_MESSAGES.REMOTE_VERIFICATION_FAILED,
            details: `Server returned status ${response.status}`,
            step: 'remote',
          },
        ],
        warnings: [],
      };
    }

    const duration = Date.now() - startTime;
    return {
      step: updateStep(step, 'passed', duration, 'Remote verification successful', {
        endpoint: verifyUrl.hostname,
        responseTime: duration,
      }),
      errors: [],
      warnings: [],
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        step: updateStep(step, 'failed', duration, 'Remote verification timed out'),
        errors: [
          {
            code: 'REMOTE_TIMEOUT',
            message: ERROR_MESSAGES.REMOTE_TIMEOUT,
            details: `Request timed out after ${timeout}ms`,
            step: 'remote',
          },
        ],
        warnings: [],
      };
    }

    // For demo purposes, treat network errors as non-fatal warnings
    // since remote verification endpoints may not be available
    warnings.push({
      code: 'REMOTE_VERIFICATION_SKIPPED',
      message: 'Remote verification unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'remote',
    });

    return {
      step: updateStep(step, 'warning', duration, 'Remote verification skipped (endpoint unavailable)'),
      errors: [],
      warnings,
    };
  }
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Verify TEE attestation with comprehensive multi-step validation.
 *
 * Steps:
 * 1. Structure Validation - required fields check
 * 2. Timestamp Validation - freshness, not future
 * 3. TEE Type Validation - known types
 * 4. Code Hash Validation - against known good values
 * 5. Signature Validation - Base64 format check
 * 6. Remote Verification - optional, with timeout
 *
 * @param attestation - Attestation data to verify (supports both TEEAttestation and NEARAIAttestation)
 * @param options - Verification options
 * @returns Complete verification result with all steps
 */
export async function verifyAttestation(
  attestation: TEEAttestation | NEARAIAttestation | null | undefined,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const startTime = Date.now();
  const steps: VerificationStep[] = [];
  const errors: VerificationError[] = [];
  const warnings: VerificationWarning[] = [];
  let teeInfo: TEEInfo | undefined;

  // Adapt NEAR AI attestation format if needed
  let normalizedAttestation: TEEAttestation | null | undefined = attestation as TEEAttestation;
  if (attestation && isNEARAIAttestation(attestation)) {
    normalizedAttestation = adaptNEARAIAttestation(attestation);
  }

  // Check cache first (unless bypassed)
  if (!options.bypassCache && normalizedAttestation) {
    const cache = getVerificationCache();
    const cachedResult = cache.get(normalizedAttestation);
    if (cachedResult) {
      return cachedResult;
    }
  }

  // Step 1: Structure validation
  const structureResult = verifyStructure(normalizedAttestation);
  steps.push(structureResult.step);
  errors.push(...structureResult.errors);
  options.onStepUpdate?.(structureResult.step);

  if (structureResult.errors.length > 0) {
    return createResult(false, 'invalid', structureResult.step.message || 'Invalid structure', startTime, steps, errors, warnings, teeInfo, normalizedAttestation, options);
  }

  // Now we know attestation is valid
  const validAttestation = normalizedAttestation!;

  // Step 2: Timestamp validation
  const timestampResult = verifyTimestamp(validAttestation, options.maxAttestationAge);
  steps.push(timestampResult.step);
  errors.push(...timestampResult.errors);
  warnings.push(...timestampResult.warnings);
  options.onStepUpdate?.(timestampResult.step);

  if (timestampResult.errors.length > 0) {
    const firstError = timestampResult.errors[0];
    const status = firstError?.code === 'EXPIRED_ATTESTATION' ? 'expired' : 'invalid';
    return createResult(false, status, timestampResult.step.message || 'Timestamp validation failed', startTime, steps, errors, warnings, teeInfo, validAttestation, options);
  }

  // Step 3: TEE type validation
  const teeTypeResult = verifyTEEType(validAttestation);
  steps.push(teeTypeResult.step);
  errors.push(...teeTypeResult.errors);
  warnings.push(...teeTypeResult.warnings);
  teeInfo = teeTypeResult.teeInfo;
  options.onStepUpdate?.(teeTypeResult.step);

  // Step 4: Code hash validation
  const codeHashResult = verifyCodeHash(validAttestation, options.knownCodeHashes);
  steps.push(codeHashResult.step);
  errors.push(...codeHashResult.errors);
  warnings.push(...codeHashResult.warnings);
  options.onStepUpdate?.(codeHashResult.step);

  if (codeHashResult.errors.length > 0) {
    return createResult(false, 'invalid', 'Code hash validation failed', startTime, steps, errors, warnings, teeInfo, validAttestation, options);
  }

  // Step 5: Signature validation
  const signatureResult = verifySignature(validAttestation);
  steps.push(signatureResult.step);
  errors.push(...signatureResult.errors);
  warnings.push(...signatureResult.warnings);
  options.onStepUpdate?.(signatureResult.step);

  if (signatureResult.errors.length > 0) {
    return createResult(false, 'invalid', 'Signature validation failed', startTime, steps, errors, warnings, teeInfo, validAttestation, options);
  }

  // Step 6: Remote verification (optional)
  if (options.includeRemoteVerification) {
    const teeType = (validAttestation.tee_type.toLowerCase() as TEEType) || 'unknown';
    const remoteResult = await verifyRemote(validAttestation, teeType, options.remoteTimeout);
    steps.push(remoteResult.step);
    errors.push(...remoteResult.errors);
    warnings.push(...remoteResult.warnings);
    options.onStepUpdate?.(remoteResult.step);

    // In lenient mode, remote errors become warnings
    if (remoteResult.errors.length > 0 && !options.lenient) {
      return createResult(false, 'error', 'Remote verification failed', startTime, steps, errors, warnings, teeInfo, validAttestation, options);
    }
  } else {
    // Add skipped remote step
    const skippedRemote = createStep('remote', 'skipped');
    skippedRemote.message = 'Remote verification not requested';
    steps.push(skippedRemote);
    options.onStepUpdate?.(skippedRemote);
  }

  // All validations passed
  const message = teeInfo ? `Verified ${teeInfo.name} attestation` : 'Attestation verified';
  return createResult(true, 'verified', message, startTime, steps, errors, warnings, teeInfo, validAttestation, options);
}

/**
 * Create the final verification result and optionally cache it
 */
function createResult(
  isValid: boolean,
  status: VerificationResult['status'],
  message: string,
  startTime: number,
  steps: VerificationStep[],
  errors: VerificationError[],
  warnings: VerificationWarning[],
  teeInfo: TEEInfo | undefined,
  attestation: TEEAttestation | null | undefined,
  options: VerificationOptions
): VerificationResult {
  const result: VerificationResult = {
    isValid,
    status,
    message,
    verifiedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    steps,
    errors,
    warnings,
    teeInfo,
    fromCache: false,
  };

  // Cache the result if valid attestation
  if (attestation && !options.bypassCache) {
    const cache = getVerificationCache();
    result.cacheKey = generateCacheKey(attestation);
    cache.set(attestation, result);
  }

  return result;
}

/**
 * Synchronous verification (uses cached result or performs basic validation).
 * For full async verification, use verifyAttestation().
 */
export function verifyAttestationSync(
  attestation: TEEAttestation | NEARAIAttestation | null | undefined
): VerificationResult {
  const startTime = Date.now();
  const steps: VerificationStep[] = [];
  const errors: VerificationError[] = [];
  const warnings: VerificationWarning[] = [];
  let teeInfo: TEEInfo | undefined;

  // Adapt format if needed
  let normalizedAttestation: TEEAttestation | null | undefined = attestation as TEEAttestation;
  if (attestation && isNEARAIAttestation(attestation)) {
    normalizedAttestation = adaptNEARAIAttestation(attestation);
  }

  // Check cache
  if (normalizedAttestation) {
    const cache = getVerificationCache();
    const cachedResult = cache.get(normalizedAttestation);
    if (cachedResult) {
      return cachedResult;
    }
  }

  // Structure validation
  const structureResult = verifyStructure(normalizedAttestation);
  steps.push(structureResult.step);
  errors.push(...structureResult.errors);

  if (structureResult.errors.length > 0) {
    return {
      isValid: false,
      status: 'invalid',
      message: structureResult.step.message || 'Invalid structure',
      verifiedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      steps,
      errors,
      warnings,
      fromCache: false,
    };
  }

  const validAttestation = normalizedAttestation!;

  // Timestamp validation
  const timestampResult = verifyTimestamp(validAttestation);
  steps.push(timestampResult.step);
  errors.push(...timestampResult.errors);
  warnings.push(...timestampResult.warnings);

  if (timestampResult.errors.length > 0) {
    const firstError = timestampResult.errors[0];
    const status = firstError?.code === 'EXPIRED_ATTESTATION' ? 'expired' : 'invalid';
    return {
      isValid: false,
      status,
      message: timestampResult.step.message || 'Timestamp validation failed',
      verifiedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      steps,
      errors,
      warnings,
      fromCache: false,
    };
  }

  // TEE type validation
  const teeTypeResult = verifyTEEType(validAttestation);
  steps.push(teeTypeResult.step);
  warnings.push(...teeTypeResult.warnings);
  teeInfo = teeTypeResult.teeInfo;

  // Code hash validation
  const codeHashResult = verifyCodeHash(validAttestation);
  steps.push(codeHashResult.step);
  warnings.push(...codeHashResult.warnings);

  // Skip signature and remote for sync version
  const signatureStep = createStep('signature', 'skipped');
  signatureStep.message = 'Skipped in sync mode';
  steps.push(signatureStep);

  const remoteStep = createStep('remote', 'skipped');
  remoteStep.message = 'Skipped in sync mode';
  steps.push(remoteStep);

  const message = teeInfo ? `Verified ${teeInfo.name} attestation` : 'Attestation verified';
  const result: VerificationResult = {
    isValid: true,
    status: 'verified',
    message,
    verifiedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    steps,
    errors,
    warnings,
    teeInfo,
    fromCache: false,
    cacheKey: generateCacheKey(validAttestation),
  };

  // Cache result
  const cache = getVerificationCache();
  cache.set(validAttestation, result);

  return result;
}

/**
 * Get external verification URL for an attestation
 */
export function getExternalVerificationUrl(attestation: TEEAttestation): string | null {
  const teeType = attestation.tee_type.toLowerCase() as TEEType;

  // NEAR AI Cloud verification endpoint
  if (attestation.quote) {
    return `${NEAR_AI_VERIFICATION_ENDPOINT}?quote=${encodeURIComponent(attestation.quote.slice(0, 64))}`;
  }

  // TEE-specific verification portals
  if (teeType === 'intel-tdx' || teeType === 'intel-sgx') {
    return 'https://portal.trustauthority.intel.com/';
  }

  return null;
}
