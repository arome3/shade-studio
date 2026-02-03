'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  Target,
  Calendar,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AttestationBadge } from '@/components/features/ai/attestation-badge';
import { BriefingSection } from './briefing-section';
import { BriefingSkeleton } from './briefing-skeleton';
import { PriorityItems } from './priority-items';
import { DeadlineTracker } from './deadline-tracker';
import { BriefingHistory } from './briefing-history';
import { useBriefing } from '@/hooks/use-briefing';
import { getStatusColor } from '@/lib/intelligence/briefing';
import { cn } from '@/lib/utils/cn';
import type { GrantPipelineItem, Recommendation } from '@/types/intelligence';

export interface DailyBriefingProps {
  /** Project ID to scope the briefing */
  projectId?: string;
  /** Whether to auto-generate on mount if stale */
  autoGenerate?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Get sentiment icon and color.
 */
function getSentimentInfo(sentiment?: 'bullish' | 'neutral' | 'bearish') {
  switch (sentiment) {
    case 'bullish':
      return { icon: TrendingUp, color: 'text-success', label: 'Bullish' };
    case 'bearish':
      return { icon: TrendingDown, color: 'text-error', label: 'Bearish' };
    case 'neutral':
    default:
      return { icon: Minus, color: 'text-text-muted', label: 'Neutral' };
  }
}

/**
 * Grant pipeline card.
 */
function PipelineCard({ item }: { item: GrantPipelineItem }) {
  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm truncate">{item.program}</span>
        <Badge
          variant="secondary"
          className={cn('text-[10px] shrink-0', getStatusColor(item.status))}
        >
          {item.status}
        </Badge>
      </div>

      <Progress
        value={item.progress}
        className="h-1.5"
        indicatorClassName={
          item.progress >= 100
            ? 'bg-success'
            : item.progress >= 50
            ? 'bg-near-green-500'
            : 'bg-near-purple-500'
        }
      />

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{item.progress}% complete</span>
        {item.deadline && (
          <span>{format(new Date(item.deadline), 'MMM d')}</span>
        )}
      </div>

      {item.nextAction && (
        <p className="text-xs text-text-secondary">
          Next: {item.nextAction}
        </p>
      )}
    </div>
  );
}

/**
 * Recommendation card.
 */
function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm">{recommendation.title}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant={recommendation.impact === 'high' ? 'success' : 'secondary'}
            className="text-[10px]"
          >
            {recommendation.impact} impact
          </Badge>
        </div>
      </div>

      <p className="text-xs text-text-muted">{recommendation.description}</p>

      {recommendation.rationale && (
        <p className="text-xs text-text-secondary italic">
          {recommendation.rationale}
        </p>
      )}

      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span>Effort: {recommendation.effort}</span>
      </div>
    </div>
  );
}

/**
 * Wallet connection prompt.
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
          Connect your NEAR wallet to generate personalized daily briefings
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
          Generation Failed
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
 * Daily briefing container component.
 * Main interface for viewing and interacting with daily intelligence briefings.
 *
 * @example
 * ```tsx
 * // Basic usage with auto-generation
 * <DailyBriefing autoGenerate />
 *
 * // Scoped to a specific project
 * <DailyBriefing projectId="proj_123" />
 * ```
 */
