'use client';

/**
 * Multi-step dialog for creating a project sub-account.
 *
 * Steps: name → review → creating → complete
 *
 * Uses native useState for the 4-step wizard — one input field
 * doesn't warrant a form library.
 */

import { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getExplorerAccountUrl } from '@/lib/near/config';
import type { ProjectSubAccount, CreateSubAccountInput } from '@/types/project-accounts';

type Step = 'name' | 'review' | 'creating' | 'complete';

export interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  parentAccountId: string;
  onValidateName: (name: string) => { valid: boolean; error?: string; fullAccountId?: string };
  onCheckExists: (accountId: string) => Promise<boolean>;
  onCreate: (input: CreateSubAccountInput) => Promise<ProjectSubAccount>;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  projectId,
  parentAccountId,
  onValidateName,
  onCheckExists,
  onCreate,
}: CreateProjectDialogProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [validation, setValidation] = useState<{
    valid: boolean;
    error?: string;
    fullAccountId?: string;
  }>({ valid: false });
  const [existsError, setExistsError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<ProjectSubAccount | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const deposit = '0.1';

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('name');
      setName('');
      setValidation({ valid: false });
      setExistsError(null);
      setCreateError(null);
      setCreatedAccount(null);
      setShowCancel(false);
    }
  }, [open]);

  // Show cancel button after 15s in 'creating' step
  useEffect(() => {
    if (step !== 'creating') {
      setShowCancel(false);
      return;
    }
    const timer = setTimeout(() => setShowCancel(true), 15_000);
    return () => clearTimeout(timer);
  }, [step]);

  // Validate name on change
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      setExistsError(null);
      if (value.length > 0) {
        setValidation(onValidateName(value));
      } else {
        setValidation({ valid: false });
      }
    },
    [onValidateName]
  );

  // Check if account already exists before proceeding to review
  const handleProceedToReview = useCallback(async () => {
    if (!validation.valid || !validation.fullAccountId) return;

    setExistsError(null);
    try {
      const exists = await onCheckExists(validation.fullAccountId);
      if (exists) {
        setExistsError(`Account ${validation.fullAccountId} already exists`);
        return;
      }
      setStep('review');
    } catch {
      setExistsError('Failed to check account availability');
    }
  }, [validation, onCheckExists]);

  // Execute sub-account creation
  const handleCreate = useCallback(async () => {
    setStep('creating');
    setCreateError(null);

    try {
      const account = await onCreate({
        subAccountName: name,
        projectId,
        initialDeposit: deposit,
      });
      setCreatedAccount(account);
      setStep('complete');
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create sub-account'
      );
      setStep('review');
    }
  }, [name, projectId, deposit, onCreate]);

  const canClose = step !== 'creating' || showCancel;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (canClose) onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        {/* Step 1: Name */}
        {step === 'name' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Project Sub-Account</DialogTitle>
              <DialogDescription>
                Create a dedicated NEAR account for this project. Team members
                will receive scoped access keys.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Sub-account name
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="my-project"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value.toLowerCase())}
                    error={name.length > 0 && !validation.valid}
                    autoFocus
                  />
                  <span className="shrink-0 text-sm text-text-muted">
                    .{parentAccountId}
                  </span>
                </div>
                {name.length > 0 && !validation.valid && validation.error && (
                  <p className="text-xs text-error">{validation.error}</p>
                )}
                {existsError && (
                  <p className="text-xs text-error">{existsError}</p>
                )}
                {validation.valid && validation.fullAccountId && (
                  <p className="text-xs text-text-muted">
                    Full ID: <code className="text-near-green-500">{validation.fullAccountId}</code>
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={!validation.valid}
                onClick={handleProceedToReview}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle>Review Sub-Account</DialogTitle>
              <DialogDescription>
                Confirm the details before creating the on-chain account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border bg-surface-hover p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Account ID</span>
                  <code className="text-text-primary">{validation.fullAccountId}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Parent Account</span>
                  <span className="text-text-primary">{parentAccountId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Initial Deposit</span>
                  <span className="text-text-primary">{deposit} NEAR</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-text-muted">
                  This will deduct {deposit} NEAR from your account as the initial
                  balance for the sub-account. A new FullAccess key will be
                  generated for you as the owner.
                </p>
              </div>

              {createError && (
                <p className="text-sm text-error">{createError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('name')}>
                Back
              </Button>
              <Button onClick={handleCreate}>
                Create Account
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Creating */}
        {step === 'creating' && (
          <>
            <DialogHeader>
              <DialogTitle>Creating Sub-Account</DialogTitle>
              <DialogDescription>
                Please confirm the transaction in your wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-near-green-500" />
              <p className="mt-4 text-sm text-text-muted">
                Waiting for wallet confirmation...
              </p>
              {showCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setStep('review'); }}
                >
                  Cancel — taking too long?
                </Button>
              )}
            </div>
          </>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && createdAccount && (
          <>
            <DialogHeader>
              <DialogTitle>Sub-Account Created</DialogTitle>
              <DialogDescription>
                Your project sub-account is ready to use.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-6">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <code className="mt-3 text-sm font-medium text-text-primary">
                {createdAccount.accountId}
              </code>
              <a
                href={getExplorerAccountUrl(createdAccount.accountId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-xs text-near-green-500 hover:underline"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
