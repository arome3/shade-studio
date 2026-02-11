'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  CheckCircle2,
  Circle,
  XCircle,
  MinusCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getCategoryBadgeVariant,
  getOutcomeBadgeVariant,
  getOutcomeColor,
  getCategoryLabel,
  getOutcomeLabel,
  getStatusLabel,
  getStatusBadgeVariant,
} from '@/lib/intelligence/decisions';
import { cn } from '@/lib/utils/cn';
import type { Decision, DecisionOutcome } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

export interface DecisionEntryProps {
  decision: Decision;
  onEdit: (decision: Decision) => void;
  onRemove: (id: string) => void;
  onUpdateOutcome?: (id: string, outcome: DecisionOutcome) => void;
  onReanalyze?: (id: string) => void;
  analyzingId?: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function OutcomeIcon({
  outcome,
  className,
}: {
  outcome: DecisionOutcome;
  className?: string;
}) {
  const color = getOutcomeColor(outcome);
  switch (outcome) {
    case 'successful':
      return <CheckCircle2 className={cn('h-5 w-5', color, className)} />;
    case 'partially_successful':
      return <MinusCircle className={cn('h-5 w-5', color, className)} />;
    case 'unsuccessful':
      return <XCircle className={cn('h-5 w-5', color, className)} />;
    case 'inconclusive':
      return <HelpCircle className={cn('h-5 w-5', color, className)} />;
    case 'pending':
    default:
      return <Circle className={cn('h-5 w-5', color, className)} />;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Collapsible decision card showing summary when collapsed and full details when expanded.
 */
export function DecisionEntry({
  decision,
  onEdit,
  onRemove,
  onUpdateOutcome,
  onReanalyze,
  analyzingId,
}: DecisionEntryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isThisAnalyzing = analyzingId === decision.id;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border bg-surface/50 overflow-hidden">
        {/* Collapsed header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 w-full p-3 text-left hover:bg-surface-hover transition-colors"
          >
            <OutcomeIcon outcome={decision.outcome} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {decision.title}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {decision.decisionDate}
              </p>
            </div>
            <Badge variant={getCategoryBadgeVariant(decision.category)} className="text-[10px]">
              {getCategoryLabel(decision.category)}
            </Badge>
            <Badge variant={getOutcomeBadgeVariant(decision.outcome)} className="text-[10px]">
              {getOutcomeLabel(decision.outcome)}
            </Badge>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Status:</span>
              <Badge variant={getStatusBadgeVariant(decision.status)} className="text-[10px]">
                {getStatusLabel(decision.status)}
              </Badge>
            </div>

            {/* Context */}
            <div>
              <h4 className="text-xs font-medium text-text-muted mb-1">Context</h4>
              <p className="text-sm text-text-secondary">{decision.context}</p>
            </div>

            {/* Description */}
            {decision.description && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-1">Description</h4>
                <p className="text-sm text-text-secondary">{decision.description}</p>
              </div>
            )}

            {/* Rationale */}
            <div>
              <h4 className="text-xs font-medium text-text-muted mb-1">Rationale</h4>
              <p className="text-sm text-text-secondary">{decision.rationale}</p>
            </div>

            {/* Alternatives */}
            {decision.alternatives.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-2">
                  Alternatives Considered
                </h4>
                <div className="space-y-2">
                  {decision.alternatives.map((alt, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-md bg-surface/50 border border-border"
                    >
                      <p className="text-sm font-medium text-text-primary">
                        {alt.title}
                      </p>
                      {alt.description && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          {alt.description}
                        </p>
                      )}
                      {alt.pros.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-success font-medium">
                            Pros:
                          </span>
                          <span className="text-xs text-text-secondary ml-1">
                            {alt.pros.join(', ')}
                          </span>
                        </div>
                      )}
                      {alt.cons.length > 0 && (
                        <div className="mt-0.5">
                          <span className="text-[10px] text-error font-medium">
                            Cons:
                          </span>
                          <span className="text-xs text-text-secondary ml-1">
                            {alt.cons.join(', ')}
                          </span>
                        </div>
                      )}
                      {alt.whyNotChosen && (
                        <p className="text-xs text-text-muted mt-0.5 italic">
                          Not chosen: {alt.whyNotChosen}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expected Impact */}
            {decision.expectedImpact && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-1">
                  Expected Impact
                </h4>
                <p className="text-sm text-text-secondary">
                  {decision.expectedImpact}
                </p>
              </div>
            )}

            {/* Actual Impact */}
            {decision.actualImpact && (
              <div>
                <h4 className="text-xs font-medium text-text-muted mb-1">
                  Actual Impact
                </h4>
                <p className="text-sm text-text-secondary">
                  {decision.actualImpact}
                </p>
              </div>
            )}

            {/* AI Analysis */}
            {decision.aiAnalysis && (
              <div className="p-2.5 rounded-md bg-near-cyan-500/10 border border-near-cyan-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-near-cyan-500" />
                  <span className="text-xs font-medium text-near-cyan-500">
                    AI Analysis
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  {decision.aiAnalysis}
                </p>
              </div>
            )}

            {/* Decision Makers */}
            {decision.decisionMakers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Decision Makers:</span>
                <span className="text-xs text-text-secondary">
                  {decision.decisionMakers.join(', ')}
                </span>
              </div>
            )}

            {/* Tags */}
            {decision.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {decision.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Outcome quick-actions (when pending) */}
            {decision.outcome === 'pending' && onUpdateOutcome && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-text-muted">Mark outcome:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-success"
                  onClick={() => onUpdateOutcome(decision.id, 'successful')}
                >
                  Successful
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-warning"
                  onClick={() =>
                    onUpdateOutcome(decision.id, 'partially_successful')
                  }
                >
                  Partial
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-error"
                  onClick={() => onUpdateOutcome(decision.id, 'unsuccessful')}
                >
                  Unsuccessful
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              {onReanalyze && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => onReanalyze(decision.id)}
                  disabled={isThisAnalyzing}
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      isThisAnalyzing && 'animate-spin'
                    )}
                  />
                  Reanalyze
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => onEdit(decision)}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-error"
                onClick={() => onRemove(decision.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
