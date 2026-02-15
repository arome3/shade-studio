'use client';

import {
  Clock,
  Loader2,
  Pause,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { JOB_TYPE_LABELS, type AIJob } from '@/types/async-ai';
import type { BadgeProps } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { variant: BadgeProps['variant']; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  processing: { variant: 'default', label: 'Processing' },
  paused: { variant: 'warning', label: 'Paused' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  timeout: { variant: 'warning', label: 'Timed Out' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  processing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  paused: <Pause className="h-3.5 w-3.5" />,
  completed: <CheckCircle className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
  timeout: <Clock className="h-3.5 w-3.5" />,
};

const PROGRESS_INDICATOR_CLASS: Record<string, string> = {
  processing: 'bg-near-green-500',
  paused: 'bg-near-purple-500',
  completed: 'bg-success',
  failed: 'bg-error',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobProgressCardProps {
  job: AIJob;
  onCancel?: (jobId: string) => void;
  onViewResults?: (job: AIJob) => void;
  onTrack?: (jobId: string) => void;
}

export function JobProgressCard({
  job,
  onCancel,
  onViewResults,
  onTrack,
}: JobProgressCardProps) {
  const badgeInfo = STATUS_BADGE[job.status];
  const badgeVariant = badgeInfo?.variant ?? 'outline';
  const badgeLabel = badgeInfo?.label ?? 'Unknown';
  const icon = STATUS_ICON[job.status];
  const indicatorClass = PROGRESS_INDICATOR_CLASS[job.status] ?? 'bg-near-green-500';

  const isActive = job.status === 'pending' || job.status === 'processing' || job.status === 'paused';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const canCancel = job.status === 'pending';

  return (
    <Card className="transition-all hover:border-border-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm truncate">
              {JOB_TYPE_LABELS[job.type]}
            </CardTitle>
            <Badge variant={badgeVariant} className="shrink-0 gap-1">
              {icon}
              {badgeLabel}
            </Badge>
          </div>
          {canCancel && onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-text-muted hover:text-error"
              onClick={() => onCancel(job.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel job</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">
              {job.checkpoint?.step ?? (isActive ? 'Waiting...' : '')}
            </span>
            <span className="text-text-primary font-medium">
              {job.progress}%
            </span>
          </div>
          <Progress
            value={job.progress}
            indicatorClassName={indicatorClass}
          />
        </div>

        {/* Error message */}
        {isFailed && job.error && (
          <p className="text-xs text-error bg-error/10 rounded-md px-3 py-2">
            {job.error}
          </p>
        )}

        {/* Result preview */}
        {isCompleted && job.result && (
          <div className="text-xs text-text-muted bg-success/10 rounded-md px-3 py-2">
            <span className="text-success font-medium">Complete</span>
            {job.result.metadata && (
              <span className="ml-2">
                {Math.round(job.result.metadata.totalDuration / 1000)}s
                {' / '}
                {job.result.metadata.tokensUsed.toLocaleString()} tokens
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className={cn('justify-between text-xs text-text-muted', isCompleted && 'pt-0')}>
        <span>{formatElapsed(job.createdAt)} elapsed</span>
        <div className="flex gap-2">
          {isActive && onTrack && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onTrack(job.id)}
            >
              Track
            </Button>
          )}
          {isCompleted && onViewResults && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onViewResults(job)}
            >
              View Results
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
