'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  List,
  Grid,
  Clock,
} from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { DailyBriefing } from '@/types/intelligence';

export interface BriefingHistoryProps {
  /** Historical briefings */
  briefings: DailyBriefing[];
  /** Currently selected briefing */
  selectedDate?: string;
  /** Callback when briefing is selected */
  onSelect?: (briefing: DailyBriefing) => void;
  /** Additional class names */
  className?: string;
}

type ViewMode = 'calendar' | 'list';

/**
 * Get sentiment emoji.
 */
function getSentimentEmoji(sentiment?: 'bullish' | 'neutral' | 'bearish'): string {
  switch (sentiment) {
    case 'bullish':
      return '📈';
    case 'bearish':
      return '📉';
    case 'neutral':
    default:
      return '➡️';
  }
}

/**
 * Calendar view of briefings.
 */
function CalendarView({
  briefings,
  selectedDate,
  currentMonth,
  onSelect,
  onMonthChange,
}: {
  briefings: DailyBriefing[];
  selectedDate?: string;
  currentMonth: Date;
  onSelect?: (briefing: DailyBriefing) => void;
  onMonthChange: (date: Date) => void;
}) {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startDay = getDay(start);

  // Create a map of date -> briefing for quick lookup
  const briefingMap = new Map(
    briefings.map((b) => [b.date, b])
  );

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-xs text-text-muted py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before start of month */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const briefing = briefingMap.get(dateStr);
          const isSelected = selectedDate === dateStr;
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={dateStr}
              onClick={() => briefing && onSelect?.(briefing)}
              disabled={!briefing}
              className={cn(
                'aspect-square rounded-md flex flex-col items-center justify-center text-sm transition-colors relative',
                briefing
                  ? 'hover:bg-surface cursor-pointer'
                  : 'text-text-muted/50 cursor-default',
                isSelected && 'bg-near-green-500/20 ring-1 ring-near-green-500',
                isToday && !isSelected && 'ring-1 ring-border'
              )}
            >
              <span className={cn(isToday && 'font-bold')}>{format(day, 'd')}</span>
              {briefing && (
                <span className="text-[10px]">
                  {getSentimentEmoji(briefing.sentiment)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * List view of briefings.
 */
function ListView({
  briefings,
  selectedDate,
  onSelect,
}: {
  briefings: DailyBriefing[];
  selectedDate?: string;
  onSelect?: (briefing: DailyBriefing) => void;
}) {
  if (briefings.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No briefing history</p>
        <p className="text-xs mt-1">Your daily briefings will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {briefings.map((briefing) => {
        const isSelected = selectedDate === briefing.date;
        const actionCount = briefing.items.filter((i) => !i.isDismissed).length;

        return (
          <button
            key={briefing.id}
            onClick={() => onSelect?.(briefing)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-colors',
              isSelected
                ? 'bg-near-green-500/10 border-near-green-500/30'
                : 'bg-surface/50 border-border hover:bg-surface'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {format(parseISO(briefing.date), 'EEEE, MMM d')}
                </span>
                <span>{getSentimentEmoji(briefing.sentiment)}</span>
              </div>
              {actionCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {actionCount} items
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-muted line-clamp-2">
              {briefing.summary}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Briefing history browser.
 * Allows viewing past briefings in calendar or list format.
 *
 * @example
 * ```tsx
 * <BriefingHistory
 *   briefings={briefingHistory}
 *   selectedDate={currentBriefing?.date}
 *   onSelect={handleSelectBriefing}
 * />
 * ```
 */
export function BriefingHistory({
  briefings,
  selectedDate,
  onSelect,
  className,
}: BriefingHistoryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Sort briefings by date (newest first)
  const sortedBriefings = [...briefings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">
          {briefings.length} briefing{briefings.length !== 1 ? 's' : ''} saved
        </span>
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode('calendar')}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View content */}
      {viewMode === 'calendar' ? (
        <CalendarView
          briefings={sortedBriefings}
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          onSelect={onSelect}
          onMonthChange={setCurrentMonth}
        />
      ) : (
        <ListView
          briefings={sortedBriefings}
          selectedDate={selectedDate}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
