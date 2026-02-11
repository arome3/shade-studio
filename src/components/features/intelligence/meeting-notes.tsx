'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Wallet,
  Plus,
  ClipboardList,
  CheckCircle2,
  ListTodo,
  Clock,
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
import { MeetingEntry } from './meeting-entry';
import { MeetingForm } from './meeting-form';
import { ActionItemList } from './action-item-list';
import { useMeetings } from '@/hooks/use-meetings';
import { getMeetingTypeLabel } from '@/lib/intelligence/meetings';
import { cn } from '@/lib/utils/cn';
import type { Meeting, MeetingType } from '@/types/intelligence';

// ============================================================================
// Constants
// ============================================================================

export interface MeetingNotesProps {
  className?: string;
}

const ITEMS_PER_PAGE = 10;

const ALL_MEETING_TYPES: MeetingType[] = [
  'team',
  'funder',
  'partner',
  'advisor',
  'community',
  'other',
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
          Connect your NEAR wallet to start capturing meeting notes
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
      <ClipboardList className="h-12 w-12 text-near-green-500" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Capture Your First Meeting
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Add meeting notes and let AI extract action items, decisions, and
          summaries automatically
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="h-4 w-4" />
        Add First Meeting
      </Button>
    </div>
  );
}

function SummaryStats({
  recentCount,
  totalActionItems,
  pendingActionItems,
  completionRate,
}: {
  recentCount: number;
  totalActionItems: number;
  pendingActionItems: number;
  completionRate: number;
}) {
  const stats = [
    {
      label: 'Meetings (30d)',
      value: recentCount.toString(),
      icon: Clock,
      color: 'text-near-green-500',
    },
    {
      label: 'Total Actions',
      value: totalActionItems.toString(),
      icon: ListTodo,
      color: 'text-near-cyan-500',
    },
    {
      label: 'Pending',
      value: pendingActionItems.toString(),
      icon: AlertCircle,
      color: 'text-warning',
    },
    {
      label: 'Completion',
      value: `${completionRate}%`,
      icon: CheckCircle2,
      color: 'text-success',
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
 * Meeting Notes Pipeline main component.
 * Provides meeting capture with AI-powered extraction of action items and decisions.
 */
export function MeetingNotes({ className }: MeetingNotesProps) {
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
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
  const [activeTab, setActiveTab] = useState('meetings');

  // Import success feedback
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Auto-clear success banner after 4 seconds
  useEffect(() => {
    if (!importSuccess) return;
    const timer = setTimeout(() => setImportSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [importSuccess]);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    meetings,
    filteredMeetings,
    filter,
    stats,
    isProcessing,
    processingId,
    error,
    isConnected,
    addMeeting,
    updateMeeting,
    removeMeeting,
    processMeeting,
    completeActionItem,
    pendingActionItems,
    setFilter,
    clearError,
    setError,
    exportToMarkdown,
    exportData,
    importData,
  } = useMeetings();

  // Handlers
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleSearchChange = (query: string) => {
    setFilter({ ...filter, searchQuery: query || undefined });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleTypeFilter = (value: string) => {
    setFilter({
      ...filter,
      type: value === 'all' ? undefined : (value as MeetingType),
    });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleStatusFilter = (value: string) => {
    setFilter({
      ...filter,
      status: value === 'all' ? undefined : (value as 'processed' | 'unprocessed'),
    });
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setEditDialogOpen(true);
  };

  const handleRemove = (id: string) => {
    const meeting = meetings.find((m) => m.id === id);
    setConfirmDialog({
      open: true,
      title: 'Delete Meeting',
      description: `Are you sure you want to delete "${meeting?.title ?? 'this meeting'}"? This action cannot be undone.`,
      onConfirm: () => removeMeeting(id),
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importData(file);
      setImportSuccess(`Imported ${result.meetings} new meeting(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setError(message);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Guard cascade
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  if (error && meetings.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={clearError} />
      </Card>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <EmptyState onAdd={() => setAddDialogOpen(true)} />
        <MeetingForm
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSubmit={addMeeting}
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
              Meeting Notes
            </h2>
            <p className="text-sm text-text-muted">
              Capture meetings and let AI extract action items, decisions, and summaries
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
              Add Meeting
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary Stats */}
        <SummaryStats
          recentCount={stats.recentCount}
          totalActionItems={stats.totalActionItems}
          pendingActionItems={stats.pendingActionItems}
          completionRate={stats.completionRate}
        />

        {/* Import success banner */}
        {importSuccess && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-success/10 border border-success/20 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {importSuccess}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-2 text-xs text-text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            Processing meeting notes...
          </div>
        )}

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search meetings..."
              value={filter.searchQuery ?? ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={filter.type ?? 'all'}
              onValueChange={handleTypeFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ALL_MEETING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getMeetingTypeLabel(t)}
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
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="unprocessed">Unprocessed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs: Meetings | Action Items */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="meetings">
              Meetings
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {filteredMeetings.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
          </TabsList>

          {/* Meetings list */}
          <TabsContent value="meetings">
            <div className="space-y-2">
              {filteredMeetings.slice(0, visibleCount).map((meeting) => (
                <MeetingEntry
                  key={meeting.id}
                  meeting={meeting}
                  onEdit={handleEdit}
                  onRemove={handleRemove}
                  onProcess={processMeeting}
                  onCompleteAction={completeActionItem}
                  processingId={processingId}
                />
              ))}
              {filteredMeetings.length === 0 && (
                <p className="text-sm text-text-muted p-4 text-center">
                  No meetings match your filters.
                </p>
              )}
              {filteredMeetings.length > visibleCount && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                >
                  Show More ({filteredMeetings.length - visibleCount} remaining)
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Action Items view */}
          <TabsContent value="actions">
            <ActionItemList
              items={pendingActionItems}
              onComplete={completeActionItem}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Meeting Dialog */}
      <MeetingForm
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={addMeeting}
      />

      {/* Edit Meeting Dialog */}
      <MeetingForm
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingMeeting(undefined);
        }}
        onSubmit={addMeeting}
        onUpdate={updateMeeting}
        editingMeeting={editingMeeting}
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
