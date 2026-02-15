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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Users,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  RegisterProjectSchema,
  type RegisterProjectInput,
  type ProjectTeamMember,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegisterStep = 'details' | 'team' | 'review' | 'submitting' | 'complete';

interface RegisterProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (input: RegisterProjectInput) => Promise<boolean>;
  defaultAccountId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterProjectDialog({
  open,
  onOpenChange,
  onRegister,
  defaultAccountId,
}: RegisterProjectDialogProps) {
  const [step, setStep] = useState<RegisterStep>('details');
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([
    { accountId: defaultAccountId ?? '', name: '', role: 'Lead', profileUrl: '' },
  ]);

  const detailsValid = useMemo(() => {
    return name.length >= 2 && description.length >= 10;
  }, [name, description]);

  const teamValid = useMemo(() => {
    return teamMembers.length > 0 && teamMembers.every(
      (m) => m.accountId.length >= 2 && m.name.length >= 1 && m.role.length >= 1
    );
  }, [teamMembers]);

  const addTeamMember = useCallback(() => {
    setTeamMembers((prev) => [
      ...prev,
      { accountId: '', name: '', role: '', profileUrl: '' },
    ]);
  }, []);

  const removeTeamMember = useCallback((index: number) => {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTeamMember = useCallback(
    (index: number, field: keyof ProjectTeamMember, value: string) => {
      setTeamMembers((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      );
    },
    []
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && step === 'submitting') return;
      if (!newOpen) {
        setStep('details');
        setName('');
        setDescription('');
        setWebsite('');
        setTeamMembers([
          { accountId: defaultAccountId ?? '', name: '', role: 'Lead', profileUrl: '' },
        ]);
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [defaultAccountId, onOpenChange, step]
  );

  const handleSubmit = useCallback(async () => {
    const input: RegisterProjectInput = {
      name,
      description,
      website: website || undefined,
      teamMembers: teamMembers.map((m) => ({
        ...m,
        profileUrl: m.profileUrl || undefined,
      })),
    };

    const validation = RegisterProjectSchema.safeParse(input);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setStep('submitting');
    setError(null);

    const success = await onRegister(input);
    if (success) {
      setStep('complete');
    } else {
      setError('Registration failed. Please try again.');
      setStep('review');
    }
  }, [name, description, website, teamMembers, onRegister]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {step === 'complete' ? 'Project Registered' : 'Register Project'}
          </DialogTitle>
          <DialogDescription>
            {step === 'details' && 'Enter your project details.'}
            {step === 'team' && 'Add your team members.'}
            {step === 'review' && 'Review the project details before submitting.'}
            {step === 'submitting' && 'Registering project on-chain...'}
            {step === 'complete' && 'Your project has been registered successfully.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-text-primary">Project Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Website (optional)</label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Step: Team */}
        {step === 'team' && (
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {teamMembers.map((member, index) => (
              <div key={index} className="rounded-md border border-border bg-surface p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    Member {index + 1}
                  </span>
                  {teamMembers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-error"
                      onClick={() => removeTeamMember(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={member.accountId}
                    onChange={(e) => updateTeamMember(index, 'accountId', e.target.value)}
                    placeholder="account.testnet"
                    className="text-xs"
                  />
                  <Input
                    value={member.name}
                    onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                    placeholder="Display name"
                    className="text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={member.role}
                    onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                    placeholder="Role"
                    className="text-xs"
                  />
                  <Input
                    value={member.profileUrl ?? ''}
                    onChange={(e) => updateTeamMember(index, 'profileUrl', e.target.value)}
                    placeholder="Profile URL (optional)"
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addTeamMember}
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Team Member
            </Button>
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
                <span className="text-text-muted">Project</span>
                <span className="text-text-primary">{name}</span>
              </div>
              {website && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Website</span>
                  <span className="text-text-primary text-xs">{website}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Team Size</span>
                <span className="text-text-primary">{teamMembers.length}</span>
              </div>
            </div>
            <div className="space-y-1">
              {teamMembers.map((m, i) => (
                <div key={i} className="text-xs text-text-muted flex gap-2">
                  <span className="font-mono">{m.accountId}</span>
                  <span>—</span>
                  <span>{m.name} ({m.role})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">
              Registering project on-chain...
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
                Project registered successfully!
              </p>
              <p className="text-xs text-text-muted">{name}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'details' && (
            <Button onClick={() => setStep('team')} disabled={!detailsValid}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'team' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('details')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={!teamValid}>
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('team')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleSubmit}>Register Project</Button>
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
