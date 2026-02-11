'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Wallet,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Search,
  Download,
  Upload,
  FileText,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DecisionEntry } from './decision-entry';
import { DecisionForm } from './decision-form';
import { DecisionTimeline } from './decision-timeline';
import { useDecisions } from '@/hooks/use-decisions';
import {
  getCategoryLabel,
  getStatusLabel,
  getOutcomeLabel,
} from '@/lib/intelligence/decisions';
import { cn } from '@/lib/utils/cn';
import type {
  Decision,
  DecisionCategory,
  DecisionStatus,
  DecisionOutcome,
} from '@/types/intelligence';

// ============================================================================
// Constants
// ============================================================================

export interface DecisionJournalProps {
  className?: string;
}

const ITEMS_PER_PAGE = 10;

const ALL_CATEGORIES: DecisionCategory[] = [
  'strategic',
  'technical',
  'financial',
  'team',
  'partnership',
  'product',
  'marketing',
];

const ALL_STATUSES: DecisionStatus[] = [
  'proposed',
  'approved',
  'implemented',
  'revisited',
  'reversed',
];

const ALL_OUTCOMES: DecisionOutcome[] = [
  'pending',
  'successful',
  'partially_successful',
  'unsuccessful',
  'inconclusive',
];

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
          Connect your NEAR wallet to start documenting strategic decisions
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
      <BookOpen className="h-12 w-12 text-near-green-500" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Start Your Decision Journal
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Record your first strategic decision with context, rationale, and
          alternatives to build a searchable history
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="h-4 w-4" />
        Record First Decision
      </Button>
    </div>
  );
}

function SummaryStats({
  total,
  successful,
  pending,
  unsuccessful,
}: {
  total: number;
  successful: number;
  pending: number;
  unsuccessful: number;
}) {
  const stats = [
    {
      label: 'Total Decisions',
      value: total.toString(),
      icon: BookOpen,
      color: 'text-near-green-500',
    },
    {
      label: 'Successful',
      value: successful.toString(),
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: 'Pending',
      value: pending.toString(),
      icon: Clock,
      color: 'text-near-cyan-500',
    },
    {
      label: 'Unsuccessful',
      value: unsuccessful.toString(),
      icon: XCircle,
      color: 'text-error',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-3 rounded-lg bg-surface/50 border border-border"
        >
          <div className="flex items-center gap-2">
            <stat.icon className={cn('h-4 w-4', stat.color)} />
            <span className="text-xs text-text-muted">{stat.label}</span>
          </div>
          <p className="text-lg font-semibold text-text-primary mt-1">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Decision Journal main component.
 * Provides strategic decision tracking with AI-powered analysis.
 */
export function DecisionJournal({ className }: DecisionJournalProps) {
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | undefined>();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Pagination and view
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeTab, setActiveTab] = useState('list');

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    decisions,
    filteredDecisions,
    filter,
    isAnalyzing,
    analyzingId,
    error,
    isConnected,
    addDecision,
    updateDecision,
    removeDecision,
    updateOutcome,
    reanalyze,
    setFilter,
    clearError,
    setError,
    exportToMarkdown,
    exportData,
    importData,
  } = useDecisions();

  // Compute summary stats
  const stats = useMemo(
    () => ({
      total: decisions.length,
      successful: decisions.filter((d) => d.outcome === 'successful').length,
      pending: decisions.filter((d) => d.outcome === 'pending').length,
      unsuccessful: decisions.filter((d) => d.outcome === 'unsuccessful').length,
    }),
    [decisions]
  );

  // Handlers
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleSearchChange = (query: string) => {
    setFilter({ ...filter, searchQuery: query || undefined });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleCategoryFilter = (value: string) => {
    setFilter({
      ...filter,
      category: value === 'all' ? undefined : (value as DecisionCategory),
    });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleStatusFilter = (value: string) => {
    setFilter({
      ...filter,
      status: value === 'all' ? undefined : (value as DecisionStatus),
    });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleOutcomeFilter = (value: string) => {
    setFilter({
      ...filter,
      outcome: value === 'all' ? undefined : (value as DecisionOutcome),
    });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleEdit = (decision: Decision) => {
    setEditingDecision(decision);
    setEditDialogOpen(true);
  };

  const handleRemove = (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    setConfirmDialog({
      open: true,
      title: 'Delete Decision',
      description: `Are you sure you want to delete "${decision?.title ?? 'this decision'}"? This action cannot be undone.`,
      onConfirm: () => removeDecision(id),
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

  const handleTimelineSelect = (decision: Decision) => {
    handleEdit(decision);
  };

  // Guard cascade
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  if (error && decisions.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={clearError} />
      </Card>
    );
  }

  if (decisions.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <EmptyState onAdd={() => setAddDialogOpen(true)} />
        <DecisionForm
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSubmit={addDecision}
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
              Decision Journal
            </h2>
            <p className="text-sm text-text-muted">
              Track strategic decisions with context, rationale, and AI analysis
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={exportToMarkdown}
              className="h-8 w-8"
              title="Export as Markdown"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={exportData}
              className="h-8 w-8"
              title="Export data"
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
              onClick={() => setAddDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Record Decision
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary Stats */}
        <SummaryStats
          total={stats.total}
          successful={stats.successful}
          pending={stats.pending}
          unsuccessful={stats.unsuccessful}
        />

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 p-2 text-xs text-text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            Analyzing decision...
          </div>
        )}

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search decisions..."
              value={filter.searchQuery ?? ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Select
              value={filter.category ?? 'all'}
              onValueChange={handleCategoryFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.status ?? 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.outcome ?? 'all'}
              onValueChange={handleOutcomeFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                {ALL_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {getOutcomeLabel(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs: List View | Timeline */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="list">
              List View
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {filteredDecisions.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* List view */}
          <TabsContent value="list">
            <div className="space-y-2">
              {filteredDecisions.slice(0, visibleCount).map((decision) => (
                <DecisionEntry
                  key={decision.id}
                  decision={decision}
                  onEdit={handleEdit}
                  onRemove={handleRemove}
                  onUpdateOutcome={updateOutcome}
                  onReanalyze={reanalyze}
                  analyzingId={analyzingId}
                />
              ))}
              {filteredDecisions.length === 0 && (
                <p className="text-sm text-text-muted p-4 text-center">
                  No decisions match your filters.
                </p>
              )}
              {filteredDecisions.length > visibleCount && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                >
                  Show More ({filteredDecisions.length - visibleCount} remaining)
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Timeline view */}
          <TabsContent value="timeline">
            <DecisionTimeline
              decisions={filteredDecisions}
              onSelect={handleTimelineSelect}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Decision Dialog */}
      <DecisionForm
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={addDecision}
      />

      {/* Edit Decision Dialog */}
      <DecisionForm
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingDecision(undefined);
        }}
        onSubmit={addDecision}
        onUpdate={updateDecision}
        editingDecision={editingDecision}
      />

      {/* Confirm Dialog */}
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
