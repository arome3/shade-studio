'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Wallet,
  Plus,
  FileEdit,
  Search,
  Download,
  Upload,
  Trash2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TemplateSelector } from './template-selector';
import { useProposals } from '@/hooks/use-proposals';
import { getGrantProgramLabel, checkCompleteness } from '@/lib/proposals';
import { cn } from '@/lib/utils/cn';
import type {
  GrantProgram,
  ProposalStatus,
  ProposalWorkflow,
} from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export interface ProposalListProps {
  onEditProposal: (proposalId: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: { value: ProposalStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'funded', label: 'Funded' },
  { value: 'completed', label: 'Completed' },
];

const PROGRAM_OPTIONS: { value: GrantProgram; label: string }[] = [
  { value: 'potlock', label: 'PotLock' },
  { value: 'gitcoin', label: 'Gitcoin' },
  { value: 'optimism_rpgf', label: 'Optimism RPGF' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_BADGE_VARIANT: Record<ProposalStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'error'> = {
  draft: 'outline',
  ready: 'success',
  submitted: 'secondary',
  'under-review': 'warning',
  approved: 'success',
  rejected: 'error',
  funded: 'success',
  completed: 'default',
};

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
          Connect your NEAR wallet to manage grant proposals
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
      <FileEdit className="h-12 w-12 text-near-green-500" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Create Your First Proposal
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Use a template to structure your grant application with section-by-section
          AI assistance
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="h-4 w-4" />
        New Proposal
      </Button>
    </div>
  );
}

function ProposalCard({
  workflow,
  onEdit,
  onDelete,
}: {
  workflow: ProposalWorkflow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completeness = useMemo(() => checkCompleteness(workflow), [workflow]);
  const { proposal, grantProgram, version } = workflow;

  return (
    <button
      onClick={onEdit}
      className={cn(
        'w-full text-left p-4 rounded-lg border border-border',
        'hover:border-near-green-500/30 hover:bg-surface/30',
        'transition-colors group'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-text-primary truncate">
              {proposal.title}
            </h3>
            <Badge
              variant={STATUS_BADGE_VARIANT[proposal.status]}
              className="text-[10px]"
            >
              {proposal.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {getGrantProgramLabel(grantProgram)}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
            <span>{completeness.percentage}% complete</span>
            <span>v{version}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(proposal.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Trash2 className="h-4 w-4 text-text-muted hover:text-error" />
        </Button>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalList({
  onEditProposal,
  className,
}: ProposalListProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    proposals,
    filteredProposals,
    filter,
    error,
    isConnected,
    createProposal,
    removeProposal,
    setFilter,
    clearError,
    setError,
    exportAllData,
    importData,
  } = useProposals();

  const stats = useMemo(
    () => ({
      total: proposals.length,
      drafts: proposals.filter((p) => p.proposal.status === 'draft').length,
      submitted: proposals.filter((p) => p.proposal.status === 'submitted').length,
      funded: proposals.filter((p) => p.proposal.status === 'funded').length,
    }),
    [proposals]
  );

  const handleCreate = (templateId: string, title: string) => {
    const proposalId = createProposal(templateId, title);
    onEditProposal(proposalId);
  };

  const handleDelete = (workflow: ProposalWorkflow) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Proposal',
      description: `Are you sure you want to delete "${workflow.proposal.title}"? This action cannot be undone.`,
      onConfirm: () => removeProposal(workflow.proposal.id),
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setError(message);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearchChange = (query: string) => {
    setFilter({ ...filter, searchQuery: query || undefined });
  };

  const handleStatusFilter = (value: string) => {
    setFilter({
      ...filter,
      status: value === 'all' ? undefined : (value as ProposalStatus),
    });
  };

  const handleProgramFilter = (value: string) => {
    setFilter({
      ...filter,
      grantProgram: value === 'all' ? undefined : (value as GrantProgram),
    });
  };

  // Guard cascade
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  if (error && proposals.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={clearError} />
      </Card>
    );
  }

  if (proposals.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <EmptyState onAdd={() => setSelectorOpen(true)} />
        <TemplateSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          onSelect={handleCreate}
        />
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-text-primary">
              Proposals
            </h2>
            <p className="text-sm text-text-muted">
              Draft and manage grant proposals with AI-powered assistance
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={exportAllData}
              className="h-8 w-8"
              title="Export all data"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8"
              title="Import data"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectorOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Proposal
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-near-green-500' },
            { label: 'Drafts', value: stats.drafts, color: 'text-text-muted' },
            { label: 'Submitted', value: stats.submitted, color: 'text-near-cyan-500' },
            { label: 'Funded', value: stats.funded, color: 'text-success' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-lg bg-surface/50 border border-border"
            >
              <span className="text-xs text-text-muted">{stat.label}</span>
              <p className={cn('text-lg font-semibold mt-0.5', stat.color)}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search proposals..."
              value={filter.searchQuery ?? ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={filter.status ?? 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.grantProgram ?? 'all'}
              onValueChange={handleProgramFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {PROGRAM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Proposal list */}
        <div className="space-y-2">
          {filteredProposals.map((workflow) => (
            <ProposalCard
              key={workflow.proposal.id}
              workflow={workflow}
              onEdit={() => onEditProposal(workflow.proposal.id)}
              onDelete={() => handleDelete(workflow)}
            />
          ))}
          {filteredProposals.length === 0 && (
            <p className="text-sm text-text-muted p-4 text-center">
              No proposals match your filters.
            </p>
          )}
        </div>
      </div>

      {/* Template selector dialog */}
      <TemplateSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleCreate}
      />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Card>
  );
}
