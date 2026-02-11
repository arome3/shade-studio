'use client';

import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';
import type { ProposalSection } from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export interface SectionSidebarProps {
  sections: ProposalSection[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SectionSidebar({
  sections,
  activeSectionId,
  onSelectSection,
  className,
}: SectionSidebarProps) {
  const completeSections = sections.filter((s) =>
    s.required ? s.isComplete && s.content.trim() !== '' : s.isComplete
  ).length;
  const requiredSections = sections.filter((s) => s.required);
  const requiredComplete = requiredSections.filter((s) => s.isComplete && s.content.trim() !== '').length;
  const percentage = sections.length > 0
    ? Math.round((completeSections / sections.length) * 100)
    : 0;

  return (
    <div className={cn('flex flex-col border-r border-border', className)}>
      {/* Progress header */}
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} />
        <p className="text-xs text-text-muted">
          {requiredComplete}/{requiredSections.length} required sections complete
        </p>
      </div>

      {/* Section list */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;
            const isEmpty = !section.content.trim();
            const isComplete = section.isComplete && !isEmpty;
            const isOverLimit =
              section.wordLimit !== undefined && section.wordCount > section.wordLimit;

            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left',
                  'text-sm transition-colors',
                  isActive
                    ? 'bg-near-green-500/10 text-text-primary'
                    : 'text-text-muted hover:bg-surface/50 hover:text-text-primary'
                )}
              >
                {isOverLimit ? (
                  <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle
                    className={cn(
                      'h-4 w-4 shrink-0',
                      section.required ? 'text-text-muted' : 'text-text-muted/50'
                    )}
                  />
                )}
                <span className="truncate flex-1">{section.title}</span>
                {section.required && isEmpty && (
                  <span className="text-[10px] text-error shrink-0">*</span>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer stats */}
      <div className="p-3 border-t border-border text-xs text-text-muted text-center">
        {completeSections}/{sections.length} sections complete
      </div>
    </div>
  );
}
