'use client';

import { useMemo } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { getStatusColor } from '@/lib/intelligence/briefing';
import type { BriefingItem, GrantPipelineItem } from '@/types/intelligence';

export interface DeadlineTrackerProps {
  /** Briefing items with deadlines */
  items?: BriefingItem[];
  /** Grant pipeline items */
  pipeline?: GrantPipelineItem[];
  /** Callback when deadline is clicked */
  onDeadlineClick?: (item: BriefingItem | GrantPipelineItem) => void;
  /** Additional class names */
  className?: string;
}

/** Deadline group for display */
interface DeadlineGroup {
  label: string;
  items: Array<{
    id: string;
    title: string;
    date?: string;
    daysUntil: number;
    progress?: number;
    status?: string;
    type: 'deadline' | 'pipeline';
    original: BriefingItem | GrantPipelineItem;
  }>;
  urgency: 'critical' | 'warning' | 'normal';
}

/**
 * Get urgency level from days until deadline.
 */
function getUrgencyFromDays(days: number): 'critical' | 'warning' | 'normal' {
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'normal';
}

/**
 * Get urgency color classes.
 */
function getUrgencyColor(urgency: 'critical' | 'warning' | 'normal'): string {
  switch (urgency) {
    case 'critical':
      return 'text-error border-error/20 bg-error/5';
    case 'warning':
      return 'text-warning border-warning/20 bg-warning/5';
    case 'normal':
      return 'text-text-secondary border-border bg-surface/50';
  }
}

/**
 * Format date for display.
 */
function formatDeadlineDate(date: string): string {
  const parsed = parseISO(date);

  if (isToday(parsed)) return 'Today';
  if (isTomorrow(parsed)) return 'Tomorrow';

  return format(parsed, 'MMM d');
}

/**
 * Single deadline item row.
 */
function DeadlineRow({
  item,
  onClick,
}: {
  item: DeadlineGroup['items'][0];
  onClick?: () => void;
}) {
  const urgency = getUrgencyFromDays(item.daysUntil);
  const isPast = item.daysUntil < 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full p-3 rounded-lg border transition-colors hover:bg-surface/80',
        getUrgencyColor(urgency)
      )}
    >
      {/* Icon */}
      <div className="shrink-0">
        {isPast ? (
          <AlertTriangle className="h-5 w-5 text-error" />
        ) : item.type === 'pipeline' ? (
          <div className="relative">
            <Calendar className="h-5 w-5" />
            {item.progress !== undefined && item.progress >= 100 && (
              <CheckCircle2 className="h-3 w-3 absolute -bottom-1 -right-1 text-success" />
            )}
          </div>
        ) : (
          <Clock className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.title}</span>
          {item.status && (
            <Badge
              variant="secondary"
              className={cn('text-[10px]', getStatusColor(item.status as any))}
            >
              {item.status}
            </Badge>
          )}
        </div>

        {/* Progress bar for pipeline items */}
        {item.progress !== undefined && (
          <div className="mt-1.5">
            <Progress
              value={item.progress}
              className="h-1.5"
              indicatorClassName={
                item.progress >= 100
                  ? 'bg-success'
                  : item.progress >= 50
                  ? 'bg-near-green-500'
                  : 'bg-warning'
              }
            />
          </div>
        )}
      </div>

      {/* Date/countdown */}
      <div className="shrink-0 text-right">
        {item.date && (
          <span className="text-xs font-medium">
            {formatDeadlineDate(item.date)}
          </span>
        )}
        <div
          className={cn(
            'text-[10px]',
            isPast ? 'text-error' : urgency === 'critical' ? 'text-error' : 'text-text-muted'
          )}
        >
          {isPast
            ? `${Math.abs(item.daysUntil)}d overdue`
            : item.daysUntil === 0
            ? 'Due today'
            : `${item.daysUntil}d left`}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
    </button>
  );
}

/**
 * Deadline group section.
 */
