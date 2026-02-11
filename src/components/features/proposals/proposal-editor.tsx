'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Download,
  Save,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SectionSidebar } from './section-sidebar';
import { ProposalSectionEditor } from './proposal-section';
import { AIAssistantPanel } from './ai-assistant-panel';
import { CompletenessChecker } from './completeness-checker';
import { ExportDialog } from './export-dialog';
import { useProposals } from '@/hooks/use-proposals';
import { useProposalAI } from '@/hooks/use-proposal-ai';
import { useProposalWorkflow } from '@/stores/proposal-store';
import { getGrantProgramLabel, checkCompleteness } from '@/lib/proposals';
import { cn } from '@/lib/utils/cn';

// ============================================================================
// Types
// ============================================================================

export interface ProposalEditorProps {
  proposalId: string;
  onBack: () => void;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function WalletPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-8 text-center">
      <Wallet className="h-12 w-12 text-text-muted" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Connect Your Wallet
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Connect your NEAR wallet to edit proposals
        </p>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
      <AlertCircle className="h-12 w-12 text-error" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Something Went Wrong
        </h3>
        <p className="text-sm text-text-muted mt-1">{error}</p>
      </div>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        Try Again
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalEditor({
  proposalId,
  onBack,
  className,
}: ProposalEditorProps) {
  const [completenessOpen, setCompletenessOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const {
    isConnected,
    error,
    updateSection,
    setActiveSectionId,
    saveVersion,
    toggleAIPanel,
    exportMarkdown,
    exportJSON,
    clearError,
  } = useProposals();

  const workflow = useProposalWorkflow(proposalId);

  const ai = useProposalAI();

  // Completeness result
  const completeness = useMemo(
    () => (workflow ? checkCompleteness(workflow) : null),
    [workflow]
  );

  // Active section
  const activeSection = useMemo(
    () =>
      workflow?.sections.find((s) => s.id === workflow.activeSectionId) ??
      workflow?.sections[0] ??
      null,
    [workflow]
  );

  // Guard cascade
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={clearError} />
      </Card>
    );
  }

  if (!workflow) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-text-muted" />
          <p className="text-sm text-text-muted">Proposal not found</p>
          <Button onClick={onBack} variant="outline">
            Back to Proposals
          </Button>
        </div>
      </Card>
    );
  }

  const handleSectionSelect = (sectionId: string) => {
    setActiveSectionId(proposalId, sectionId);
    ai.clearSuggestion();
  };

  const handleSectionChange = (content: string) => {
    if (activeSection) {
      updateSection(proposalId, activeSection.id, content);
    }
  };

  const handleSaveVersion = () => {
    saveVersion(proposalId, `Manual save — v${workflow.version}`);
  };

  const handleNavigateToSection = (sectionId: string) => {
    setActiveSectionId(proposalId, sectionId);
  };

  return (
    <Card className={cn('overflow-hidden flex flex-col h-full', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary truncate">
                  {workflow.proposal.title}
                </h2>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {getGrantProgramLabel(workflow.grantProgram)}
                </Badge>
                <Badge
                  variant={workflow.proposal.status === 'draft' ? 'outline' : 'success'}
                  className="text-[10px] shrink-0"
                >
                  {workflow.proposal.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Progress
                  value={completeness?.percentage ?? 0}
                  className="h-1.5 w-32"
                />
                <span className="text-xs text-text-muted">
                  {completeness?.percentage ?? 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompletenessOpen(true)}
              className="gap-1.5 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Check
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAIPanel(proposalId)}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveVersion}
              className="gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Save v{workflow.version}
            </Button>
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — section nav */}
        <SectionSidebar
          sections={workflow.sections}
          activeSectionId={workflow.activeSectionId}
          onSelectSection={handleSectionSelect}
          className="w-56 shrink-0"
        />

        {/* Center — editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeSection ? (
            <ProposalSectionEditor
              section={activeSection}
              onChange={handleSectionChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Select a section to begin editing
            </div>
          )}
        </div>

        {/* Right panel — AI assistant */}
        {workflow.showAIPanel && activeSection && (
          <AIAssistantPanel
            suggestion={ai.suggestion}
            isGenerating={ai.isGenerating}
            aiError={ai.aiError}
            lastAction={ai.lastAction}
            sectionHasContent={!!activeSection.content.trim()}
            onImprove={() => ai.improve(proposalId, activeSection.id)}
            onGenerate={() => ai.generate(proposalId, activeSection.id)}
            onReview={() => ai.review(proposalId, activeSection.id)}
            onCustomPrompt={(prompt) =>
              ai.customPrompt(proposalId, activeSection.id, prompt)
            }
            onInsert={() => ai.insertSuggestion(proposalId, activeSection.id)}
            onCopy={() => {}}
            onClear={ai.clearSuggestion}
            onCancel={ai.cancel}
            className="w-80 shrink-0"
          />
        )}
      </div>

      {/* Dialogs */}
      <CompletenessChecker
        open={completenessOpen}
        onOpenChange={setCompletenessOpen}
        result={completeness}
        onNavigateToSection={handleNavigateToSection}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExportMarkdown={() => exportMarkdown(proposalId)}
        onExportJSON={() => exportJSON(proposalId)}
        proposalTitle={workflow.proposal.title}
      />
    </Card>
  );
}
