'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DataItem, DeleteResult } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DataItem[];
  deleteResult: DeleteResult | null;
  onConfirm: () => Promise<DeleteResult | void>;
}

// ============================================================================
// Component
// ============================================================================

export function DeleteDialog({
  open,
  onOpenChange,
  items,
  deleteResult,
  onConfirm,
}: DeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [localResult, setLocalResult] = useState<DeleteResult | null>(null);

  const summary = useMemo(() => {
    const categories = new Map<string, number>();
    const locations = new Set<string>();
    for (const item of items) {
      categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
      locations.add(item.location);
    }
    return { categories, locations };
  }, [items]);

  const isConfirmed = confirmText === 'DELETE';
  const result = localResult ?? deleteResult;
  const showResult = result && !isDeleting;

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    try {
      const res = await onConfirm();
      if (res) setLocalResult(res);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
      setLocalResult(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {showResult ? (
          // Result state
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${result.failedItems.length > 0 ? 'bg-warning/10' : 'bg-near-green-500/10'}`}>
                  {result.failedItems.length > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-near-green-500" />
                  )}
                </div>
                <div>
                  <DialogTitle>
                    {result.failedItems.length > 0 ? 'Partially Deleted' : 'Delete Complete'}
                  </DialogTitle>
                  <DialogDescription>
                    Deleted {result.successCount} item{result.successCount !== 1 ? 's' : ''}.
                    {result.failedItems.length > 0 &&
                      ` ${result.failedItems.length} item${result.failedItems.length !== 1 ? 's' : ''} failed to delete.`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {result.failedItems.length > 0 && (
              <div className="rounded-lg border border-border bg-background-secondary p-3 space-y-1.5">
                <p className="text-xs font-medium text-error mb-1">Failed items:</p>
                {result.failedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-text-primary truncate">{item.name}</span>
                    <span className="text-text-muted ml-2 shrink-0">{item.error}</span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Confirmation state
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-error/10">
                  <AlertTriangle className="h-5 w-5 text-error" />
                </div>
                <div>
                  <DialogTitle>Delete {items.length} item{items.length !== 1 ? 's' : ''}</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              {/* Category breakdown */}
              <div className="rounded-lg border border-border bg-background-secondary p-3 space-y-1.5">
                {Array.from(summary.categories.entries()).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted capitalize">{category}</span>
                    <span className="text-text-primary font-medium">{count}</span>
                  </div>
                ))}
                <div className="h-px bg-border my-1" />
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <span>Affected locations:</span>
                  <span className="text-text-primary">
                    {Array.from(summary.locations).join(', ')}
                  </span>
                </div>
              </div>

              {/* Confirmation input */}
              <div>
                <p className="text-sm text-text-muted mb-2">
                  Type <span className="font-mono font-bold text-error">DELETE</span> to confirm
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!isConfirmed || isDeleting}
                className="bg-error hover:bg-error/90 text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
