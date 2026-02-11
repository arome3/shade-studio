'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Wallet,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Lightbulb,
  AlertTriangle,
  Star,
  Shield,
  Sparkles,
  Download,
  Upload,
  FileText,
  RefreshCw,
  CalendarDays,
  Users,
  GitBranch,
  Crosshair,
  CheckCircle2,
  ListTodo,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BriefingSection } from './briefing-section';
import { WeekSelector } from './week-selector';
import { useSynthesis } from '@/hooks/use-synthesis';
import {
  getTrendDirectionBadgeVariant,
  getRecommendationPriorityBadgeVariant,
  getEffortBadgeVariant,
} from '@/lib/intelligence/synthesis';
import { GENERATION_STAGE_LABELS } from '@/stores/synthesis-store';
import { cn } from '@/lib/utils/cn';
import type {
  WeeklyTrend,
  WeeklyGrantProgress,
  WeeklyRecommendation,
  WeeklySummaryStats,
  TrendDirection,
} from '@/types/intelligence';

// ============================================================================
// Props
// ============================================================================

export interface WeeklySynthesisProps {
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
          Connect your NEAR wallet to access weekly intelligence synthesis
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 p-8 text-center">
      <BarChart3 className="h-12 w-12 text-near-green-500" />
      <div>
        <h3 className="text-lg font-medium text-text-primary">
          No Data Available Yet
        </h3>
        <p className="text-sm text-text-muted mt-1 max-w-md">
          Start using the Daily Briefing, Meeting Notes, Decision Journal, or
          Competitive Tracker modules to build up data for weekly synthesis
          reports.
        </p>
      </div>
    </div>
  );
}

