'use client';

/**
 * EVM chain selector for cross-chain grant submission.
 *
 * Wraps the Radix Select primitive with NEAR-branded styling.
 * Displays supported chains with their native currency symbols.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSupportedChains } from '@/lib/chain-signatures/chains';
import type { EVMChainId } from '@/types/chain-signatures';

// ============================================================================
// Types
// ============================================================================

export interface ChainSelectorProps {
  /** Currently selected chain */
  value: EVMChainId;
  /** Callback when chain selection changes */
  onValueChange: (chain: EVMChainId) => void;
  /** Disable the selector */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

const chains = getSupportedChains();

export function ChainSelector({
  value,
  onValueChange,
  disabled = false,
}: ChainSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-primary">
        Target Chain
      </label>
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as EVMChainId)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select chain" />
        </SelectTrigger>
        <SelectContent>
          {chains.map((chain) => (
            <SelectItem key={chain.id} value={chain.id}>
              <span className="flex items-center gap-2">
                <span>{chain.name}</span>
                <span className="text-text-muted text-xs">({chain.symbol})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
