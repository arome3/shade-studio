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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FolderOpen,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  RegisterProgramSchema,
  CATEGORY_LABELS,
  CHAIN_LABELS,
  PROGRAM_STATUSES,
  PROGRAM_STATUS_DISPLAY,
  formatFunding,
  type RegisterProgramInput,
  type GrantCategory,
  type GrantChain,
  type ProgramStatus,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegisterStep = 'details' | 'funding' | 'review' | 'submitting' | 'complete';

interface RegisterProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (input: RegisterProgramInput) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterProgramDialog({
  open,
  onOpenChange,
  onRegister,
}: RegisterProgramDialogProps) {
  const [step, setStep] = useState<RegisterStep>('details');
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organization, setOrganization] = useState('');
  const [website, setWebsite] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [selectedChains, setSelectedChains] = useState<GrantChain[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<GrantCategory[]>([]);
  const [fundingPool, setFundingPool] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<ProgramStatus>('active');

  // Validation
  const detailsValid = useMemo(() => {
    return (
      name.length >= 2 &&
      description.length >= 10 &&
      organization.length >= 2 &&
      website.length > 0 &&
      selectedChains.length > 0 &&
      selectedCategories.length > 0
    );
  }, [name, description, organization, website, selectedChains, selectedCategories]);

  const fundingValid = useMemo(() => {
    return fundingPool.length > 0;
  }, [fundingPool]);

  const toggleChain = useCallback((chain: GrantChain) => {
    setSelectedChains((prev) =>
      prev.includes(chain) ? prev.filter((c) => c !== chain) : [...prev, chain]
    );
  }, []);

  const toggleCategory = useCallback((category: GrantCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && step === 'submitting') return;
      if (!newOpen) {
        setStep('details');
        setName('');
        setDescription('');
        setOrganization('');
        setWebsite('');
        setApplicationUrl('');
        setSelectedChains([]);
        setSelectedCategories([]);
        setFundingPool('');
        setMinAmount('');
        setMaxAmount('');
        setDeadline('');
        setStatus('active');
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, step]
  );

  const handleSubmit = useCallback(async () => {
    const input: RegisterProgramInput = {
      name,
      description,
      organization,
      chains: selectedChains,
      categories: selectedCategories,
      fundingPool,
      minAmount: minAmount || undefined,
      maxAmount: maxAmount || undefined,
      deadline: deadline || undefined,
      website,
      applicationUrl: applicationUrl || undefined,
      status,
    };

    // Validate with Zod
    const validation = RegisterProgramSchema.safeParse(input);
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
  }, [
    name, description, organization, selectedChains, selectedCategories,
    fundingPool, minAmount, maxAmount, deadline, website, applicationUrl,
    status, onRegister,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {step === 'complete' ? 'Program Registered' : 'Register Grant Program'}
          </DialogTitle>
          <DialogDescription>
            {step === 'details' && 'Enter the program details and select chains/categories.'}
            {step === 'funding' && 'Configure the funding parameters.'}
            {step === 'review' && 'Review the program details before submitting.'}
            {step === 'submitting' && 'Registering program on-chain...'}
            {step === 'complete' && 'The grant program has been registered successfully.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-text-primary">Program Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gitcoin GG20"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Organization</label>
              <Input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Gitcoin"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the grant program..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Website</label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Application URL (optional)</label>
              <Input
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://example.com/apply"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Chains</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CHAIN_LABELS).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={selectedChains.includes(key as GrantChain) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => toggleChain(key as GrantChain)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Categories</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={selectedCategories.includes(key as GrantCategory) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => toggleCategory(key as GrantCategory)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Funding */}
        {step === 'funding' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-text-primary">Funding Pool (USD)</label>
              <Input
                value={fundingPool}
                onChange={(e) => setFundingPool(e.target.value)}
                placeholder="1000000"
                className="mt-1"
                type="text"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-text-primary">Min Amount (optional)</label>
                <Input
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="1000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Max Amount (optional)</label>
                <Input
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="50000"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Deadline (optional)</label>
              <Input
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="2025-12-31"
                className="mt-1"
                type="date"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProgramStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROGRAM_STATUS_DISPLAY[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <span className="text-text-primary">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Organization</span>
                <span className="text-text-primary">{organization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Funding Pool</span>
                <span className="text-text-primary">{formatFunding(fundingPool)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Status</span>
                <Badge variant={PROGRAM_STATUS_DISPLAY[status].variant} className="text-[10px]">
                  {PROGRAM_STATUS_DISPLAY[status].label}
                </Badge>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-text-muted">Chains</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedChains.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">
                      {CHAIN_LABELS[c]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-text-muted">Categories</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selectedCategories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[c]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">
              Registering program on-chain...
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
                Program registered successfully!
              </p>
              <p className="text-xs text-text-muted">
                {name} by {organization}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'details' && (
            <Button onClick={() => setStep('funding')} disabled={!detailsValid}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'funding' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('details')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={!fundingValid}>
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('funding')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleSubmit}>Register Program</Button>
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
