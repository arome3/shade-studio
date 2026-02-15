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
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Bot,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  DeployAgentSchema,
  type AgentTemplate,
} from '@/types/agents';
import { CapabilityViewer } from './capability-viewer';
import { aggregatePermissions, getMaxRiskLevel } from '@/lib/agents/capabilities';
import { config } from '@/lib/config';
import { useWallet } from '@/hooks/use-wallet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeployStep = 'select-template' | 'configure' | 'review' | 'deploying' | 'complete';

interface DeployAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: AgentTemplate[];
  initialTemplateId?: string;
  onDeploy: (templateId: string, name: string, slug: string) => Promise<{ accountId: string } | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeployAgentDialog({
  open,
  onOpenChange,
  templates,
  initialTemplateId,
  onDeploy,
}: DeployAgentDialogProps) {
  const { accountId } = useWallet();
  const [step, setStep] = useState<DeployStep>(initialTemplateId ? 'configure' : 'select-template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId ?? '');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [deployedAccountId, setDeployedAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Slug validation
  const slugValidation = useMemo(() => {
    if (!slug) return null;
    const result = DeployAgentSchema.shape.slug.safeParse(slug);
    return result.success ? null : result.error.issues[0]?.message ?? 'Invalid slug';
  }, [slug]);

  const nameValidation = useMemo(() => {
    if (!name) return null;
    const result = DeployAgentSchema.shape.name.safeParse(name);
    return result.success ? null : result.error.issues[0]?.message ?? 'Invalid name';
  }, [name]);

  const fullAccountId = slug && accountId ? `${slug}.${accountId}` : '';
  const canConfigure = selectedTemplateId && name && slug && !slugValidation && !nameValidation;

  const riskLevel = selectedTemplate
    ? getMaxRiskLevel(selectedTemplate.capabilities)
    : 'low';

  const aggregatedPerms = selectedTemplate
    ? aggregatePermissions(selectedTemplate.capabilities)
    : [];

  // Reset state on close — blocked during deploy to prevent orphaned transactions
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && step === 'deploying') return; // Can't close during deploy
      if (!newOpen) {
        setStep(initialTemplateId ? 'configure' : 'select-template');
        setSelectedTemplateId(initialTemplateId ?? '');
        setName('');
        setSlug('');
        setDeployedAccountId(null);
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [initialTemplateId, onOpenChange, step]
  );

  const handleDeploy = useCallback(async () => {
    if (!selectedTemplateId || !name || !slug) return;

    setStep('deploying');
    setError(null);

    try {
      const result = await onDeploy(selectedTemplateId, name, slug);
      if (result) {
        setDeployedAccountId(result.accountId);
        setStep('complete');
      } else {
        setError('Deployment failed. Please try again.');
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStep('review');
    }
  }, [selectedTemplateId, name, slug, onDeploy]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {step === 'complete' ? 'Agent Deployed' : 'Deploy Agent'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-template' && 'Choose an agent template from the registry.'}
            {step === 'configure' && 'Configure your agent name and account ID.'}
            {step === 'review' && 'Review the deployment details before proceeding.'}
            {step === 'deploying' && 'Deploying your agent to NEAR...'}
            {step === 'complete' && 'Your agent has been successfully deployed.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select Template */}
        {step === 'select-template' && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  selectedTemplateId === t.id
                    ? 'border-text-primary bg-surface-hover'
                    : 'border-border bg-surface hover:bg-surface-hover'
                }`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    {t.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    v{t.version}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted mt-1 line-clamp-1">
                  {t.description}
                </p>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">
                No templates available.
              </p>
            )}
          </div>
        )}

        {/* Step: Configure */}
        {step === 'configure' && selectedTemplate && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Agent Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Analysis Agent"
                className="mt-1"
              />
              {nameValidation && (
                <p className="text-xs text-error mt-1">{nameValidation}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary">
                Account Slug
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-agent"
                className="mt-1"
              />
              {slugValidation && (
                <p className="text-xs text-error mt-1">{slugValidation}</p>
              )}
              {fullAccountId && !slugValidation && (
                <p className="text-xs text-text-muted mt-1 font-mono">
                  {fullAccountId}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && selectedTemplate && (
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-error/10 border border-error/20 text-sm text-error">
                {error}
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Template</span>
                <span className="text-text-primary">{selectedTemplate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Name</span>
                <span className="text-text-primary">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Account ID</span>
                <span className="text-text-primary font-mono text-xs">{fullAccountId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Estimated Cost</span>
                <span className="text-text-primary">~0.5 NEAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Risk Level</span>
                <Badge
                  variant={riskLevel === 'high' ? 'error' : riskLevel === 'medium' ? 'warning' : 'default'}
                  className="text-[10px]"
                >
                  {riskLevel}
                </Badge>
              </div>
            </div>
            <CapabilityViewer
              capabilities={selectedTemplate.capabilities}
              permissions={aggregatedPerms}
            />
          </div>
        )}

        {/* Step: Deploying */}
        {step === 'deploying' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">
              Creating sub-account and registering agent...
            </p>
            <p className="text-xs text-text-muted">
              Please approve the transaction in your wallet.
            </p>
            <p className="text-xs text-warning font-medium">
              Please wait — do not close this window.
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && deployedAccountId && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-text-primary">
                Agent deployed successfully!
              </p>
              <p className="text-xs font-mono text-text-muted">
                {deployedAccountId}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs"
            >
              <a
                href={`${config.near.explorerUrl}/address/${deployedAccountId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View on Explorer
              </a>
            </Button>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'select-template' && (
            <Button
              onClick={() => setStep('configure')}
              disabled={!selectedTemplateId}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'configure' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('select-template')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={!canConfigure}
              >
                Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setStep('configure')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleDeploy}>
                Deploy Agent
              </Button>
            </div>
          )}

          {step === 'complete' && (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
