'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { countWords } from '@/lib/proposals/validation';
import type { ProposalSection as ProposalSectionType } from '@/types/proposal';

// Lazy-load MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// ============================================================================
// Types
// ============================================================================

export interface ProposalSectionEditorProps {
  section: ProposalSectionType;
  onChange: (content: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ProposalSectionEditor({
  section,
  onChange,
  className,
}: ProposalSectionEditorProps) {
  const wordCount = useMemo(() => countWords(section.content), [section.content]);
  const isOverLimit = section.wordLimit !== undefined && wordCount > section.wordLimit;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Section header */}
      <div className="pb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold text-text-primary">
            {section.title}
          </h3>
          {section.required && (
            <Badge variant="outline" className="text-[10px]">
              Required
            </Badge>
          )}
          {section.isComplete && section.content.trim() && (
            <Badge variant="success" className="text-[10px]">
              Complete
            </Badge>
          )}
          {isOverLimit && (
            <Badge variant="error" className="text-[10px]">
              Over limit
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-text-muted">{section.description}</p>

        {/* Word count */}
        <div className="flex items-center gap-3 text-xs">
          <span
            className={cn(
              isOverLimit ? 'text-error font-medium' : 'text-text-muted'
            )}
          >
            {wordCount}{section.wordLimit ? `/${section.wordLimit}` : ''} words
          </span>
          {section.lastEditedAt && (
            <span className="text-text-muted">
              Last edited: {new Date(section.lastEditedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Markdown editor */}
      <div className="flex-1 min-h-[300px]" data-color-mode="dark">
        <MDEditor
          value={section.content}
          onChange={(val) => onChange(val ?? '')}
          height="100%"
          preview="edit"
          hideToolbar={false}
          visibleDragbar={false}
          className="!bg-surface !border-border"
        />
      </div>
    </div>
  );
}
