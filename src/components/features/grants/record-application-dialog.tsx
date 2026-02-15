'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  FileText,
  Inbox,
} from 'lucide-react';
import {
  RecordApplicationSchema,
  formatFunding,
  type RecordApplicationInput,
  type GrantProgram,
  type GrantProject,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApplicationStep = 'select-project' | 'details' | 'review' | 'submitting' | 'complete';

interface RecordApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RecordApplicationInput) => Promise<boolean>;
  program: GrantProgram;
  userProjects: GrantProject[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordApplicationDialog({
  open,
  onOpenChange,
  onSubmit,
  program,
  userProjects,
}: RecordApplicationDialogProps) {
  const [step, setStep] = useState<ApplicationStep>('select-project');
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');

  const selectedProject = useMemo(
    () => userProjects.find((p) => p.id === selectedProjectId),
    [userProjects, selectedProjectId]
  );

  const detailsValid = useMemo(
    () => title.length >= 3 && requestedAmount.length >= 1,
    [title, requestedAmount]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && step === 'submitting') return;
      if (!newOpen) {
        setStep('select-project');
        setSelectedProjectId('');
        setTitle('');
        setRequestedAmount('');
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, step]
  );

  const handleSubmit = useCallback(async () => {
    const input: RecordApplicationInput = {
      programId: program.id,
      projectId: selectedProjectId,
      title,
      requestedAmount,
    };

    const validation = RecordApplicationSchema.safeParse(input);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setStep('submitting');
    setError(null);

    const success = await onSubmit(input);
    if (success) {
      setStep('complete');
    } else {
      setError('Application submission failed. Please try again.');
      setStep('review');
    }
  }, [program.id, selectedProjectId, title, requestedAmount, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'complete' ? 'Application Submitted' : 'Apply for Grant'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-project' && `Select a project to apply to ${program.name}.`}
            {step === 'details' && 'Provide your application details.'}
            {step === 'review' && 'Review your application before submitting.'}
            {step === 'submitting' && 'Recording application on-chain...'}
            {step === 'complete' && 'Your application has been submitted successfully.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select Project */}
        {step === 'select-project' && (
          <div className="space-y-3">
            {userProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center">
                  <Inbox className="h-5 w-5 text-text-muted" />
                </div>
                <p className="text-sm text-text-muted text-center">
                  You need to register a project first before applying for grants.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-text-primary">
                    Select Project
                  </label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProject && (
                  <div className="rounded-md border border-border bg-surface p-3 space-y-1">
                    <p className="text-xs text-text-muted line-clamp-2">
                      {selectedProject.description}
                    </p>
                    <p className="text-xs text-text-muted">
                      {selectedProject.applicationCount} previous applications
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Application Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Privacy Dashboard for DAO Governance"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">
                Requested Amount
              </label>
              <Input
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="e.g. 25000"
                className="mt-1"
              />
              {program.minAmount && program.maxAmount && (
                <p className="text-xs text-text-muted mt-1">
                  Range: {formatFunding(program.minAmount)} — {formatFunding(program.maxAmount)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-3">
            {error && (
              <div className="p-3 rounded-md bg-error/10 border border-error/20 text-sm text-error">
                {error}
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Program</span>
                <span className="text-text-primary">{program.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Project</span>
                <span className="text-text-primary">{selectedProject?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Title</span>
                <span className="text-text-primary">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Amount</span>
                <span className="text-text-primary">{formatFunding(requestedAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">
              Recording application on-chain...
            </p>
            <p className="text-xs text-text-muted">
              Please approve the transaction in your wallet.
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-text-primary">
                Application submitted successfully!
              </p>
              <p className="text-xs text-text-muted">{title}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'select-project' && userProjects.length > 0 && (
            <Button
              onClick={() => setStep('details')}
              disabled={!selectedProjectId}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'select-project' && userProjects.length === 0 && (
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          )}

          {step === 'details' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('select-project')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={!detailsValid}>
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('details')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleSubmit}>Submit Application</Button>
            </div>
          )}

          {step === 'complete' && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
