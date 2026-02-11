'use client';

import { CheckCircle2, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/cn';
import type { CompletenessResult } from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export interface CompletenessCheckerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: CompletenessResult | null;
  onNavigateToSection: (sectionId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CompletenessChecker({
  open,
  onOpenChange,
  result,
  onNavigateToSection,
}: CompletenessCheckerProps) {
  if (!result) return null;

  const handleNavigate = (sectionId: string) => {
    onNavigateToSection(sectionId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Completeness Check</DialogTitle>
          <DialogDescription>
            Review your proposal&apos;s readiness before submission
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Overall</span>
              <Badge
                variant={result.isComplete ? 'success' : 'warning'}
                className="text-xs"
              >
                {result.percentage}%
              </Badge>
            </div>
            <Progress
              value={result.percentage}
              indicatorClassName={
                result.isComplete ? 'bg-success' : 'bg-near-cyan-500'
              }
            />
          </div>

          {/* Missing items */}
          {result.missingItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-error" />
                <span className="text-sm font-medium text-text-primary">
                  Missing Items
                </span>
              </div>
              <ul className="space-y-1 pl-6">
                {result.missingItems.map((item, i) => (
                  <li key={i} className="text-sm text-text-muted list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-text-primary">
                  Warnings
                </span>
              </div>
              <ul className="space-y-1 pl-6">
                {result.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-text-muted list-disc">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section statuses */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              Section Status
            </span>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-1">
                {result.sectionStatuses.map((ss) => (
                  <button
                    key={ss.sectionId}
                    onClick={() => handleNavigate(ss.sectionId)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left',
                      'text-sm hover:bg-surface/50 transition-colors group'
                    )}
                  >
                    {ss.isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-text-muted shrink-0" />
                    )}
                    <span
                      className={cn(
                        'flex-1 truncate',
                        ss.isComplete ? 'text-text-secondary' : 'text-text-primary'
                      )}
                    >
                      {ss.title}
                    </span>
                    {ss.issues.length > 0 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {ss.issues.length} issue{ss.issues.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <ArrowRight className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Ready state */}
          {result.isComplete && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm text-success">
                Your proposal is ready for submission!
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
