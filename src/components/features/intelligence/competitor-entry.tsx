'use client';

import { format } from 'date-fns';
import {
  DollarSign,
  Rocket,
  Handshake,
  Newspaper,
  Award,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getEntryTypeBadgeVariant,
} from '@/lib/intelligence/competitive';
import { cn } from '@/lib/utils/cn';
import type { CompetitiveEntry as CompetitiveEntryType } from '@/types/intelligence';

export interface CompetitorEntryProps {
  entry: CompetitiveEntryType;
  competitorName: string;
  onRemove?: (id: string) => void;
}

const entryTypeIcons = {
  funding: DollarSign,
  launch: Rocket,
  partnership: Handshake,
  news: Newspaper,
  grant: Award,
} as const;

/**
 * Displays an individual competitive entry with type badge, insight, and actions.
 */
export function CompetitorEntry({
  entry,
  competitorName,
  onRemove,
}: CompetitorEntryProps) {
  const Icon = entryTypeIcons[entry.type] ?? Newspaper;
  const badgeVariant = getEntryTypeBadgeVariant(entry.type);

  return (
    <div className="p-3 rounded-lg bg-surface/50 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="font-medium text-sm truncate">{entry.title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={badgeVariant} className="text-[10px]">
            {entry.type}
          </Badge>
          {entry.relevance >= 70 && (
            <Badge variant="warning" className="text-[10px]">
              High Relevance
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>{competitorName}</span>
        <span>&middot;</span>
        <span>{format(new Date(entry.date), 'MMM d, yyyy')}</span>
      </div>

      <p className="text-xs text-text-secondary">{entry.description}</p>

      {entry.insight && (
        <p className="text-xs text-text-secondary italic">
          {entry.insight}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {entry.sourceUrl && (
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 text-xs text-near-green-500 hover:text-near-green-400 transition-colors'
              )}
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          )}
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(entry.id)}
            className="h-7 w-7 p-0 text-text-muted hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
