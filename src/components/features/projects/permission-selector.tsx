'use client';

/**
 * Permission level selector for team member access control.
 * Maps each option to NEAR access key semantics with descriptions.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERMISSION_CONFIGS, type PermissionLevel } from '@/types/project-accounts';

export interface PermissionSelectorProps {
  value: PermissionLevel;
  onValueChange: (value: PermissionLevel) => void;
  /** Whether to include the "owner" option (usually only for display) */
  includeOwner?: boolean;
  disabled?: boolean;
}

/** Permission levels available for selection */
const SELECTABLE_LEVELS: PermissionLevel[] = ['editor', 'contributor', 'viewer'];
const ALL_LEVELS: PermissionLevel[] = ['owner', ...SELECTABLE_LEVELS];

/** Format the allowance amount for display */
function formatAllowance(permission: PermissionLevel): string {
  const config = PERMISSION_CONFIGS[permission];
  if (!config.accessKeyPermission) return 'No key';
  if (config.accessKeyPermission.type === 'FullAccess') return 'Full Access';
  const allowance = config.accessKeyPermission.allowance;
  if (!allowance) return '';
  // Convert yoctoNEAR to NEAR for display
  const nearAmount = Number(BigInt(allowance) / BigInt('1000000000000000000000000'));
  const remainder = Number(BigInt(allowance) % BigInt('1000000000000000000000000'));
  if (remainder > 0) return `${nearAmount}.5 NEAR allowance`;
  return `${nearAmount} NEAR allowance`;
}

export function PermissionSelector({
  value,
  onValueChange,
  includeOwner = false,
  disabled = false,
}: PermissionSelectorProps) {
  const levels = includeOwner ? ALL_LEVELS : SELECTABLE_LEVELS;

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as PermissionLevel)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select permission" />
      </SelectTrigger>
      <SelectContent>
        {levels.map((level) => {
          const config = PERMISSION_CONFIGS[level];
          return (
            <SelectItem key={level} value={level}>
              <div className="flex flex-col">
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-text-muted">
                  {formatAllowance(level)}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
