'use client';

import { FileText, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/cn';
import type { VaultDocument } from '@/types/vault-document';

export interface ContextSelectorProps {
  /** Available documents to select from */
  documents: VaultDocument[];
  /** Currently selected document IDs */
  selectedIds: string[];
  /** Called when selection changes */
  onSelectionChange: (ids: string[]) => void;
  /** Whether selector is disabled */
  disabled?: boolean;
}

/**
 * Document context selector for AI chat.
 * Allows users to select which documents to include in AI context.
 */
export function ContextSelector({
  documents,
  selectedIds,
  onSelectionChange,
  disabled = false,
}: ContextSelectorProps) {
  const selectedCount = selectedIds.length;

  const toggleDocument = (docId: string) => {
    if (selectedIds.includes(docId)) {
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedIds, docId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectAll = () => {
    onSelectionChange(documents.map((d) => d.id));
  };

  // Get selected documents for display
  const selectedDocs = documents.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={disabled || documents.length === 0}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>
                {selectedCount > 0
                  ? `${selectedCount} document${selectedCount > 1 ? 's' : ''} selected`
                  : 'Add context documents'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Select Documents</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAll}
                  disabled={documents.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[300px]">
            {documents.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">
                No documents available.
                <br />
                Upload documents to your vault to include them as context.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {documents.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id);

                  return (
                    <button
                      key={doc.id}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                        isSelected
                          ? 'bg-near-green-500/10 text-text-primary'
                          : 'hover:bg-surface-hover text-text-muted'
                      )}
                      onClick={() => toggleDocument(doc.id)}
                    >
                      <div
                        className={cn(
                          'h-4 w-4 rounded border flex items-center justify-center',
                          isSelected
                            ? 'bg-near-green-500 border-near-green-500'
                            : 'border-border'
                        )}
                      >
                        {isSelected && (
                          <svg
                            className="h-3 w-3 text-near-black"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.metadata.name}
                        </p>
                        <p className="text-xs text-text-muted capitalize">
                          {doc.metadata.type}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Selected documents chips */}
      {selectedDocs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDocs.map((doc) => (
            <Badge
              key={doc.id}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer hover:bg-surface-hover"
              onClick={() => toggleDocument(doc.id)}
            >
              <span className="truncate max-w-[120px]">
                {doc.metadata.name}
              </span>
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
