'use client';

/**
 * Submission step progress indicator for cross-chain grant submissions.
 *
 * Shows a vertical list of pipeline steps with visual state:
 * - Completed: check icon + success color
 * - Active: spinner + near-green
 * - Pending: dimmed
 * - Failed: X icon + error color + message
 */

import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getChainExplorerTxUrl } from '@/lib/chain-signatures/chains';
import {
  SUBMISSION_STEP_LABELS,
  SUBMISSION_STEP_ORDER,
} from '@/types/chain-signatures';
import type { SubmissionStep, EVMChainId } from '@/types/chain-signatures';

// ============================================================================
// Types
// ============================================================================

export interface SubmissionStatusProps {
  /** Current step in the submission pipeline */
  currentStep: SubmissionStep;
  /** The step that was active when failure occurred */
  failedAtStep?: SubmissionStep;
  /** Target EVM chain (for explorer link) */
  chain: EVMChainId;
  /** Transaction hash (available after broadcast) */
  txHash?: string;
  /** Error message (when step is 'failed') */
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getStepState(
  step: SubmissionStep,
  currentStep: SubmissionStep,
  failedAtStep?: SubmissionStep
): 'completed' | 'active' | 'pending' | 'failed' {
  if (currentStep === 'failed' && failedAtStep) {
    const stepIdx = SUBMISSION_STEP_ORDER.indexOf(step);
    const failedIdx = SUBMISSION_STEP_ORDER.indexOf(failedAtStep);
    if (stepIdx < failedIdx) return 'completed';
    if (stepIdx === failedIdx) return 'failed';
    return 'pending';
  }

  if (currentStep === 'failed') {
    // Fallback when failedAtStep is not set — mark all as pending
    return 'pending';
  }

  if (currentStep === 'complete') {
    return 'completed';
  }

  const stepIndex = SUBMISSION_STEP_ORDER.indexOf(step);
  const currentIndex = SUBMISSION_STEP_ORDER.indexOf(currentStep);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

// ============================================================================
// Component
// ============================================================================

export function SubmissionStatus({
  currentStep,
  failedAtStep,
  chain,
  txHash,
  error,
}: SubmissionStatusProps) {
  return (
    <div className="space-y-1" role="list" aria-label="Submission progress">
      {SUBMISSION_STEP_ORDER.map((step) => {
        const state = getStepState(step, currentStep, failedAtStep);
        const label = SUBMISSION_STEP_LABELS[step];

        return (
          <div
            key={step}
            role="listitem"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              state === 'completed' && 'text-success',
              state === 'active' && 'text-near-green-500 bg-surface/50',
              state === 'pending' && 'text-text-muted',
              state === 'failed' && 'text-error'
            )}
          >
            {/* Step icon */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {state === 'completed' && (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              {state === 'active' && (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {state === 'pending' && (
                <div className="h-2 w-2 rounded-full bg-current opacity-30" />
              )}
              {state === 'failed' && (
                <X className="h-4 w-4" aria-hidden="true" />
              )}
            </div>

            {/* Step label */}
            <span>{label}</span>

            {/* Explorer link for completed broadcast step */}
            {step === 'complete' && state === 'completed' && txHash && (
              <a
                href={getChainExplorerTxUrl(chain, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-near-green-500 hover:underline"
              >
                View tx
              </a>
            )}
          </div>
        );
      })}

      {/* Error message */}
      {currentStep === 'failed' && error && (
        <div className="mt-2 rounded-md border border-error/30 bg-error/10 px-3 py-2">
          <p className="text-xs text-error">{error}</p>
        </div>
      )}
    </div>
  );
}