function DeadlineGroupSection({
  group,
  onClick,
}: {
  group: DeadlineGroup;
  onClick?: (item: BriefingItem | GrantPipelineItem) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            group.urgency === 'critical'
              ? 'text-error'
              : group.urgency === 'warning'
              ? 'text-warning'
              : 'text-text-muted'
          )}
        >
          {group.label}
        </span>
        <Badge
          variant={
            group.urgency === 'critical'
              ? 'error'
              : group.urgency === 'warning'
              ? 'warning'
              : 'secondary'
          }
          className="text-[10px]"
        >
          {group.items.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {group.items.map((item) => (
          <DeadlineRow
            key={item.id}
            item={item}
            onClick={() => onClick?.(item.original)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Deadline tracker component.
 * Groups deadlines by time period (today, this week, this month).
 *
 * @example
 * ```tsx
 * <DeadlineTracker
 *   items={briefing.items.filter(i => i.dueDate)}
 *   pipeline={briefing.grantPipeline}
 *   onDeadlineClick={handleDeadlineClick}
 * />
 * ```
 */
export function DeadlineTracker({
  items = [],
  pipeline = [],
  onDeadlineClick,
  className,
}: DeadlineTrackerProps) {
  // Combine and group deadlines
  const groups = useMemo(() => {
    const allDeadlines: DeadlineGroup['items'] = [];

    // Add briefing items with deadlines
    items
      .filter((item) => item.dueDate && !item.isDismissed)
      .forEach((item) => {
        const daysUntil = differenceInDays(parseISO(item.dueDate!), new Date());
        allDeadlines.push({
          id: item.id,
          title: item.title,
          date: item.dueDate,
          daysUntil,
          type: 'deadline',
          original: item,
        });
      });

    // Add pipeline items with deadlines
    pipeline
      .filter((item) => item.deadline)
      .forEach((item, index) => {
        const daysUntil = differenceInDays(parseISO(item.deadline!), new Date());
        allDeadlines.push({
          id: `pipeline-${index}`,
          title: item.program,
          date: item.deadline,
          daysUntil,
          progress: item.progress,
          status: item.status,
          type: 'pipeline',
          original: item,
        });
      });

    // Sort by days until
    allDeadlines.sort((a, b) => a.daysUntil - b.daysUntil);

    // Group by time period
    const grouped: DeadlineGroup[] = [];

    // Overdue
    const overdue = allDeadlines.filter((d) => d.daysUntil < 0);
    if (overdue.length > 0) {
      grouped.push({ label: 'Overdue', items: overdue, urgency: 'critical' });
    }

    // Today
    const today = allDeadlines.filter((d) => d.daysUntil === 0);
    if (today.length > 0) {
      grouped.push({ label: 'Today', items: today, urgency: 'critical' });
    }

    // Tomorrow
    const tomorrow = allDeadlines.filter((d) => d.daysUntil === 1);
    if (tomorrow.length > 0) {
      grouped.push({ label: 'Tomorrow', items: tomorrow, urgency: 'critical' });
    }

    // This week (2-7 days)
    const thisWeek = allDeadlines.filter((d) => d.daysUntil >= 2 && d.daysUntil <= 7);
    if (thisWeek.length > 0) {
      grouped.push({ label: 'This Week', items: thisWeek, urgency: 'warning' });
    }

    // This month (8-30 days)
    const thisMonth = allDeadlines.filter((d) => d.daysUntil > 7 && d.daysUntil <= 30);
    if (thisMonth.length > 0) {
      grouped.push({ label: 'This Month', items: thisMonth, urgency: 'normal' });
    }

    // Later (30+ days)
    const later = allDeadlines.filter((d) => d.daysUntil > 30);
    if (later.length > 0) {
      grouped.push({ label: 'Later', items: later, urgency: 'normal' });
    }

    return grouped;
  }, [items, pipeline]);

  if (groups.length === 0) {
    return (
      <div className={cn('text-center py-8 text-text-muted', className)}>
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No upcoming deadlines</p>
        <p className="text-xs mt-1">Add deadlines to track them here</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {groups.map((group) => (
        <DeadlineGroupSection
          key={group.label}
          group={group}
          onClick={onDeadlineClick}
        />
      ))}
    </div>
  );
}
