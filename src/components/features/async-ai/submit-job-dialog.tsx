'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  AIJobParamsSchema,
  JOB_TYPE_LABELS,
  type AIJobType,
  type AIJobParams,
} from '@/types/async-ai';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SubmitJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: AIJobParams) => Promise<string | null>;
  isSubmitting?: boolean;
  /** Minimum deposit in yoctoNEAR (default 0.01 NEAR) */
  minDeposit?: string;
}

/** Format yoctoNEAR to human-readable NEAR amount */
function formatDeposit(yocto: string): string {
  try {
    return (Number(BigInt(yocto)) / 1e24).toFixed(2);
  } catch {
    return '0.01';
  }
}

export function SubmitJobDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  minDeposit = '10000000000000000000000',
}: SubmitJobDialogProps) {
  const [jobType, setJobType] = useState<AIJobType>('document-analysis');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Per-type form fields
  const [documentIds, setDocumentIds] = useState('');
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [proposalId, setProposalId] = useState('');
  const [grantProgram, setGrantProgram] = useState('');
  const [targetProject, setTargetProject] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [accountId, setAccountId] = useState('');

  const resetFields = useCallback(() => {
    setDocumentIds('');
    setDepth('standard');
    setProposalId('');
    setGrantProgram('');
    setTargetProject('');
    setCompetitors('');
    setProjectDescription('');
    setAccountId('');
    setValidationError(null);
  }, []);

  const buildParams = useCallback((): AIJobParams | null => {
    let params: AIJobParams;

    switch (jobType) {
      case 'document-analysis':
        params = {
          type: 'document-analysis',
          documentIds: documentIds.split(',').map((s) => s.trim()).filter(Boolean),
          depth,
        };
        break;
      case 'proposal-review':
        params = {
          type: 'proposal-review',
          proposalId: proposalId.trim(),
          grantProgram: grantProgram.trim(),
        };
        break;
      case 'competitive-research':
        params = {
          type: 'competitive-research',
          targetProject: targetProject.trim(),
          competitors: competitors.split(',').map((s) => s.trim()).filter(Boolean),
        };
        break;
      case 'grant-matching':
        params = {
          type: 'grant-matching',
          projectDescription: projectDescription.trim(),
        };
        break;
      case 'weekly-synthesis':
        params = {
          type: 'weekly-synthesis',
          accountId: accountId.trim(),
        };
        break;
      default:
        return null;
    }

    const result = AIJobParamsSchema.safeParse(params);
    if (!result.success) {
      const firstError = result.error.errors[0];
      setValidationError(firstError?.message ?? 'Invalid parameters');
      return null;
    }

    setValidationError(null);
    return result.data as AIJobParams;
  }, [
    jobType,
    documentIds,
    depth,
    proposalId,
    grantProgram,
    targetProject,
    competitors,
    projectDescription,
    accountId,
  ]);

  const handleSubmit = useCallback(async () => {
    const params = buildParams();
    if (!params) return;

    const jobId = await onSubmit(params);
    if (jobId) {
      resetFields();
      onOpenChange(false);
    }
  }, [buildParams, onSubmit, resetFields, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit AI Pipeline Job</DialogTitle>
          <DialogDescription>
            Submit a long-running analysis job. Requires {formatDeposit(minDeposit)} NEAR deposit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Job Type
            </label>
            <Select
              value={jobType}
              onValueChange={(v) => {
                setJobType(v as AIJobType);
                setValidationError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(JOB_TYPE_LABELS) as [AIJobType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific fields */}
          {jobType === 'document-analysis' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Document IDs (comma-separated)
                </label>
                <Input
                  value={documentIds}
                  onChange={(e) => setDocumentIds(e.target.value)}
                  placeholder="doc-1, doc-2, doc-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Analysis Depth
                </label>
                <Select value={depth} onValueChange={(v) => setDepth(v as typeof depth)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="deep">Deep</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {jobType === 'proposal-review' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Proposal ID
                </label>
                <Input
                  value={proposalId}
                  onChange={(e) => setProposalId(e.target.value)}
                  placeholder="prop-123"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Grant Program
                </label>
                <Input
                  value={grantProgram}
                  onChange={(e) => setGrantProgram(e.target.value)}
                  placeholder="near-grants"
                />
              </div>
            </>
          )}

          {jobType === 'competitive-research' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Target Project
                </label>
                <Input
                  value={targetProject}
                  onChange={(e) => setTargetProject(e.target.value)}
                  placeholder="Project name or domain"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Competitors (comma-separated)
                </label>
                <Input
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="competitor-1, competitor-2"
                />
              </div>
            </>
          )}

          {jobType === 'grant-matching' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Project Description
              </label>
              <Input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe your project..."
              />
            </div>
          )}

          {jobType === 'weekly-synthesis' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Account ID
              </label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="yourname.testnet"
              />
            </div>
          )}

          {/* Validation error */}
          {validationError && (
            <p className="text-xs text-error">{validationError}</p>
          )}

          {/* Deposit notice */}
          <p className="text-xs text-text-muted">
            Deposit: {formatDeposit(minDeposit)} NEAR (refundable on cancellation)
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
