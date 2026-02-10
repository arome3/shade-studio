'use client';

import { useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Wallet,
  Plus,
  Shield,
  Activity,
  DollarSign,
  Users,
  TrendingUp,
  Sparkles,
  Search,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CompetitorCard } from './competitor-card';
import { CompetitorEntry } from './competitor-entry';
import { AddCompetitorDialog } from './add-competitor';
import { AddEntryDialog } from './add-entry-dialog';
import { useCompetitive } from '@/hooks/use-competitive';
import { cn } from '@/lib/utils/cn';
import type { Competitor } from '@/types/intelligence';

export interface CompetitiveTrackerProps {
  className?: string;
}

const ITEMS_PER_PAGE = 10;

/**
 * Wallet connection prompt for disconnected state.
 */
function WalletPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-8 text-center">
      <Wallet className="h-12 w-12 text-text-muted" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Connect Your Wallet
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Connect your NEAR wallet to track competitors and get strategic insights
        </p>
      </div>
    </div>
  );
}

/**
 * Error state display.
 */
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
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

/**
 * Empty state with CTA to add first competitor.
 */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
      <Shield className="h-12 w-12 text-near-green-500" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          Track Your Competitors
        </h3>
        <p className="text-sm text-text-muted mt-1">
          Add your first competitor to start monitoring their activities and get
          AI-powered strategic insights
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Your First Competitor
      </Button>
    </div>
  );
}

/**
 * Summary stats grid showing competitive landscape metrics.
 */
