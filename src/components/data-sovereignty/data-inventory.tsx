'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Lock,
  Unlock,
  FileText,
  Shield,
  Settings,
  Key,
  Download,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatBytes } from '@/lib/utils/format';
import { formatDistanceToNow } from 'date-fns';
import type {
  DataItem,
  DataCategory,
  StorageLocation,
} from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface DataInventoryProps {
  items: DataItem[];
  searchQuery: string;
  categoryFilter: DataCategory | 'all';
  locationFilter: StorageLocation | 'all';
  selectedItemIds: string[];
  onSearchChange: (query: string) => void;
  onCategoryFilterChange: (filter: DataCategory | 'all') => void;
  onLocationFilterChange: (filter: StorageLocation | 'all') => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onExport: () => void;
  onDelete: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const CATEGORY_ICONS: Record<DataCategory, typeof FileText> = {
  documents: FileText,
  credentials: Key,
  proofs: Shield,
  settings: Settings,
};

const CATEGORY_LABELS: Record<DataCategory, string> = {
  documents: 'Documents',
  credentials: 'Credentials',
  proofs: 'Proofs',
  settings: 'Settings',
};

function getCategoryBadgeVariant(category: DataCategory) {
  switch (category) {
    case 'documents': return 'default' as const;
    case 'credentials': return 'success' as const;
    case 'proofs': return 'warning' as const;
    case 'settings': return 'secondary' as const;
  }
}

// ============================================================================
// Component
// ============================================================================

export function DataInventory({
  items,
  searchQuery,
  categoryFilter,
  locationFilter,
  selectedItemIds,
  onSearchChange,
  onCategoryFilterChange,
  onLocationFilterChange,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onExport,
  onDelete,
}: DataInventoryProps) {
  // Group items by category
  const grouped = useMemo(() => {
    const groups = new Map<DataCategory, DataItem[]>();
    for (const item of items) {
      const existing = groups.get(item.category) ?? [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return groups;
  }, [items]);

  const allSelected = items.length > 0 && selectedItemIds.length === items.length;
  const someSelected = selectedItemIds.length > 0;

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search data items..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(v) => onCategoryFilterChange(v as DataCategory | 'all')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
              <SelectItem value="credentials">Credentials</SelectItem>
              <SelectItem value="proofs">Proofs</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={locationFilter}
            onValueChange={(v) => onLocationFilterChange(v as StorageLocation | 'all')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="ipfs">IPFS</SelectItem>
              <SelectItem value="near-social">NEAR Social</SelectItem>
              <SelectItem value="near-contract">NEAR Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Select all toggle */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <button
            role="checkbox"
            aria-checked={allSelected}
            aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
            tabIndex={0}
            onClick={() => {
              if (allSelected) {
                onClearSelection();
              } else {
                onSelectAll(items.map((i) => i.id));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (allSelected) {
                  onClearSelection();
                } else {
                  onSelectAll(items.map((i) => i.id));
                }
              }
            }}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-near-green-500" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Search className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {searchQuery || categoryFilter !== 'all' || locationFilter !== 'all'
              ? 'No matching items'
              : 'No data items yet'}
          </p>
          <p className="text-xs mt-1">
            {searchQuery ? 'Try adjusting your search or filters' : 'Upload documents or generate credentials to get started'}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([category, categoryItems]) => {
              const CategoryIcon = CATEGORY_ICONS[category];
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <CategoryIcon className="h-4 w-4 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({categoryItems.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {categoryItems.map((item) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`${item.name}, ${item.category}`}
                          tabIndex={0}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-near-green-500/30 bg-near-green-500/5'
                              : 'border-border bg-background-secondary hover:border-border-hover'
                          }`}
                          onClick={() => onToggleSelection(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onToggleSelection(item.id);
                            }
                          }}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                        >
                          {/* Checkbox */}
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-near-green-500 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-text-muted shrink-0" />
                          )}

                          {/* Name + badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {item.name}
                              </span>
                              <Badge
                                variant={getCategoryBadgeVariant(item.category)}
                                className="text-[10px] shrink-0"
                              >
                                {item.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.encrypted ? (
                                <Lock className="h-3 w-3 text-near-green-500" />
                              ) : (
                                <Unlock className="h-3 w-3 text-text-muted" />
                              )}
                              <span className="text-xs text-text-muted">
                                {item.location}
                                {item.secondaryLocation && (
                                  <span className="text-text-muted"> + {item.secondaryLocation}</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Size + date */}
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-text-primary">
                              {formatBytes(item.sizeBytes)}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface/80 backdrop-blur-xl px-4 py-3 shadow-2xl"
          >
            <span className="text-sm font-medium text-text-primary">
              {selectedItemIds.length} selected
            </span>
            <div className="w-px h-5 bg-border" />
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              size="sm"
              className="bg-error hover:bg-error/90 text-white"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
            <button
              onClick={onClearSelection}
              aria-label="Clear selection"
              className="text-xs text-text-muted hover:text-text-primary transition-colors ml-1"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
