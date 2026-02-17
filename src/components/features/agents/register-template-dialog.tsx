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
  Loader2,
  PackagePlus,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { AgentCapability } from '@/types/agents';
import { CAPABILITY_LABELS, AGENT_CAPABILITIES } from '@/types/agents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'details' | 'capabilities' | 'review' | 'submitting' | 'complete';

export interface RegisterTemplateInput {
  id: string;
  name: string;
  description: string;
  version: string;
  codehash: string;
  sourceUrl: string;
  capabilities: AgentCapability[];
  requiredPermissions: Array<{
    receiverId: string;
    methodNames: string[];
    allowance: string;
    purpose: string;
  }>;
}

interface RegisterTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (input: RegisterTemplateInput) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterTemplateDialog({
  open,
  onOpenChange,
  onRegister,
}: RegisterTemplateDialogProps) {
  const [step, setStep] = useState<Step>('details');
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [codehash, setCodehash] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [capabilities, setCapabilities] = useState<Set<AgentCapability>>(new Set());

  const detailsValid = useMemo(() => {
    return (
      id.length >= 2 &&
      name.length >= 2 &&
      description.length >= 10 &&
      version.length >= 1 &&
      codehash.length >= 4 &&
      sourceUrl.length >= 5
    );
  }, [id, name, description, version, codehash, sourceUrl]);

  const capabilitiesValid = useMemo(() => capabilities.size > 0, [capabilities]);

  const toggleCapability = useCallback((cap: AgentCapability) => {
    setCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) {
        next.delete(cap);
      } else {
        next.add(cap);
      }
      return next;
    });
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && step === 'submitting') return;
      if (!newOpen) {
        setStep('details');
        setId('');
        setName('');
        setDescription('');
        setVersion('1.0.0');
        setCodehash('');
        setSourceUrl('');
        setCapabilities(new Set());
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, step]
  );

  const handleSubmit = useCallback(async () => {
    const capsArray = Array.from(capabilities);

    // Build required permissions from capabilities
    const requiredPermissions: RegisterTemplateInput['requiredPermissions'] = [];
    if (capsArray.includes('social-read') || capsArray.includes('read-documents')) {
      requiredPermissions.push({
        receiverId: 'v1.social08.testnet',
        methodNames: ['get'],
        allowance: '250000000000000000000000',
        purpose: 'Read data from NEAR Social',
      });
    }
    if (capsArray.includes('social-write') || capsArray.includes('write-documents')) {
      requiredPermissions.push({
        receiverId: 'v1.social08.testnet',
        methodNames: ['set'],
        allowance: '500000000000000000000000',
        purpose: 'Write data to NEAR Social',
      });
    }
    if (capsArray.includes('blockchain-read')) {
      requiredPermissions.push({
        receiverId: 'grant-registry.private-grant-studio.testnet',
        methodNames: ['get_program', 'search_programs', 'get_ecosystem_stats'],
        allowance: '250000000000000000000000',
        purpose: 'Read grant program data',
      });
    }

    const input: RegisterTemplateInput = {
      id,
      name,
      description,
      version,
      codehash,
      sourceUrl,
      capabilities: capsArray,
      requiredPermissions,
    };

    setStep('submitting');
    setError(null);

    const success = await onRegister(input);
    if (success) {
      setStep('complete');
    } else {
      setError('Registration failed. Please try again.');
      setStep('review');
    }
  }, [id, name, description, version, codehash, sourceUrl, capabilities, onRegister]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            {step === 'complete' ? 'Template Registered' : 'Register Template'}
          </DialogTitle>
          <DialogDescription>
            {step === 'details' && 'Enter template details.'}
            {step === 'capabilities' && 'Select agent capabilities.'}
            {step === 'review' && 'Review before registering on-chain.'}
            {step === 'submitting' && 'Registering template on-chain...'}
            {step === 'complete' && 'Template registered successfully.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-text-primary">Template ID</label>
                <Input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="grant-analyst-v1"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Version</label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grant Analyst Agent"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="AI agent that analyzes grant programs..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Codehash</label>
              <Input
                value={codehash}
                onChange={(e) => setCodehash(e.target.value)}
                placeholder="sha256_..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">Source URL</label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Step: Capabilities */}
        {step === 'capabilities' && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Select the capabilities this agent template requires.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_CAPABILITIES.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCapability(cap)}
                  className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                    capabilities.has(cap)
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border bg-surface text-text-muted hover:border-border/80'
                  }`}
                >
                  {CAPABILITY_LABELS[cap]}
                </button>
              ))}
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
                <span className="text-text-muted">ID</span>
                <span className="text-text-primary font-mono text-xs">{id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Name</span>
                <span className="text-text-primary">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Version</span>
                <span className="text-text-primary">{version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Codehash</span>
                <span className="text-text-primary font-mono text-xs truncate max-w-[200px]">
                  {codehash}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from(capabilities).map((cap) => (
                <Badge key={cap} variant="outline" className="text-[10px]">
                  {CAPABILITY_LABELS[cap]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">Registering template on-chain...</p>
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
                Template registered!
              </p>
              <p className="text-xs text-text-muted font-mono">{id}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'details' && (
            <Button onClick={() => setStep('capabilities')} disabled={!detailsValid}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 'capabilities' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('details')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={!capabilitiesValid}>
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          {step === 'review' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('capabilities')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleSubmit}>Register Template</Button>
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
