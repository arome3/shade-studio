'use client';

import { Calendar, ExternalLink, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BadgeProps } from '@/components/ui/badge';
import {
  PROGRAM_STATUS_DISPLAY,
  CATEGORY_LABELS,
  CHAIN_LABELS,
  formatFunding,
  type GrantProgram,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgramCardProps {
  program: GrantProgram;
  onViewDetails?: (programId: string) => void;
  onApply?: (programId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgramCard({ program, onViewDetails, onApply }: ProgramCardProps) {
  const statusDisplay = PROGRAM_STATUS_DISPLAY[program.status];

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {program.name}
          </h3>
          <p className="text-xs text-text-muted truncate">
            {program.organization}
          </p>
        </div>
        <Badge
          variant={statusDisplay.variant as BadgeProps['variant']}
          className="text-[10px] shrink-0"
        >
          {statusDisplay.label}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-text-muted line-clamp-2">
        {program.description}
      </p>

      {/* Funding + Deadline */}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="font-medium text-text-primary">
          {formatFunding(program.fundingPool)}
        </span>
        {program.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(program.deadline).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {program.applicationCount} apps
        </span>
      </div>

      {/* Chain + Category badges */}
      <div className="flex flex-wrap gap-1">
        {program.chains.map((chain) => (
          <Badge key={chain} variant="outline" className="text-[10px]">
            {CHAIN_LABELS[chain] ?? chain}
          </Badge>
        ))}
        {program.categories.map((cat) => (
          <Badge key={cat} variant="secondary" className="text-[10px]">
            {CATEGORY_LABELS[cat] ?? cat}
          </Badge>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {onApply ? (
          <Button
            variant="default"
            size="sm"
            className="text-xs"
            onClick={() => onApply(program.id)}
          >
            Apply
          </Button>
        ) : program.applicationUrl ? (
          <Button variant="default" size="sm" className="text-xs" asChild>
            <a
              href={program.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Apply
            </a>
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onViewDetails?.(program.id)}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}
