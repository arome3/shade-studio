'use client';

import { CheckCircle2, Circle, AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getActionPriorityBadgeVariant,
  getActionPriorityLabel,
} from '@/lib/intelligence/meetings';
import { cn } from '@/lib/utils/cn';
import type { PendingActionItem } from '@/hooks/use-meetings';

// ============================================================================
// Types
// ============================================================================

export interface ActionItemListProps {
  items: PendingActionItem[];
  onComplete: (meetingId: string, itemId: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

// ============================================================================
// Component
// ============================================================================

/**
 * Displays pending action items aggregated across all meetings.
 * Items are sorted by due date (earliest first) then by priority.
 */
export function ActionItemList({
  items,
  onComplete,
}: ActionItemListProps) {

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] space-y-3 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            All Caught Up!
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            No pending action items from your meetings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(({ meetingId, meetingTitle, item }) => (
        <div
          key={`${meetingId}-${item.id}`}
          className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 border border-border"
        >
          {/* Completion toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 mt-0.5 shrink-0"
            aria-label="Mark item as complete"
            onClick={() => onComplete(meetingId, item.id)}
          >
            <Circle className="h-4 w-4 text-text-muted" />
          </Button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary">{item.description}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge
                variant={getActionPriorityBadgeVariant(item.priority)}
                className="text-[10px]"
              >
                {getActionPriorityLabel(item.priority)}
              </Badge>
              {item.assignee && (
                <span className="text-xs text-text-muted">
                  @{item.assignee}
                </span>
              )}
              {item.dueDate && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    isOverdue(item.dueDate) ? 'text-error' : 'text-text-muted'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {item.dueDate}
                  {isOverdue(item.dueDate) && (
                    <AlertCircle className="h-3 w-3" />
                  )}
                </span>
              )}
              <span className="text-[10px] text-text-muted">
                from: {meetingTitle}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
