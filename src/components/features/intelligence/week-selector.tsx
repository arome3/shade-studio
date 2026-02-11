'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { format, parseISO } from 'date-fns';
import { getWeekBounds, type WeekBounds } from '@/lib/intelligence/synthesis';

export interface WeekSelectorProps {
  /** Currently selected week start date */
  selectedWeekStart: string;
  /** Current week bounds (for disabling forward navigation) */
  currentWeekBounds: WeekBounds;
  /** Whether a synthesis exists for the selected week */
  hasSynthesis: boolean;
  /** Callback when a week is selected via navigation */
  onNavigate: (direction: 'prev' | 'next') => void;
  /** Additional class names */
  className?: string;
}

/**
 * Compact week navigation control.
 * Shows the selected week range with prev/next navigation and a green dot
 * indicating whether a synthesis exists for that week.
 */
export function WeekSelector({
  selectedWeekStart,
  currentWeekBounds,
  hasSynthesis,
  onNavigate,
  className,
}: WeekSelectorProps) {
  const bounds = getWeekBounds(parseISO(selectedWeekStart));
  const weekStart = parseISO(bounds.weekStart);
  const weekEnd = parseISO(bounds.weekEnd);

  const isCurrentWeek = selectedWeekStart === currentWeekBounds.weekStart;

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-surface/50 border border-border rounded-lg px-2 py-1.5',
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onNavigate('prev')}
        title="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 px-2 min-w-0">
        <span className="text-sm font-medium text-text-primary whitespace-nowrap">
          Week of {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </span>
        {hasSynthesis && (
          <span
            className="h-2 w-2 rounded-full bg-near-green-500 shrink-0"
            title="Synthesis available"
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onNavigate('next')}
        disabled={isCurrentWeek}
        title="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
