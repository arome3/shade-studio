'use client';

import { Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';

export interface BriefingSkeletonProps {
  /** Generation progress (0-100) */
  progress?: number;
  /** Custom message to display */
  message?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Loading skeleton for briefing generation.
 * Shows animated icon and progress bar.
 *
 * @example
 * ```tsx
 * {isLoading ? (
 *   <BriefingSkeleton progress={progress} />
 * ) : (
 *   <BriefingContent briefing={briefing} />
 * )}
 * ```
 */
export function BriefingSkeleton({
  progress = 0,
  message = 'Generating Your Daily Briefing',
  className,
}: BriefingSkeletonProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] space-y-6 p-8',
        className
      )}
    >
      {/* Animated icon */}
      <div className="relative">
        <div className="absolute inset-0 animate-ping">
          <Sparkles className="h-12 w-12 text-near-green-500/30" />
        </div>
        <Sparkles className="h-12 w-12 text-near-green-500 animate-pulse" />
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-text-primary">{message}</h3>
        <p className="text-sm text-text-muted">
          Analyzing your projects and documents with TEE privacy...
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-text-muted text-center">
          {progress > 0 ? `${Math.round(progress)}% complete` : 'Starting...'}
        </p>
      </div>

      {/* Skeleton content blocks */}
      <div className="w-full max-w-md space-y-3 mt-4">
        <div className="h-4 bg-surface rounded animate-pulse" />
        <div className="h-4 bg-surface rounded animate-pulse w-3/4" />
        <div className="h-4 bg-surface rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

/**
 * Inline skeleton for refreshing existing briefing.
 */
export function BriefingRefreshIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-text-muted',
        className
      )}
    >
      <Sparkles className="h-4 w-4 animate-spin" />
      <span>Refreshing briefing...</span>
    </div>
  );
}
