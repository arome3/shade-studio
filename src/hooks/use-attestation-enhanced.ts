'use client';

import { useCallback, useState, useRef } from 'react';
import {
  verifyAttestation,
  verifyAttestationSync,
  formatAttestation,
  getTEEInfo,
  getVerificationCache,
} from '@/lib/attestation';
import type {
  TEEAttestation,
  VerificationResult,
  VerificationStep,
  VerificationOptions,
  TEEInfo,
  CacheStats,
  NEARAIAttestation,
} from '@/types/attestation';

/**
 * Return type for the enhanced attestation hook.
 */
export interface UseAttestationEnhancedReturn {
  /** Current verification result (null if not verified) */
  result: VerificationResult | null;
  /** Individual verification steps for progress display */
  steps: VerificationStep[];
  /** Whether verification is in progress */
  isVerifying: boolean;
  /** Error message if verification failed */
  error: string | null;

  /**
   * Verify an attestation asynchronously with all steps.
   * Use this for full verification including optional remote verification.
   */
  verify: (
    attestation: TEEAttestation | NEARAIAttestation | null | undefined,
    options?: VerificationOptions
  ) => Promise<VerificationResult>;

  /**
   * Verify an attestation synchronously (cached or basic validation).
   * Use this for quick validation when you don't need remote verification.
   */
  verifySync: (
    attestation: TEEAttestation | NEARAIAttestation | null | undefined
  ) => VerificationResult;

  /** Format attestation for human-readable display */
  format: (attestation: TEEAttestation) => string;

  /** Get TEE information for a given type */
  getInfo: (teeType: string) => TEEInfo;

  /** Clear the current verification result */
  clearResult: () => void;

  /** Clear the verification cache */
  clearCache: () => void;

  /** Get cache statistics */
  getCacheStats: () => CacheStats;
}

/**
 * Enhanced hook for TEE attestation verification.
 *
 * Provides comprehensive verification with:
 * - Async multi-step verification with progress tracking
 * - In-memory caching with TTL
 * - Step-by-step feedback via steps array
 * - Both sync and async verification options
 *
 * @example
 * ```tsx
 * function AttestationView({ attestation }) {
 *   const {
 *     result,
 *     steps,
 *     isVerifying,
 *     verify,
 *     getInfo,
 *   } = useAttestationEnhanced();
 *
 *   useEffect(() => {
 *     verify(attestation, { includeRemoteVerification: true });
 *   }, [attestation, verify]);
 *
 *   if (isVerifying) {
 *     return <VerificationProgress steps={steps} />;
 *   }
 *
 *   return <VerificationResult result={result} />;
 * }
 * ```
 */
export function useAttestationEnhanced(): UseAttestationEnhancedReturn {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [steps, setSteps] = useState<VerificationStep[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current verification to prevent race conditions
  const verificationIdRef = useRef(0);

  /**
   * Verify attestation asynchronously with full step tracking.
   */
  const verify = useCallback(
    async (
      attestation: TEEAttestation | NEARAIAttestation | null | undefined,
      options: VerificationOptions = {}
    ): Promise<VerificationResult> => {
      const verificationId = ++verificationIdRef.current;

      setIsVerifying(true);
      setError(null);
      setSteps([]);

      try {
        // Step update callback for real-time progress
        const onStepUpdate = (step: VerificationStep) => {
          // Only update if this is still the current verification
          if (verificationIdRef.current === verificationId) {
            setSteps((prev) => {
              const existing = prev.findIndex((s) => s.id === step.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = step;
                return updated;
              }
              return [...prev, step];
            });
          }
        };

        const verificationResult = await verifyAttestation(attestation, {
          ...options,
          onStepUpdate,
        });

        // Only update state if this is still the current verification
        if (verificationIdRef.current === verificationId) {
          setResult(verificationResult);
          setSteps(verificationResult.steps);
        }

        return verificationResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';

        // Only update state if this is still the current verification
        if (verificationIdRef.current === verificationId) {
          setError(errorMessage);

          const errorResult: VerificationResult = {
            isValid: false,
            status: 'error',
            message: 'Verification failed',
            verifiedAt: new Date().toISOString(),
            totalDurationMs: 0,
            steps: [],
            errors: [
              {
                code: 'INTERNAL_ERROR',
                message: errorMessage,
                step: 'structure',
              },
            ],
            warnings: [],
            fromCache: false,
          };
          setResult(errorResult);
          return errorResult;
        }

        // Return error result even if state wasn't updated
        return {
          isValid: false,
          status: 'error',
          message: 'Verification failed',
          verifiedAt: new Date().toISOString(),
          totalDurationMs: 0,
          steps: [],
          errors: [
            {
              code: 'INTERNAL_ERROR',
              message: errorMessage,
              step: 'structure',
            },
          ],
          warnings: [],
          fromCache: false,
        };
      } finally {
        // Only update loading state if this is still the current verification
        if (verificationIdRef.current === verificationId) {
          setIsVerifying(false);
        }
      }
    },
    []
  );

  /**
   * Verify attestation synchronously (uses cache or basic validation).
   */
  const verifySync = useCallback(
    (
      attestation: TEEAttestation | NEARAIAttestation | null | undefined
    ): VerificationResult => {
      try {
        const verificationResult = verifyAttestationSync(attestation);
        setResult(verificationResult);
        setSteps(verificationResult.steps);
        setError(null);
        return verificationResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';
        setError(errorMessage);

        const errorResult: VerificationResult = {
          isValid: false,
          status: 'error',
          message: 'Verification failed',
          verifiedAt: new Date().toISOString(),
          totalDurationMs: 0,
          steps: [],
          errors: [
            {
              code: 'INTERNAL_ERROR',
              message: errorMessage,
              step: 'structure',
            },
          ],
          warnings: [],
          fromCache: false,
        };
        setResult(errorResult);
        return errorResult;
      }
    },
    []
  );

  /**
   * Format attestation for display.
   */
  const format = useCallback((attestation: TEEAttestation): string => {
    return formatAttestation(attestation);
  }, []);

  /**
   * Get TEE information.
   */
  const getInfo = useCallback((teeType: string): TEEInfo => {
    return getTEEInfo(teeType);
  }, []);

  /**
   * Clear the current result.
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setSteps([]);
    setError(null);
    setIsVerifying(false);
  }, []);

  /**
   * Clear the verification cache.
   */
  const clearCache = useCallback(() => {
    const cache = getVerificationCache();
    cache.clear();
  }, []);

  /**
   * Get cache statistics.
   */
  const getCacheStats = useCallback((): CacheStats => {
    const cache = getVerificationCache();
    return cache.getStats();
  }, []);

  return {
    result,
    steps,
    isVerifying,
    error,
    verify,
    verifySync,
    format,
    getInfo,
    clearResult,
    clearCache,
    getCacheStats,
  };
}