function SummaryStats({
  competitorCount,
  recentEntries,
  fundingTracked,
  highThreats,
}: {
  competitorCount: number;
  recentEntries: number;
  fundingTracked: number;
  highThreats: number;
}) {
  const formatFunding = (amount: number): string => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    if (amount > 0) return `$${amount}`;
    return '0';
  };

  const stats = [
    {
      label: 'Competitors',
      value: competitorCount.toString(),
      icon: Users,
      color: 'text-near-green-500',
    },
    {
      label: 'Recent Activity',
      value: recentEntries.toString(),
      icon: Activity,
      color: 'text-near-cyan-500',
    },
    {
      label: 'Funding Tracked',
      value: formatFunding(fundingTracked),
      icon: DollarSign,
      color: 'text-success',
    },
    {
      label: 'High Threats',
      value: highThreats.toString(),
      icon: Shield,
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

/**
 * Competitive Tracker main component.
 * Provides competitor monitoring with AI-powered strategic insights.
 */
export function CompetitiveTracker({ className }: CompetitiveTrackerProps) {
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | undefined>();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [entryTargetCompetitor, setEntryTargetCompetitor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeTab, setActiveTab] = useState('all');

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    competitors,
    entries,
    summary,
    isLoading,
    isAnalyzing,
    error,
    isConnected,
    addCompetitor,
    updateCompetitor,
    removeCompetitor,
    addEntry,
    removeEntry,
    refreshSummary,
    getCompetitorEntries,
    exportData,
    importData,
  } = useCompetitive();

  // Derive all unique categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const comp of competitors) {
      for (const cat of comp.categories) {
        cats.add(cat);
      }
    }
    return Array.from(cats).sort();
  }, [competitors]);

  // Existing competitor names for duplicate detection
  const existingNames = useMemo(
    () => competitors.map((c) => c.name),
    [competitors]
  );

  // Filter helpers
  const matchesSearch = (text: string): boolean => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const matchesCategories = (categories: string[]): boolean => {
    if (selectedCategories.length === 0) return true;
    return selectedCategories.some((cat) => categories.includes(cat));
  };

  // Filtered competitors
  const filteredCompetitors = useMemo(
    () =>
      competitors.filter(
        (c) =>
          (matchesSearch(c.name) || matchesSearch(c.description)) &&
          matchesCategories(c.categories)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitors, searchQuery, selectedCategories]
  );

  // Filtered entries
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentEntries = useMemo(
    () => entries.filter((e) => e.createdAt >= thirtyDaysAgo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries]
  );

  const filteredRecentEntries = useMemo(
    () =>
      recentEntries.filter(
        (e) => matchesSearch(e.title) || matchesSearch(e.description)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentEntries, searchQuery]
  );

  const highThreatCompetitors = useMemo(
    () => filteredCompetitors.filter((c) => c.threatLevel >= 4),
    [filteredCompetitors]
  );

  // Reset pagination when filters change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
    setVisibleCount(ITEMS_PER_PAGE);
  };

  // Action handlers
  const handleAddEntry = (competitorId: string) => {
    const comp = competitors.find((c) => c.id === competitorId);
    if (comp) {
      setEntryTargetCompetitor({ id: comp.id, name: comp.name });
      setAddEntryDialogOpen(true);
    }
  };

  const handleEditCompetitor = (competitor: Competitor) => {
    setEditingCompetitor(competitor);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (input: Parameters<typeof addCompetitor>[0]) => {
    if (editingCompetitor) {
      updateCompetitor(editingCompetitor.id, {
        name: input.name,
        description: input.description,
        website: input.website,
        twitter: input.twitter,
        github: input.github,
        categories: input.categories,
        threatLevel: input.threatLevel,
        notes: input.notes,
      });
    }
  };

  const handleRemoveCompetitor = (id: string) => {
    const comp = competitors.find((c) => c.id === id);
    setConfirmDialog({
      open: true,
      title: 'Remove Competitor',
      description: `Are you sure you want to remove "${comp?.name ?? 'this competitor'}"? This will also delete all associated entries. This action cannot be undone.`,
      onConfirm: () => removeCompetitor(id),
    });
  };

  const handleRemoveEntry = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Entry',
      description:
        'Are you sure you want to remove this entry? This action cannot be undone.',
      onConfirm: () => removeEntry(id),
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
    } catch (err) {
      console.error('[CompetitiveTracker] Import failed:', err);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get competitor name helper
  const getCompetitorName = (competitorId: string): string => {
    const comp = competitors.find((c) => c.id === competitorId);
    return comp?.name ?? 'Unknown';
  };

  // Funding tracked sum from summary or entries
  const fundingTracked = summary?.totalFundingTracked ?? 0;

  // Not connected
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  // Error state (only if no competitors to show)
  if (error && competitors.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={refreshSummary} />
      </Card>
    );
  }

  // Empty state
  if (competitors.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <EmptyState onAdd={() => setAddDialogOpen(true)} />
        <AddCompetitorDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSubmit={addCompetitor}
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
              Competitive Tracker
            </h2>
            <p className="text-sm text-text-muted">
              Monitor competitors and get AI-powered strategic insights
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshSummary}
              disabled={isLoading || isAnalyzing}
              className="h-8 w-8"
              title="Refresh summary"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  (isLoading || isAnalyzing) && 'animate-spin'
                )}
              />
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
              Add Competitor
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary Stats */}
        <SummaryStats
          competitorCount={competitors.length}
          recentEntries={recentEntries.length}
          fundingTracked={fundingTracked}
          highThreats={competitors.filter((c) => c.threatLevel >= 4).length}
        />

        {/* Key Trends */}
        {summary && summary.trends.length > 0 && (
          <div className="p-3 rounded-lg bg-near-cyan-500/10 border border-near-cyan-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-near-cyan-500" />
              <span className="text-sm font-medium text-text-primary">
                Key Trends
              </span>
            </div>
            <ul className="space-y-1">
              {summary.trends.map((trend, index) => (
                <li
                  key={index}
                  className="text-xs text-text-secondary flex items-start gap-2"
                >
                  <span className="text-near-cyan-500 mt-0.5">&#8226;</span>
                  {trend}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 p-2 text-xs text-text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            Analyzing competitive landscape...
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search competitors and entries..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((category) => (
              <Badge
                key={category}
                variant={
                  selectedCategories.includes(category) ? 'default' : 'outline'
                }
                className="cursor-pointer text-xs"
                onClick={() => handleCategoryToggle(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {filteredCompetitors.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="high-threat">
              High Threat
              {highThreatCompetitors.length > 0 && (
                <Badge variant="error" className="ml-1.5 text-[10px]">
                  {highThreatCompetitors.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recent Activity
              {filteredRecentEntries.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  {filteredRecentEntries.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* All competitors */}
          <TabsContent value="all">
            <div className="space-y-3">
              {filteredCompetitors.slice(0, visibleCount).map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  competitor={competitor}
                  entryCount={getCompetitorEntries(competitor.id).length}
                  onAddEntry={handleAddEntry}
                  onEdit={handleEditCompetitor}
                  onRemove={handleRemoveCompetitor}
                />
              ))}
              {filteredCompetitors.length === 0 && (
                <p className="text-sm text-text-muted p-4 text-center">
                  No competitors match your search.
                </p>
              )}
              {filteredCompetitors.length > visibleCount && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                >
                  Show More ({filteredCompetitors.length - visibleCount} remaining)
                </Button>
              )}
            </div>
          </TabsContent>

          {/* High threat competitors */}
          <TabsContent value="high-threat">
            {highThreatCompetitors.length === 0 ? (
              <p className="text-sm text-text-muted p-4 text-center">
                No high-threat competitors tracked.
              </p>
            ) : (
              <div className="space-y-3">
                {highThreatCompetitors.slice(0, visibleCount).map((competitor) => (
                  <CompetitorCard
                    key={competitor.id}
                    competitor={competitor}
                    entryCount={getCompetitorEntries(competitor.id).length}
                    onAddEntry={handleAddEntry}
                    onEdit={handleEditCompetitor}
                    onRemove={handleRemoveCompetitor}
                  />
                ))}
                {highThreatCompetitors.length > visibleCount && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                  >
                    Show More ({highThreatCompetitors.length - visibleCount} remaining)
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Recent activity entries */}
          <TabsContent value="recent">
            {filteredRecentEntries.length === 0 ? (
              <p className="text-sm text-text-muted p-4 text-center">
                No recent competitive activity.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRecentEntries.slice(0, visibleCount).map((entry) => (
                  <CompetitorEntry
                    key={entry.id}
                    entry={entry}
                    competitorName={getCompetitorName(entry.competitorId)}
                    onRemove={handleRemoveEntry}
                  />
                ))}
                {filteredRecentEntries.length > visibleCount && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                  >
                    Show More ({filteredRecentEntries.length - visibleCount} remaining)
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Competitor Dialog */}
      <AddCompetitorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={addCompetitor}
        existingNames={existingNames}
      />

      {/* Edit Competitor Dialog */}
      <AddCompetitorDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingCompetitor(undefined);
        }}
        onSubmit={handleEditSubmit}
        editingCompetitor={editingCompetitor}
        existingNames={existingNames}
      />

      {/* Add Entry Dialog */}
      {entryTargetCompetitor && (
        <AddEntryDialog
          open={addEntryDialogOpen}
          onOpenChange={(open) => {
            setAddEntryDialogOpen(open);
            if (!open) setEntryTargetCompetitor(null);
          }}
          competitorId={entryTargetCompetitor.id}
          competitorName={entryTargetCompetitor.name}
          onSubmit={addEntry}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Card>
  );
}
