'use client';

import {
  Globe,
  Twitter,
  Github,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  getThreatLevelColor,
  getThreatLevelBgColor,
  getThreatLevelLabel,
} from '@/lib/intelligence/competitive';
import { cn } from '@/lib/utils/cn';
import type { Competitor } from '@/types/intelligence';

export interface CompetitorCardProps {
  competitor: Competitor;
  entryCount: number;
  onAddEntry?: (competitorId: string) => void;
  onEdit?: (competitor: Competitor) => void;
  onRemove?: (id: string) => void;
}

/**
 * Displays a competitor with threat level, external links, categories, and actions.
 */
export function CompetitorCard({
  competitor,
  entryCount,
  onAddEntry,
  onEdit,
  onRemove,
}: CompetitorCardProps) {
  const threatColor = getThreatLevelColor(competitor.threatLevel);
  const threatBgColor = getThreatLevelBgColor(competitor.threatLevel);
  const threatLabel = getThreatLevelLabel(competitor.threatLevel);

  return (
    <div className="p-4 rounded-lg bg-surface/50 border border-border space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-text-primary truncate">
              {competitor.name}
            </h4>
            <Badge
              className={cn('text-[10px] shrink-0', threatColor, threatBgColor)}
            >
              {threatLabel}
            </Badge>
            {entryCount > 0 && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {competitor.description}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAddEntry && (
              <DropdownMenuItem onClick={() => onAddEntry(competitor.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(competitor)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {(onAddEntry || onEdit) && onRemove && <DropdownMenuSeparator />}
            {onRemove && (
              <DropdownMenuItem
                onClick={() => onRemove(competitor.id)}
                className="text-error focus:text-error"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* External Links */}
      {(competitor.website || competitor.twitter || competitor.github) && (
        <div className="flex items-center gap-3">
          {competitor.website && (
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-near-green-500 hover:text-near-green-400 transition-colors"
            >
              <Globe className="h-3 w-3" />
              Website
            </a>
          )}
          {competitor.twitter && (
            <a
              href={`https://x.com/${competitor.twitter.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-near-green-500 hover:text-near-green-400 transition-colors"
            >
              <Twitter className="h-3 w-3" />
              {competitor.twitter}
            </a>
          )}
          {competitor.github && (
            <a
              href={`https://github.com/${competitor.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-near-green-500 hover:text-near-green-400 transition-colors"
            >
              <Github className="h-3 w-3" />
              GitHub
            </a>
          )}
        </div>
      )}

      {/* Categories */}
      {competitor.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {competitor.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-[10px]">
              {category}
            </Badge>
          ))}
        </div>
      )}

      {/* Notes */}
      {competitor.notes && (
        <div className="p-2 rounded-md bg-surface/50 text-xs text-text-muted">
          {competitor.notes}
        </div>
      )}
    </div>
  );
}