/** Format a delta as a colored badge string (+N / -N / =) */
function StatDelta({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) return null;

  return (
    <span
      className={cn(
        'text-[10px] font-medium px-1 py-0.5 rounded',
        delta > 0 ? 'text-success bg-success/10' : 'text-error bg-error/10'
      )}
    >
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

function StatsGrid({
  stats,
  previousStats,
}: {
  stats: WeeklySummaryStats;
  previousStats?: WeeklySummaryStats | null;
}) {
  const items = [
    {
      label: 'Briefings',
      value: stats.briefingsGenerated,
      prevValue: previousStats?.briefingsGenerated,
      icon: CalendarDays,
      color: 'text-near-green-500',
    },
    {
      label: 'Meetings',
      value: stats.meetingsHeld,
      prevValue: previousStats?.meetingsHeld,
      icon: Users,
      color: 'text-near-cyan-500',
    },
    {
      label: 'Decisions',
      value: stats.decisionsMade,
      prevValue: previousStats?.decisionsMade,
      icon: GitBranch,
      color: 'text-near-purple-500',
    },
    {
      label: 'Intel Entries',
      value: stats.competitiveEntries,
      prevValue: previousStats?.competitiveEntries,
      icon: Crosshair,
      color: 'text-warning',
    },
    {
      label: 'Actions Done',
      value: stats.actionItemsCompleted,
      prevValue: previousStats?.actionItemsCompleted,
      displayValue: `${stats.actionItemsCompleted}/${stats.actionItemsCreated}`,
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: 'Pending',
      value: stats.actionItemsCreated - stats.actionItemsCompleted,
      prevValue: previousStats
        ? previousStats.actionItemsCreated - previousStats.actionItemsCompleted
        : undefined,
      icon: ListTodo,
      color: 'text-text-muted',
    },
    {
      label: 'Funding Tracked',
      value: stats.totalFundingTracked,
      prevValue: previousStats?.totalFundingTracked,
      displayValue: stats.totalFundingTracked > 0
        ? `$${(stats.totalFundingTracked / 1000).toFixed(0)}k`
        : '$0',
      icon: DollarSign,
      color: 'text-near-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="p-3 rounded-lg bg-surface/50 border border-border"
        >
          <div className="flex items-center gap-2">
            <item.icon className={cn('h-4 w-4', item.color)} />
            <span className="text-xs text-text-muted">{item.label}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-lg font-semibold text-text-primary">
              {item.displayValue ?? item.value.toString()}
            </p>
            {previousStats && item.prevValue !== undefined && (
              <StatDelta current={item.value} previous={item.prevValue} />
            )}
          </div>
          {/* Mini comparison bar */}
          {previousStats && item.prevValue !== undefined && item.prevValue > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-text-muted/30 transition-all"
                  style={{ width: `${Math.min(100, (item.prevValue / Math.max(item.value, item.prevValue)) * 100)}%` }}
                />
              </div>
              <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.value >= item.prevValue ? 'bg-near-green-500/60' : 'bg-error/40'
                  )}
                  style={{ width: `${Math.min(100, (item.value / Math.max(item.value, item.prevValue)) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-text-muted/60 shrink-0">prev/now</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TrendDirectionIcon({ direction }: { direction: TrendDirection }) {
  switch (direction) {
    case 'positive':
      return <TrendingUp className="h-4 w-4 text-success" />;
    case 'negative':
      return <TrendingDown className="h-4 w-4 text-error" />;
    case 'neutral':
    default:
      return <Minus className="h-4 w-4 text-text-muted" />;
  }
}

function TrendItem({ trend }: { trend: WeeklyTrend }) {
  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TrendDirectionIcon direction={trend.direction} />
          <span className="font-medium text-sm text-text-primary truncate">
            {trend.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={getTrendDirectionBadgeVariant(trend.direction)} className="text-xs">
            {trend.direction}
          </Badge>
          <span className="text-xs text-text-muted">{trend.confidence}%</span>
        </div>
      </div>
      <p className="text-xs text-text-muted">{trend.description}</p>
      <span className="text-xs text-text-muted/70">{trend.category}</span>
    </div>
  );
}

function GrantProgressItem({ progress }: { progress: WeeklyGrantProgress }) {
  const statusChanged = progress.previousStatus !== progress.currentStatus;

  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm text-text-primary">
          {progress.program}
        </span>
        <div className="flex items-center gap-1 text-xs shrink-0">
          <span className="text-text-muted">{progress.previousStatus}</span>
          <span className="text-text-muted">→</span>
          <span className={statusChanged ? 'text-near-green-500 font-medium' : 'text-text-muted'}>
            {progress.currentStatus}
          </span>
        </div>
      </div>
      {progress.progressDelta !== 0 && (
        <div className="text-xs">
          <span className={progress.progressDelta > 0 ? 'text-success' : 'text-error'}>
            {progress.progressDelta > 0 ? '+' : ''}{progress.progressDelta}% progress
          </span>
        </div>
      )}
      {progress.milestones.length > 0 && (
        <div className="space-y-1">
          {progress.milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {m}
            </div>
          ))}
        </div>
      )}
      {progress.blockers.length > 0 && (
        <div className="space-y-1">
          {progress.blockers.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-error">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationItem({ rec }: { rec: WeeklyRecommendation }) {
  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm text-text-primary">
          {rec.title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={getRecommendationPriorityBadgeVariant(rec.priority)}
            className="text-xs"
          >
            {rec.priority}
          </Badge>
          <Badge variant={getEffortBadgeVariant(rec.effort)} className="text-xs">
            {rec.effort}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-text-muted">{rec.description}</p>
      <span className="text-xs text-text-muted/70">{rec.category}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Weekly Synthesis main component.
 * Generates AI-powered weekly strategic reports from aggregated module data.
 */
export function WeeklySynthesis({ className }: WeeklySynthesisProps) {
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-clear success/error banners
  useEffect(() => {
    if (!importSuccess) return;
    const timer = setTimeout(() => setImportSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [importSuccess]);

  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(timer);
  }, [importError]);

  const {
    currentWeekBounds,
    selectedWeekStart,
    currentSynthesis,
    previousSynthesis,
    isGenerating,
    generationProgress,
    generationStage,
    error,
    isConnected,
    hasAnyData,
    generateSynthesis,
    navigateWeek,
    exportToMarkdown,
    exportData,
    importData,
    clearError,
  } = useSynthesis();

  const activeWeekStart = selectedWeekStart ?? currentWeekBounds.weekStart;

  /** Handles generate/regenerate with confirmation for existing syntheses */
  const handleGenerate = () => {
    if (currentSynthesis) {
      setShowRegenConfirm(true);
    } else {
      generateSynthesis();
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importData(file);
      const parts = [`Imported ${result.syntheses} new synthesis report(s).`];
      if (result.skipped > 0) {
        parts.push(`${result.skipped} invalid record(s) skipped.`);
      }
      setImportSuccess(parts.join(' '));
      setImportError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setImportError(message);
      setImportSuccess(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generation stage label
  const stageLabel = generationStage
    ? GENERATION_STAGE_LABELS[generationStage]
    : 'Generating weekly synthesis…';

  // Guard cascade
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  if (error && !currentSynthesis) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={clearError} />
      </Card>
    );
  }

  if (!hasAnyData && !currentSynthesis) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <EmptyState />
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
              Weekly Synthesis
            </h2>
            <p className="text-sm text-text-muted">
              AI-powered strategic reports aggregating your weekly intelligence
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={exportToMarkdown}
              className="h-8 w-8"
              title="Export as Markdown"
              disabled={!currentSynthesis}
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
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : currentSynthesis ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating
                ? 'Generating...'
                : currentSynthesis
                  ? 'Regenerate'
                  : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Week Selector */}
        <WeekSelector
          selectedWeekStart={activeWeekStart}
          currentWeekBounds={currentWeekBounds}
          hasSynthesis={!!currentSynthesis}
          onNavigate={navigateWeek}
        />

        {/* Import success banner */}
        {importSuccess && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-success/10 border border-success/20 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {importSuccess}
          </div>
        )}

        {importError && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-error/10 border border-error/20 text-xs text-error">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {importError}
          </div>
        )}

        {/* Error banner (non-blocking) */}
        {error && currentSynthesis && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-error/10 border border-error/20 text-xs text-error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
            <Button variant="ghost" size="sm" onClick={clearError} className="h-6 text-xs">
              Dismiss
            </Button>
          </div>
        )}

        {/* Progress bar during generation */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                {stageLabel}
              </div>
              <span className="text-[10px] text-text-muted/60 tabular-nums">
                {generationProgress}%
              </span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}

        {/* No synthesis for selected week */}
        {!currentSynthesis && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <BarChart3 className="h-10 w-10 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                No synthesis for this week
              </p>
              <p className="text-xs text-text-muted mt-1 max-w-sm">
                {hasAnyData
                  ? 'Your modules have data available. Click "Generate" to create a synthesis report analyzing your weekly briefings, meetings, decisions, and competitive intelligence.'
                  : 'Add data to your modules first, then generate a synthesis report.'}
              </p>
            </div>
            {hasAnyData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateSynthesis()}
                className="gap-1.5 mt-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Synthesis
              </Button>
            )}
          </div>
        )}

        {/* Full synthesis content */}
        {currentSynthesis && (
          <div className="space-y-3">
            {/* Stats Grid */}
            <StatsGrid
              stats={currentSynthesis.stats}
              previousStats={previousSynthesis?.stats}
            />

            {/* Executive Summary */}
            <BriefingSection
              title="Executive Summary"
              icon={Star}
              defaultOpen={true}
            >
              <p className="text-sm text-text-primary leading-relaxed">
                {currentSynthesis.executiveSummary}
              </p>
            </BriefingSection>

            {/* Strategic Analysis */}
            {currentSynthesis.strategicAnalysis && (
              <BriefingSection
                title="Strategic Analysis"
                icon={Target}
                defaultOpen={false}
              >
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                  {currentSynthesis.strategicAnalysis}
                </p>
              </BriefingSection>
            )}

            {/* Trends */}
            {currentSynthesis.trends.length > 0 && (
              <BriefingSection
                title="Trends"
                icon={TrendingUp}
                badge={currentSynthesis.trends.length}
                badgeVariant="secondary"
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {currentSynthesis.trends.map((trend, i) => (
                    <TrendItem key={i} trend={trend} />
                  ))}
                </div>
              </BriefingSection>
            )}

            {/* Grant Progress */}
            {currentSynthesis.grantProgress.length > 0 && (
              <BriefingSection
                title="Grant Progress"
                icon={DollarSign}
                badge={currentSynthesis.grantProgress.length}
                badgeVariant="success"
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {currentSynthesis.grantProgress.map((gp, i) => (
                    <GrantProgressItem key={i} progress={gp} />
                  ))}
                </div>
              </BriefingSection>
            )}

            {/* Key Highlights */}
            {currentSynthesis.highlights.length > 0 && (
              <BriefingSection
                title="Key Highlights"
                icon={Lightbulb}
                badge={currentSynthesis.highlights.length}
                badgeVariant="success"
                defaultOpen={false}
              >
                <ul className="space-y-2">
                  {currentSynthesis.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      {h}
                    </li>
                  ))}
                </ul>
              </BriefingSection>
            )}

            {/* Risks & Concerns */}
            {currentSynthesis.risks.length > 0 && (
              <BriefingSection
                title="Risks & Concerns"
                icon={AlertTriangle}
                badge={currentSynthesis.risks.length}
                badgeVariant="error"
                defaultOpen={false}
              >
                <ul className="space-y-2">
                  {currentSynthesis.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                      <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </BriefingSection>
            )}

            {/* Recommendations */}
            {currentSynthesis.recommendations.length > 0 && (
              <BriefingSection
                title="Next Week Recommendations"
                icon={Lightbulb}
                badge={currentSynthesis.recommendations.length}
                badgeVariant="warning"
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {currentSynthesis.recommendations.map((rec, i) => (
                    <RecommendationItem key={i} rec={rec} />
                  ))}
                </div>
              </BriefingSection>
            )}

            {/* Attestation */}
            {currentSynthesis.attestation && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-near-green-500/10 border border-near-green-500/20 text-xs text-near-green-500">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                This report was generated with TEE attestation verification
              </div>
            )}
          </div>
        )}
      </div>

      {/* Regeneration confirmation dialog */}
      <ConfirmDialog
        open={showRegenConfirm}
        onOpenChange={setShowRegenConfirm}
        title="Regenerate Synthesis?"
        description="This will replace the existing synthesis for this week with a newly generated report. The previous version cannot be recovered."
        confirmLabel="Regenerate"
        variant="destructive"
        onConfirm={() => generateSynthesis()}
      />
    </Card>
  );
}