export function DailyBriefing({
  projectId,
  autoGenerate = true,
  className,
}: DailyBriefingProps) {
  const {
    briefing,
    isLoading,
    error,
    progress,
    needsRefresh,
    isConnected,
    isReady,
    generateBriefing,
    refreshBriefing,
    updateItemStatus,
    markItemRead,
    dismissItem,
    briefingHistory,
  } = useBriefing(projectId);

  // Auto-generate if needed
  useEffect(() => {
    if (autoGenerate && isReady && needsRefresh && !isLoading) {
      generateBriefing();
    }
  }, [autoGenerate, isReady, needsRefresh, isLoading, generateBriefing]);

  // Not connected
  if (!isConnected) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <WalletPrompt />
      </Card>
    );
  }

  // Loading state
  if (isLoading && !briefing) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <BriefingSkeleton progress={progress} />
      </Card>
    );
  }

  // Error state (only if no briefing to show)
  if (error && !briefing) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <ErrorState error={error} onRetry={refreshBriefing} />
      </Card>
    );
  }

  // No briefing yet
  if (!briefing) {
    return (
      <Card className={cn('overflow-hidden p-8 text-center', className)}>
        <Sparkles className="h-12 w-12 text-near-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
        <p className="text-sm text-text-muted mb-4">
          Click below to generate your personalized daily briefing
        </p>
        <Button onClick={() => generateBriefing()} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Briefing
        </Button>
      </Card>
    );
  }

  const sentimentInfo = getSentimentInfo(briefing.sentiment);
  const SentimentIcon = sentimentInfo.icon;
  const pendingItems = briefing.items.filter(
    (i) => !i.isDismissed && (!i.status || i.status === 'pending')
  );
  const itemsWithDeadlines = briefing.items.filter((i) => i.dueDate);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-text-muted uppercase tracking-wider">
              {format(new Date(briefing.date), 'EEEE, MMMM d, yyyy')}
            </p>
            <h2 className="text-xl font-semibold text-text-primary">
              Daily Intelligence Briefing
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Attestation badge */}
            {briefing.attestation && (
              <AttestationBadge
                attestation={briefing.attestation}
                useEnhancedView
              />
            )}

            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshBriefing}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </Button>
          </div>
        </div>

        {/* Greeting and summary */}
        <div className="mt-4 space-y-2">
          <p className="text-text-primary">{briefing.greeting}</p>
          <p className="text-sm text-text-secondary">{briefing.summary}</p>
        </div>

        {/* Sentiment indicator */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <SentimentIcon className={cn('h-4 w-4', sentimentInfo.color)} />
            <span className="text-xs text-text-muted">{sentimentInfo.label}</span>
          </div>

          {/* Quick metrics */}
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>{briefing.metrics.activeProjects} projects</span>
            <span>{briefing.metrics.upcomingDeadlines} deadlines</span>
            <span>{briefing.metrics.actionRequired} actions</span>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="p-4 space-y-4">
        {/* Priority Actions */}
        <BriefingSection
          title="Priority Actions"
          icon={AlertCircle}
          badge={pendingItems.length}
          badgeVariant={pendingItems.length > 0 ? 'warning' : 'secondary'}
        >
          <PriorityItems
            items={briefing.items}
            onStatusChange={updateItemStatus}
            onMarkRead={markItemRead}
            onDismiss={dismissItem}
          />
        </BriefingSection>

        {/* Grant Pipeline */}
        {briefing.grantPipeline && briefing.grantPipeline.length > 0 && (
          <BriefingSection
            title="Grant Pipeline"
            icon={Target}
            badge={briefing.grantPipeline.length}
          >
            <div className="space-y-2">
              {briefing.grantPipeline.map((item, index) => (
                <PipelineCard key={index} item={item} />
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Upcoming Deadlines */}
        {(itemsWithDeadlines.length > 0 ||
          (briefing.grantPipeline && briefing.grantPipeline.some((p) => p.deadline))) && (
          <BriefingSection
            title="Upcoming Deadlines"
            icon={Calendar}
            badge={itemsWithDeadlines.length + (briefing.grantPipeline?.filter((p) => p.deadline).length || 0)}
          >
            <DeadlineTracker
              items={itemsWithDeadlines}
              pipeline={briefing.grantPipeline}
            />
          </BriefingSection>
        )}

        {/* Strategic Recommendations */}
        {briefing.recommendations && briefing.recommendations.length > 0 && (
          <BriefingSection
            title="Strategic Recommendations"
            icon={Lightbulb}
            badge={briefing.recommendations.length}
            defaultOpen={false}
          >
            <div className="space-y-2">
              {briefing.recommendations.map((rec, index) => (
                <RecommendationCard key={index} recommendation={rec} />
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Briefing History */}
        {briefingHistory.length > 1 && (
          <BriefingSection
            title="Past Briefings"
            icon={History}
            badge={briefingHistory.length}
            defaultOpen={false}
          >
            <BriefingHistory
              briefings={briefingHistory}
              selectedDate={briefing.date}
              onSelect={(b) => {
                // Could navigate to historical view or update current
                console.log('Selected briefing:', b.date);
              }}
            />
          </BriefingSection>
        )}
      </div>

      {/* Loading overlay for refresh */}
      {isLoading && briefing && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>Refreshing briefing...</span>
          </div>
        </div>
      )}
    </Card>
  );
}
