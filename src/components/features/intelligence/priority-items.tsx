'use client';

import {
  Check,
  Circle,
  MoreHorizontal,
  Pause,
  Play,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getPriorityBgColor,
  getItemStatusColor,
} from '@/lib/intelligence/briefing';
import { cn } from '@/lib/utils/cn';
import type { BriefingItem, ItemStatus, BriefingPriority } from '@/types/intelligence';

export interface PriorityItemsProps {
  /** List of briefing items */
  items: BriefingItem[];
  /** Callback when item status changes */
  onStatusChange?: (itemId: string, status: ItemStatus) => void;
  /** Callback when item is marked as read */
  onMarkRead?: (itemId: string) => void;
  /** Callback when item is dismissed */
  onDismiss?: (itemId: string) => void;
  /** Whether to show dismissed items */
  showDismissed?: boolean;
  /** Additional class names */
  className?: string;
}

/** Status options for the dropdown */
const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string; icon: typeof Circle }> = [
  { value: 'pending', label: 'Pending', icon: Circle },
  { value: 'in_progress', label: 'In Progress', icon: Play },
  { value: 'completed', label: 'Completed', icon: Check },
  { value: 'deferred', label: 'Deferred', icon: Pause },
];

/**
 * Get icon for item status.
 */
function getStatusIcon(status?: ItemStatus) {
  switch (status) {
    case 'completed':
      return Check;
    case 'in_progress':
      return Play;
    case 'deferred':
      return Pause;
    case 'pending':
    default:
      return Circle;
  }
}

/**
 * Format due date with urgency indicator.
 */
function formatDueDate(dueDate?: string): { text: string; isUrgent: boolean } | null {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Overdue', isUrgent: true };
  } else if (diffDays === 0) {
    return { text: 'Today', isUrgent: true };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isUrgent: true };
  } else if (diffDays <= 7) {
    return { text: `${diffDays} days`, isUrgent: diffDays <= 3 };
  } else {
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isUrgent: false };
  }
}

/**
 * Get badge variant for priority.
 */
function getPriorityBadgeVariant(priority: BriefingPriority): 'default' | 'secondary' | 'success' | 'warning' | 'error' {
  switch (priority) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Single priority item row.
 */
function PriorityItemRow({
  item,
  onStatusChange,
  onDismiss,
}: {
  item: BriefingItem;
  onStatusChange?: (itemId: string, status: ItemStatus) => void;
  onDismiss?: (itemId: string) => void;
}) {
  const StatusIcon = getStatusIcon(item.status);
  const dueInfo = formatDueDate(item.dueDate);
  const isCompleted = item.status === 'completed';

  const handleStatusClick = () => {
    if (!onStatusChange) return;

    // Cycle through: pending -> in_progress -> completed -> pending
    const nextStatus: ItemStatus =
      item.status === 'pending'
        ? 'in_progress'
        : item.status === 'in_progress'
        ? 'completed'
        : 'pending';

    onStatusChange(item.id, nextStatus);
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-colors',
        getPriorityBgColor(item.priority),
        isCompleted && 'opacity-60'
      )}
    >
      {/* Status toggle */}
      <button
        onClick={handleStatusClick}
        className={cn(
          'mt-0.5 p-1 rounded-full transition-colors hover:bg-surface',
          getItemStatusColor(item.status)
        )}
        aria-label={`Status: ${item.status || 'pending'}`}
      >
        <StatusIcon className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              'font-medium text-sm text-text-primary',
              isCompleted && 'line-through'
            )}
          >
            {item.title}
          </h4>
          <Badge
            variant={getPriorityBadgeVariant(item.priority)}
            className="text-[10px] shrink-0"
          >
            {item.priority}
          </Badge>
        </div>

        <p className="text-xs text-text-muted mt-1 line-clamp-2">
          {item.description}
        </p>

        {/* Due date and actions */}
        <div className="flex items-center justify-between mt-2">
          {dueInfo && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                dueInfo.isUrgent ? 'text-error' : 'text-text-muted'
              )}
            >
              {dueInfo.isUrgent ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Calendar className="h-3 w-3" />
              )}
              <span>{dueInfo.text}</span>
            </div>
          )}

          {/* Actions menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-text-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              <div className="space-y-1">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onStatusChange?.(item.id, option.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-surface transition-colors',
                      item.status === option.value && 'bg-surface'
                    )}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
                <hr className="my-1 border-border" />
                <button
                  onClick={() => onDismiss?.(item.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-surface transition-colors text-text-muted"
                >
                  Dismiss
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/**
 * Priority items list component.
 * Displays actionable items sorted by priority with status toggles.
 *
 * @example
 * ```tsx
 * <PriorityItems
 *   items={briefing.items}
 *   onStatusChange={updateItemStatus}
 *   onDismiss={dismissItem}
 * />
 * ```
 */
export function PriorityItems({
  items,
  onStatusChange,
  onMarkRead: _onMarkRead,
  onDismiss,
  showDismissed = false,
  className,
}: PriorityItemsProps) {
  // Note: onMarkRead is available via props but not currently used
  // Items are marked read when status changes via onStatusChange
  void _onMarkRead;
  // Filter and sort items
  const visibleItems = items
    .filter((item) => showDismissed || !item.isDismissed)
    .sort((a, b) => {
      // Sort by: completed last, then by priority
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;

      const priorityOrder: Record<BriefingPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  if (visibleItems.length === 0) {
    return (
      <div className={cn('text-center py-8 text-text-muted', className)}>
        <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No priority items for today</p>
        <p className="text-xs mt-1">You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {visibleItems.map((item) => (
        <PriorityItemRow
          key={item.id}
          item={item}
          onStatusChange={onStatusChange}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
