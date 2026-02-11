'use client';

import { FileText, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

// ============================================================================
// Types
// ============================================================================

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  proposalTitle: string;
}

// ============================================================================
// Component
// ============================================================================

export function ExportDialog({
  open,
  onOpenChange,
  onExportMarkdown,
  onExportJSON,
  proposalTitle,
}: ExportDialogProps) {
  const handleExport = (format: 'markdown' | 'json') => {
    if (format === 'markdown') onExportMarkdown();
    else onExportJSON();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Export Proposal</DialogTitle>
          <DialogDescription>
            Export &ldquo;{proposalTitle}&rdquo; for sharing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <button
            onClick={() => handleExport('markdown')}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg border border-border',
              'hover:border-near-green-500/50 hover:bg-surface/50',
              'transition-colors cursor-pointer text-left'
            )}
          >
            <FileText className="h-5 w-5 text-near-green-500 shrink-0" />
            <div>
              <div className="text-sm font-medium text-text-primary">Markdown</div>
              <div className="text-xs text-text-muted">
                Formatted document suitable for sharing and review
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport('json')}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg border border-border',
              'hover:border-near-cyan-500/50 hover:bg-surface/50',
              'transition-colors cursor-pointer text-left'
            )}
          >
            <FileJson className="h-5 w-5 text-near-cyan-500 shrink-0" />
            <div>
              <div className="text-sm font-medium text-text-primary">JSON</div>
              <div className="text-xs text-text-muted">
                Structured data for backup or re-import
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
