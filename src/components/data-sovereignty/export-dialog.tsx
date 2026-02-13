'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileJson, FolderArchive, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ExportFormat, ExportOptions, DataCategory } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportStatus: 'idle' | 'exporting' | 'complete' | 'error';
  exportError: string | null;
  exportProgress: number;
  onExport: (options: ExportOptions) => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

const ALL_CATEGORIES: { id: DataCategory; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'proofs', label: 'Proofs' },
  { id: 'settings', label: 'Settings' },
];

const FORMAT_OPTIONS: { id: ExportFormat; label: string; description: string; icon: typeof FileJson }[] = [
  { id: 'json', label: 'JSON', description: 'Metadata only', icon: FileJson },
  { id: 'zip', label: 'ZIP', description: 'Full data archive', icon: FolderArchive },
];

export function ExportDialog({
  open,
  onOpenChange,
  exportStatus,
  exportError,
  exportProgress,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [selectedCategories, setSelectedCategories] = useState<DataCategory[]>([
    'documents',
    'credentials',
    'proofs',
    'settings',
  ]);

  const toggleCategory = (cat: DataCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    );
  };

  const handleExport = () => {
    onExport({ format, categories: selectedCategories });
  };

  const handleFormatKeyDown = (e: React.KeyboardEvent, fmt: ExportFormat) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFormat(fmt);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = FORMAT_OPTIONS.findIndex((o) => o.id === fmt) + 1;
      if (nextIdx < FORMAT_OPTIONS.length) {
        setFormat(FORMAT_OPTIONS[nextIdx]!.id);
        // Focus the next radio
        const target = (e.currentTarget.parentElement?.children[nextIdx] as HTMLElement);
        target?.focus();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = FORMAT_OPTIONS.findIndex((o) => o.id === fmt) - 1;
      if (prevIdx >= 0) {
        setFormat(FORMAT_OPTIONS[prevIdx]!.id);
        const target = (e.currentTarget.parentElement?.children[prevIdx] as HTMLElement);
        target?.focus();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Download your data in your preferred format.
          </DialogDescription>
        </DialogHeader>

        {exportStatus === 'complete' ? (
          <motion.div
            className="flex flex-col items-center py-6"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-full bg-near-green-500/10 flex items-center justify-center mb-3">
              <Check className="h-6 w-6 text-near-green-500" />
            </div>
            <p className="text-sm font-medium text-text-primary">Export Complete</p>
            <p className="text-xs text-text-muted mt-1">Your download should begin automatically</p>
          </motion.div>
        ) : exportStatus === 'exporting' ? (
          <div className="py-6 space-y-3">
            <p className="text-sm text-text-muted text-center">
              {exportProgress < 100
                ? `Exporting... ${exportProgress}%`
                : 'Finalizing export...'}
            </p>
            <Progress value={exportProgress} className="h-2" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Format selection */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-2">Format</p>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Export format">
                {FORMAT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = format === opt.id;
                  return (
                    <div
                      key={opt.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setFormat(opt.id)}
                      onKeyDown={(e) => handleFormatKeyDown(e, opt.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-near-green-500/50 bg-near-green-500/5'
                          : 'border-border bg-background-secondary hover:border-border-hover'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-near-green-500' : 'text-text-muted'}`} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-text-primary">{opt.label}</p>
                        <p className="text-[10px] text-text-muted">{opt.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {format === 'json' && (
                <p className="text-[10px] text-text-muted mt-1.5">
                  JSON exports include metadata only. Use ZIP for full data export.
                </p>
              )}
            </div>

            {/* Category selection */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-2">Include</p>
              <div className="space-y-2">
                {ALL_CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="h-4 w-4 rounded border-border bg-surface text-near-green-500 focus:ring-near-green-500 focus:ring-offset-background"
                    />
                    <span className="text-sm text-text-primary">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error */}
            {exportError && (
              <p className="text-sm text-error">{exportError}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {exportStatus === 'complete' ? 'Done' : 'Cancel'}
          </Button>
          {exportStatus !== 'complete' && (
            <Button
              onClick={handleExport}
              disabled={exportStatus === 'exporting' || selectedCategories.length === 0}
            >
              Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
