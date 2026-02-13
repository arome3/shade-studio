'use client';

import { Shield, Cloud, CheckCircle2, Clock } from 'lucide-react';
import type { CredentialStats } from '@/types/credentials';
import { cn } from '@/lib/utils/cn';

interface CredentialStatsBarProps {
  stats: CredentialStats;
}

const STAT_ITEMS = [
  {
    key: 'total' as const,
    label: 'Total',
    icon: Shield,
    colorClass: 'text-text-primary',
  },
  {
    key: 'onChain' as const,
    label: 'On-Chain',
    icon: Cloud,
    colorClass: 'text-near-green-500',
  },
  {
    key: 'verified' as const,
    label: 'Verified',
    icon: CheckCircle2,
    colorClass: 'text-near-cyan-500',
  },
  {
    key: 'expired' as const,
    label: 'Expired',
    icon: Clock,
    colorClass: 'text-text-muted',
  },
];

export function CredentialStatsBar({ stats }: CredentialStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {STAT_ITEMS.map(({ key, label, icon: Icon, colorClass }) => (
        <div
          key={key}
          className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-hover"
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon className={cn('h-4 w-4', colorClass)} />
            <span className="text-xs text-text-muted">{label}</span>
          </div>
          <p className={cn('text-xl font-semibold', colorClass)}>
            {stats[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
