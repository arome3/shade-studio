'use client';

/**
 * Composition hook for cross-chain grant submission via NEAR Chain Signatures.
 *
 * Composes:
 * - useWallet() for auth state and wallet selector access
 * - useChainSignaturesStore for UI state
 * - lib/chain-signatures/* for MPC + EVM operations
 * - getWalletSelector() for signing
 *
 * Follows the use-project-account.ts pattern.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet } from './use-wallet';
import {
  useChainSignaturesStore,
  useChainSubmissions,
  useDerivedAddress,
  useChainSignatureStatus,
  useSelectedChain,
  useCurrentStep,
  useChainSignatureError,
  type ChainSignatureStatus,
} from '@/stores/chain-signatures-store';
import { deriveEVMAddress } from '@/lib/chain-signatures/mpc-client';
import { getChainConfig } from '@/lib/chain-signatures/chains';
import { submitCrossChain } from '@/lib/chain-signatures/cross-chain-submit';
import { getWalletSelector } from '@/lib/near/wallet';
import { WalletNotConnectedError, WalletNotInitializedError } from '@/lib/near/errors';
import type {
  EVMChainId,
  SubmissionStep,
  CrossChainSubmission,
  CrossChainSubmitParams,
  DerivedAddress,
} from '@/types/chain-signatures';

// ============================================================================
// Return Type
// ============================================================================

export interface UseChainSignatureReturn {
  // State
  status: ChainSignatureStatus;
  currentStep: SubmissionStep | null;
  selectedChain: EVMChainId;
  submissions: CrossChainSubmission[];
  derivedAddress: DerivedAddress | undefined;
  error: Error | null;
  isSubmitting: boolean;

  // Actions
  deriveAddress: (chain?: EVMChainId) => Promise<string>;
  submitCrossChain: (params: CrossChainSubmitParams) => Promise<CrossChainSubmission>;
  selectChain: (chain: EVMChainId) => void;
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for cross-chain grant submission.
 *
 * Provides address derivation, cross-chain submission, and chain selection.
 * Guards all write operations behind wallet connection check.
 */
export function useChainSignature(): UseChainSignatureReturn {
  const { isConnected, accountId } = useWallet();
  const abortRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Store selectors
  const status = useChainSignatureStatus();
  const currentStep = useCurrentStep();
  const selectedChain = useSelectedChain();
  const submissionsRecord = useChainSubmissions();
  const derivedAddress = useDerivedAddress(accountId ?? '', selectedChain);
  const error = useChainSignatureError();

  // Derive sorted submissions array from the Record (Zustand v5 pattern)
  const submissions = useMemo(
    () =>
      Object.values(submissionsRecord).sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      ),
    [submissionsRecord]
  );

  // Store actions
  const setStatus = useChainSignaturesStore((s) => s.setStatus);
  const setCurrentStep = useChainSignaturesStore((s) => s.setCurrentStep);
  const setError = useChainSignaturesStore((s) => s.setError);
  const clearErrorAction = useChainSignaturesStore((s) => s.clearError);
  const addSubmission = useChainSignaturesStore((s) => s.addSubmission);
  const updateSubmission = useChainSignaturesStore((s) => s.updateSubmission);
  const setDerivedAddress = useChainSignaturesStore((s) => s.setDerivedAddress);
  const setSelectedChain = useChainSignaturesStore((s) => s.setSelectedChain);

  /**
   * Derive an EVM address for the connected NEAR account.
   */
  const deriveAddress = useCallback(
    async (chain?: EVMChainId): Promise<string> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      const targetChain = chain ?? selectedChain;
      const chainCfg = getChainConfig(targetChain);
      const cacheKey = `${accountId}:${chainCfg.mpcPath}`;

      // Check cache first
      const cached = useChainSignaturesStore.getState().derivedAddresses[cacheKey];
      if (cached) {
        return cached.evmAddress;
      }

      try {
        setStatus('deriving');

        const evmAddress = await deriveEVMAddress(accountId, targetChain);

        const derived: DerivedAddress = {
          nearAccountId: accountId,
          chain: targetChain,
          evmAddress,
          derivedAt: new Date().toISOString(),
        };

        setDerivedAddress(cacheKey, derived);
        setStatus('idle');

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useChainSignature] Derived address:',
            evmAddress,
            'for',
            accountId,
            'on',
            targetChain
          );
        }

        return evmAddress;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to derive EVM address');
        setError(error);
        throw error;
      }
    },
    [isConnected, accountId, selectedChain, setStatus, setError, setDerivedAddress]
  );

  /**
   * Submit a transaction to an EVM chain via NEAR Chain Signatures.
   */
  const submitCrossChainAction = useCallback(
    async (params: CrossChainSubmitParams): Promise<CrossChainSubmission> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      // Abort any in-flight submission
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setStatus('submitting');

        const onProgress = (step: SubmissionStep) => {
          if (controller.signal.aborted) return;
          setCurrentStep(step);
        };

        const submission = await submitCrossChain(
          params,
          accountId,
          selector,
          onProgress
        );

        if (controller.signal.aborted) {
          return submission;
        }

        addSubmission(submission);

        if (submission.currentStep === 'failed') {
          setError(new Error(submission.error ?? 'Submission failed'));
        } else {
          setStatus('idle');
          setCurrentStep(null);
        }

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useChainSignature] Submission result:',
            submission.currentStep,
            submission.txHash ?? submission.error
          );
        }

        return submission;
      } catch (err) {
        if (controller.signal.aborted) {
          throw err;
        }
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to submit cross-chain transaction');
        setError(error);
        throw error;
      }
    },
    [
      isConnected,
      accountId,
      setStatus,
      setCurrentStep,
      setError,
      addSubmission,
      updateSubmission,
    ]
  );

  /**
   * Select a target EVM chain.
   */
  const selectChain = useCallback(
    (chain: EVMChainId) => {
      setSelectedChain(chain);
    },
    [setSelectedChain]
  );

  return {
    // State
    status,
    currentStep,
    selectedChain,
    submissions,
    derivedAddress,
    error,
    isSubmitting: status === 'submitting',

    // Actions
    deriveAddress,
    submitCrossChain: submitCrossChainAction,
    selectChain,
    clearError: clearErrorAction,
  };
}
