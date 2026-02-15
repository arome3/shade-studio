'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATEGORY_LABELS,
  CHAIN_LABELS,
  type ProgramSearchFilters,
  type GrantCategory,
  type GrantChain,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgramSearchProps {
  filters: ProgramSearchFilters;
  onFiltersChange: (filters: ProgramSearchFilters) => void;
  onSearch: (filters: ProgramSearchFilters) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgramSearch({
  filters,
  onFiltersChange,
  onSearch,
  disabled,
}: ProgramSearchProps) {
  const [searchText, setSearchText] = useState(filters.searchText ?? '');

  // Debounced search on text change
  useEffect(() => {
    const timer = setTimeout(() => {
      const newFilters = { ...filters, searchText: searchText || undefined };
      onFiltersChange(newFilters);
      onSearch(newFilters);
    }, 300);
    return () => clearTimeout(timer);
    // Only react to searchText changes, not filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      const category = value === 'all' ? undefined : (value as GrantCategory);
      const newFilters = { ...filters, category };
      onFiltersChange(newFilters);
      onSearch(newFilters);
    },
    [filters, onFiltersChange, onSearch]
  );

  const handleChainChange = useCallback(
    (value: string) => {
      const chain = value === 'all' ? undefined : (value as GrantChain);
      const newFilters = { ...filters, chain };
      onFiltersChange(newFilters);
      onSearch(newFilters);
    },
    [filters, onFiltersChange, onSearch]
  );

  const handleActiveToggle = useCallback(() => {
    const newFilters = { ...filters, activeOnly: !filters.activeOnly };
    onFiltersChange(newFilters);
    onSearch(newFilters);
  }, [filters, onFiltersChange, onSearch]);

  const handleReset = useCallback(() => {
    setSearchText('');
    const newFilters: ProgramSearchFilters = {};
    onFiltersChange(newFilters);
    onSearch(newFilters);
  }, [onFiltersChange, onSearch]);

  const hasFilters =
    searchText ||
    filters.category ||
    filters.chain ||
    filters.activeOnly;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search programs..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
      </div>

      <Select
        value={filters.category ?? 'all'}
        onValueChange={handleCategoryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.chain ?? 'all'}
        onValueChange={handleChainChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Chain" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Chains</SelectItem>
          {Object.entries(CHAIN_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={filters.activeOnly ? 'default' : 'outline'}
        size="sm"
        onClick={handleActiveToggle}
        disabled={disabled}
        className="shrink-0"
      >
        Active Only
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
          className="shrink-0"
        >
          <X className="h-4 w-4 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
