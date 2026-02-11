'use client';

import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getCategoryBadgeVariant,
  getOutcomeBadgeVariant,
  getOutcomeBgColor,
  getCategoryLabel,
  getOutcomeLabel,
} from '@/lib/intelligence/decisions';
import { cn } from '@/lib/utils/cn';
import type { Decision } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

export interface DecisionTimelineProps {
  decisions: Decision[];
  onSelect?: (decision: Decision) => void;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a date string (YYYY-MM-DD) to "Month Year".
 */
function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get a month-year key for grouping (YYYY-MM).
 */
function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * Format a date string for display (e.g., "Jan 15").
 */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Component
// ============================================================================

/**
 * Vertical timeline view of decisions grouped by month.
 */
export function DecisionTimeline({
  decisions,
  onSelect,
  className,
}: DecisionTimelineProps) {
  // Group decisions by month-year
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; decisions: Decision[] }>();

    // Decisions are already sorted by createdAt desc — re-sort by decisionDate for timeline
    const sorted = [...decisions].sort(
      (a, b) => b.decisionDate.localeCompare(a.decisionDate)
    );

    for (const decision of sorted) {
      const key = getMonthKey(decision.decisionDate);
      if (!map.has(key)) {
        map.set(key, {
          label: formatMonthYear(decision.decisionDate),
          decisions: [],
        });
      }
      map.get(key)!.decisions.push(decision);
    }

    return Array.from(map.entries());
  }, [decisions]);

  if (decisions.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <CalendarDays className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-muted">
          No decisions to display in the timeline.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groups.map(([key, group]) => (
        <div key={key}>
          {/* Month header */}
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            {group.label}
          </h3>

          {/* Timeline nodes */}
          <div className="relative ml-3">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {group.decisions.map((decision) => {
                const dotColor = getOutcomeBgColor(decision.outcome);

                return (
                  <div
                    key={decision.id}
                    className="relative pl-6 group"
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute left-0 top-2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 border-background',
                        dotColor
                      )}
                    />

                    {/* Card */}
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left p-2.5 rounded-lg border border-border bg-surface/50',
                        'hover:bg-surface-hover transition-colors',
                        onSelect && 'cursor-pointer'
                      )}
                      onClick={() => onSelect?.(decision)}
                      disabled={!onSelect}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary truncate flex-1">
                          {decision.title}
                        </span>
                        <Badge
                          variant={getCategoryBadgeVariant(decision.category)}
                          className="text-[10px] shrink-0"
                        >
                          {getCategoryLabel(decision.category)}
                        </Badge>
                        <Badge
                          variant={getOutcomeBadgeVariant(decision.outcome)}
                          className="text-[10px] shrink-0"
                        >
                          {getOutcomeLabel(decision.outcome)}
                        </Badge>
                      </div>
                      {decision.description && (
                        <p className="text-xs text-text-muted line-clamp-2 mb-1">
                          {decision.description}
                        </p>
                      )}
                      <span className="text-[10px] text-text-muted">
                        {formatShortDate(decision.decisionDate)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
