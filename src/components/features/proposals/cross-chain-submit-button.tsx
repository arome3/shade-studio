'use client';

/**
 * Cross-chain submission button and dialog.
 *
 * Button triggers a Radix Dialog containing:
 * - Chain selector
 * - Derived EVM address display
 * - Submit button
 * - Live submission progress
 *
 * Uses the component guard cascade pattern:
 * !isConnected → loading → error → content
 */

import { useState, useCallback } from 'react';
import { Globe, Loader2, ExternalLink, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { config } from '@/lib/config';
import { useChainSignature } from '@/hooks/use-chain-signature';
import { getChainConfig, getChainExplorerTxUrl } from '@/lib/chain-signatures/chains';
import { ChainSelector } from './chain-selector';
import { SubmissionStatus } from './submission-status';
import type { CrossChainSubmitParams } from '@/types/chain-signatures';

// ============================================================================
// Types
// ============================================================================

export interface CrossChainSubmitButtonProps {
  /** Proposal ID for the submission */
  proposalId: string;
  /** Target contract address on the EVM chain */
  contractAddress: string;
  /** ABI-encoded calldata */
  calldata: string;
  /** Value to send in wei (default: "0") */
  value?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CrossChainSubmitButton({
  proposalId,
  contractAddress,
  calldata,
  value = '0',
  disabled = false,
}: CrossChainSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const [derivedAddr, setDerivedAddr] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [lastSubmissionId, setLastSubmissionId] = useState<string | null>(null);

  const {
    currentStep,
    selectedChain,
    submissions,
    error,
    isSubmitting,
    deriveAddress,
    submitCrossChain,
    selectChain,
    clearError,
  } = useChainSignature();

  // Find the last submission for this proposal
  const lastSubmission = lastSubmissionId
    ? submissions.find((s) => s.id === lastSubmissionId)
    : undefined;

  /**
   * Handle dialog open — derive address for the selected chain.
   */
  const handleOpen = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        clearError();
        setLastSubmissionId(null);
        setIsDeriving(true);
        try {
          const addr = await deriveAddress();
          setDerivedAddr(addr);
        } catch {
          // Error is captured in the store
        } finally {
          setIsDeriving(false);
        }
      }
    },
    [deriveAddress, clearError]
  );

  /**
   * Handle chain change — re-derive address.
   */
  const handleChainChange = useCallback(
    async (chain: typeof selectedChain) => {
      selectChain(chain);
      setDerivedAddr(null);
      setIsDeriving(true);
      try {
        const addr = await deriveAddress(chain);
        setDerivedAddr(addr);
      } catch {
        // Error is captured in the store
      } finally {
        setIsDeriving(false);
      }
    },
    [selectChain, deriveAddress]
  );

  /**
   * Handle submission.
   */
  const handleSubmit = useCallback(async () => {
    try {
      const params: CrossChainSubmitParams = {
        proposalId,
        chain: selectedChain,
        contractAddress,
        calldata,
        value,
      };

      const result = await submitCrossChain(params);
      setLastSubmissionId(result.id);
    } catch {
      // Error is already stored in Zustand by the hook
    }
  }, [proposalId, selectedChain, contractAddress, calldata, value, submitCrossChain]);

  /**
   * Handle retry after failure.
   */
  const handleRetry = useCallback(() => {
    clearError();
    setLastSubmissionId(null);
  }, [clearError]);

  const showProgress = isSubmitting || lastSubmission;
  const chainConfig = getChainConfig(selectedChain);

  // Feature flag gate — hide button when chain signatures are disabled
  if (!config.features.chainSignatures) return null;

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpen(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Globe className="h-4 w-4" />
        Cross-Chain Submit
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Cross-Chain Submission</DialogTitle>
            <DialogDescription>
              Submit this proposal to an EVM chain using NEAR Chain Signatures
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Chain selector */}
            <ChainSelector
              value={selectedChain}
              onValueChange={handleChainChange}
              disabled={isSubmitting}
            />

            {/* Derived address */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Your EVM Address
              </label>
              <div
                className={cn(
                  'rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono',
                  isDeriving && 'animate-pulse'
                )}
              >
                {isDeriving ? (
                  <span className="flex items-center gap-2 text-text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Deriving address...
                  </span>
                ) : derivedAddr ? (
                  <span className="text-text-primary break-all">
                    {derivedAddr}
                  </span>
                ) : (
                  <span className="text-text-muted">
                    {error ? 'Failed to derive address' : 'No address derived'}
                  </span>
                )}
              </div>
            </div>

            {/* Gas funding warning */}
            {derivedAddr && !isSubmitting && !lastSubmission && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                <p className="text-xs text-warning">
                  Ensure this address has enough {chainConfig.symbol} to cover gas fees
                  before submitting.
                </p>
              </div>
            )}

            {/* Submission progress */}
            {showProgress && currentStep && (
              <SubmissionStatus
                currentStep={lastSubmission?.currentStep ?? currentStep}
                failedAtStep={lastSubmission?.failedAtStep}
                chain={selectedChain}
                txHash={lastSubmission?.txHash}
                error={lastSubmission?.error ?? error?.message}
              />
            )}

            {/* Success: explorer link */}
            {lastSubmission?.currentStep === 'complete' && lastSubmission.txHash && (
              <a
                href={getChainExplorerTxUrl(selectedChain, lastSubmission.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg',
                  'border border-success/30 bg-success/10 px-3 py-2',
                  'text-sm text-success hover:bg-success/20 transition-colors'
                )}
              >
                <ExternalLink className="h-4 w-4" />
                View transaction on explorer
              </a>
            )}

            {/* Error display */}
            {error && !showProgress && (
              <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2">
                <p className="text-xs text-error">{error.message}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {lastSubmission?.currentStep === 'failed' ? (
              <Button
                variant="secondary"
                onClick={handleRetry}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !derivedAddr || isDeriving}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit to Chain'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
