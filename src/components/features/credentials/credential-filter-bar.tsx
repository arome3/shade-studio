'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CredentialFilter } from '@/types/credentials';
import type { ZKCircuit } from '@/types/zk';

interface CredentialFilterBarProps {
  filter: CredentialFilter;
  onFilterChange: (filter: CredentialFilter) => void;
}

const CIRCUIT_OPTIONS: { value: ZKCircuit; label: string }[] = [
  { value: 'verified-builder', label: 'Verified Builder' },
  { value: 'grant-track-record', label: 'Grant Track Record' },
  { value: 'team-attestation', label: 'Team Attestation' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'Generating' },
  { value: 'ready', label: 'Ready' },
  { value: 'verified', label: 'Verified' },
  { value: 'on-chain', label: 'On-Chain' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
] as const;

export function CredentialFilterBar({
  filter,
  onFilterChange,
}: CredentialFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filter.circuit ?? 'all'}
        onValueChange={(value) =>
          onFilterChange({
            ...filter,
            circuit: value === 'all' ? undefined : (value as ZKCircuit),
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All circuits" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Circuits</SelectItem>
          {CIRCUIT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.status ?? 'all'}
        onValueChange={(value) =>
          onFilterChange({
            ...filter,
            status: value === 'all' ? undefined : (value as CredentialFilter['status']),
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
