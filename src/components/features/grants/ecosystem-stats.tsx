'use client';

import { BarChart3, DollarSign, FolderOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  CATEGORY_LABELS,
  CHAIN_LABELS,
  formatFunding,
  type EcosystemStats as EcosystemStatsType,
} from '@/types/grants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EcosystemStatsProps {
  stats: EcosystemStatsType;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EcosystemStats({ stats }: EcosystemStatsProps) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <FolderOpen className="h-4 w-4" />
            <span className="text-xs">Total Programs</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.totalPrograms}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Total Funded</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {formatFunding(stats.totalFunded)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">Active Programs</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.activePrograms}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Total Applications</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.totalApplications}
          </p>
        </div>
      </div>

      {/* Distribution sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top categories */}
        {stats.topCategories.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <h4 className="text-sm font-medium text-text-primary">
              Top Categories
            </h4>
            <div className="space-y-2">
              {stats.topCategories.map(({ category, count }) => (
                <div
                  key={category}
                  className="flex items-center justify-between"
                >
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[category] ?? category}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {count} programs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top chains */}
        {stats.topChains.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <h4 className="text-sm font-medium text-text-primary">
              Top Chains
            </h4>
            <div className="space-y-2">
              {stats.topChains.map(({ chain, count }) => (
                <div key={chain} className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {CHAIN_LABELS[chain] ?? chain}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {count} programs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty distributions placeholder */}
      {stats.topCategories.length === 0 && stats.topChains.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">
          Distribution data will populate as more programs are registered.
        </p>
      )}
    </div>
  );
}
