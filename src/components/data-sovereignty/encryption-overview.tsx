'use client';

import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { STORAGE_LOCATION_CONFIG } from '@/hooks/use-data-sovereignty';
import type { EncryptionSummary } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface EncryptionOverviewProps {
  summary: EncryptionSummary;
}

// ============================================================================
// Helpers
// ============================================================================

function getEncryptionMeta(percentage: number) {
  if (percentage >= 80) {
    return {
      icon: ShieldCheck,
      label: 'Strong Protection',
      colorClass: 'text-near-green-500',
      indicatorClass: 'bg-near-green-500',
    };
  }
  if (percentage >= 50) {
    return {
      icon: Shield,
      label: 'Moderate Protection',
      colorClass: 'text-warning',
      indicatorClass: 'bg-warning',
    };
  }
  return {
    icon: ShieldAlert,
    label: 'Low Protection',
    colorClass: 'text-error',
    indicatorClass: 'bg-error',
  };
}

// ============================================================================
// Component
// ============================================================================

export function EncryptionOverview({ summary }: EncryptionOverviewProps) {
  const meta = getEncryptionMeta(summary.overallPercentage);
  const StatusIcon = meta.icon;

  // Empty state
  if (summary.totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Shield className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No data to encrypt</p>
        <p className="text-xs mt-1">Add documents or credentials to see encryption status</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with gauge */}
      <div className="flex items-center gap-4">
        <motion.div
          className={`p-3 rounded-xl bg-surface ${meta.colorClass}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        >
          <StatusIcon className="h-6 w-6" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <motion.span
              className="text-2xl font-bold text-text-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {Math.round(summary.overallPercentage)}%
            </motion.span>
            <span className={`text-sm font-medium ${meta.colorClass}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {summary.encryptedCount} of {summary.totalCount} items encrypted
          </p>
          <Progress
            value={summary.overallPercentage}
            className="mt-2 h-2"
            indicatorClassName={meta.indicatorClass}
          />
        </div>
      </div>

      {/* Per-location cards */}
      <div className="grid grid-cols-2 gap-3">
        {summary.byLocation.map((loc, i) => {
          const config = STORAGE_LOCATION_CONFIG[loc.location];
          const Icon = config.icon;
          const locMeta = getEncryptionMeta(loc.percentage);

          return (
            <motion.div
              key={loc.location}
              className="rounded-lg border border-border bg-background-secondary p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-3.5 w-3.5 ${config.tailwindColor}`} />
                <span className="text-xs font-medium text-text-primary">
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-text-muted mb-1.5">
                {loc.encrypted}/{loc.total} encrypted
              </p>
              <Progress
                value={loc.percentage}
                className="h-1.5"
                indicatorClassName={locMeta.indicatorClass}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant="success" className="text-[10px] gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-near-green-500" />
          AES-256 Encrypted
        </Badge>
        <Badge variant="warning" className="text-[10px] gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          ZK Commitments
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
          Public Metadata
        </Badge>
      </div>
    </div>
  );
}
