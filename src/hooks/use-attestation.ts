'use client';

import { useCallback, useState } from 'react';
import {
  verifyAttestation,
  formatAttestation,
  getTeeDescription,
  getVerificationBadge,
  createVerificationReport,
  getExternalVerificationUrl,
} from '@/lib/ai/attestation';
import type {
  NEARAIAttestation,
  AttestationVerificationResult,
} from '@/types/ai';

/**
 * Return type for the useAttestation hook.
 */
export interface UseAttestationReturn {
  // State
  verificationResult: AttestationVerificationResult | null;
  isVerifying: boolean;
  error: string | null;

  // Actions
  verify: (attestation: NEARAIAttestation | undefined | null) => AttestationVerificationResult;
  format: (attestation: NEARAIAttestation) => string;
  getDescription: (teeType: string) => { name: string; description: string; provider: string };
  getBadge: (result: AttestationVerificationResult) => {
    color: 'green' | 'yellow' | 'red' | 'gray';
    label: string;
    icon: 'check' | 'alert' | 'x' | 'question';
  };
  getReport: (attestation: NEARAIAttestation | undefined | null) => string;
  getVerificationUrl: (attestation: NEARAIAttestation) => string | null;
  clear: () => void;
}

/**
 * Hook for TEE attestation verification and formatting.
 *
 * Provides utilities for verifying, formatting, and displaying
 * TEE attestation information from NEAR AI Cloud responses.
 *
 * @example
 * function AttestationBadge({ attestation }) {
 *   const { verify, getBadge, format } = useAttestation();
 *
 *   const result = verify(attestation);
 *   const badge = getBadge(result);
 *
 *   return (
 *     <Badge color={badge.color}>
 *       <Icon name={badge.icon} />
 *       {badge.label}
 *     </Badge>
 *   );
 * }
 */
export function useAttestation(): UseAttestationReturn {
  const [verificationResult, setVerificationResult] =
    useState<AttestationVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verify an attestation and store the result.
   */
  const verify = useCallback(
    (attestation: NEARAIAttestation | undefined | null): AttestationVerificationResult => {
      setIsVerifying(true);
      setError(null);

      try {
        const result = verifyAttestation(attestation);
        setVerificationResult(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Verification failed';
        setError(errorMessage);

        const errorResult: AttestationVerificationResult = {
          isValid: false,
          status: 'error',
          message: 'Verification failed',
          error: errorMessage,
        };
        setVerificationResult(errorResult);
        return errorResult;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  /**
   * Format an attestation for display.
   */
  const format = useCallback((attestation: NEARAIAttestation): string => {
    return formatAttestation(attestation);
  }, []);

  /**
   * Get description for a TEE type.
   */
  const getDescription = useCallback(
    (teeType: string): { name: string; description: string; provider: string } => {
      return getTeeDescription(teeType);
    },
    []
  );

  /**
   * Get badge properties for a verification result.
   */
  const getBadge = useCallback(
    (
      result: AttestationVerificationResult
    ): {
      color: 'green' | 'yellow' | 'red' | 'gray';
      label: string;
      icon: 'check' | 'alert' | 'x' | 'question';
    } => {
      return getVerificationBadge(result);
    },
    []
  );

  /**
   * Get a full verification report.
   */
  const getReport = useCallback(
    (attestation: NEARAIAttestation | undefined | null): string => {
      return createVerificationReport(attestation);
    },
    []
  );

  /**
   * Get external verification URL.
   */
  const getVerificationUrl = useCallback(
    (attestation: NEARAIAttestation): string | null => {
      return getExternalVerificationUrl(attestation);
    },
    []
  );

  /**
   * Clear the verification result.
   */
  const clear = useCallback(() => {
    setVerificationResult(null);
    setIsVerifying(false);
    setError(null);
  }, []);

  return {
    // State
    verificationResult,
    isVerifying,
    error,

    // Actions
    verify,
    format,
    getDescription,
    getBadge,
    getReport,
    getVerificationUrl,
    clear,
  };
}
