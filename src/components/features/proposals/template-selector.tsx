'use client';

import { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PROPOSAL_TEMPLATES, getGrantProgramLabel } from '@/lib/proposals/templates';
import { cn } from '@/lib/utils/cn';
import type { ProposalTemplate } from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string, title: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TemplateSelector({
  open,
  onOpenChange,
  onSelect,
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [step, setStep] = useState<'template' | 'name'>('template');

  const handleSelectTemplate = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    setStep('name');
  };

  const handleCreate = () => {
    if (!selectedTemplate || !title.trim()) return;
    onSelect(selectedTemplate.id, title.trim());
    handleClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setTitle('');
    setStep('template');
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('template');
    setTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        {step === 'template' ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose a Template</DialogTitle>
              <DialogDescription>
                Select a grant program template to structure your proposal
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {PROPOSAL_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border border-border',
                    'hover:border-near-green-500/50 hover:bg-surface/50',
                    'transition-colors cursor-pointer'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-near-green-500 shrink-0" />
                        <span className="font-medium text-text-primary">
                          {template.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {getGrantProgramLabel(template.grantProgram)}
                        </Badge>
                      </div>
                      <p className="text-sm text-text-muted mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                        <span>{template.sections.length} sections</span>
                        <span>
                          {template.sections.filter((s) => s.required).length} required
                        </span>
                        {template.amountRange && (
                          <span>
                            ${template.amountRange.min.toLocaleString()} –
                            ${template.amountRange.max.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {template.applicationUrl && (
                      <ExternalLink className="h-4 w-4 text-text-muted shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Name Your Proposal</DialogTitle>
              <DialogDescription>
                Using {selectedTemplate?.name} template
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <Input
                placeholder="e.g., DeFi Analytics Dashboard for NEAR"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={!title.trim()}>
                Create Proposal
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
