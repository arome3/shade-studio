'use client';

import { type HTMLAttributes } from 'react';
import {
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  Loader2,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';
import type { VerificationResult, VerificationStatus } from '@/types/attestation';

export interface VerificationStatusProps extends HTMLAttributes<HTMLDivElement> {
  /** Verification result to display */
  result: VerificationResult | null;
  /** Whether verification is in progress */
  isVerifying?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
}

/**
 * Get icon component for verification status
 */
function getStatusIcon(status: VerificationStatus | 'verifying', size: 'sm' | 'md' | 'lg') {
  const sizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  switch (status) {
    case 'verifying':
      return <Loader2 className={cn(sizeClass, 'animate-spin')} />;
    case 'verified':
      return <ShieldCheck className={sizeClass} />;
    case 'expired':
      return <Clock className={sizeClass} />;
    case 'invalid':
    case 'error':
      return <ShieldX className={sizeClass} />;
    case 'unverified':
    case 'pending':
    default:
      return <ShieldQuestion className={sizeClass} />;
  }
}

/**
 * Get badge variant for verification status
 */
function getStatusVariant(
  status: VerificationStatus | 'verifying',
  hasWarnings: boolean
): 'default' | 'secondary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'verifying':
      return 'secondary';
    case 'verified':
      return hasWarnings ? 'warning' : 'success';
    case 'expired':
      return 'warning';
    case 'invalid':
    case 'error':
      return 'error';
    case 'unverified':
    case 'pending':
    default:
      return 'secondary';
  }
}

/**
 * Get label text for verification status
 */
function getStatusLabel(status: VerificationStatus | 'verifying', hasWarnings: boolean): string {
  switch (status) {
    case 'verifying':
      return 'Verifying...';
    case 'verified':
      return hasWarnings ? 'Verified*' : 'Verified';
    case 'expired':
      return 'Expired';
    case 'invalid':
      return 'Invalid';
    case 'error':
      return 'Error';
    case 'unverified':
      return 'Unverified';
    case 'pending':
    default:
      return 'Pending';
  }
}

/**
 * Compact verification status badge.
 * Shows a badge indicating the verification state of a TEE attestation.
 *
 * @example
 * ```tsx
 * <VerificationStatus result={result} isVerifying={isVerifying} />
 * <VerificationStatus result={result} size="lg" showLabel />
 * ```
 */
export function VerificationStatus({
  result,
  isVerifying = false,
  size = 'md',
  showLabel = false,
  showTooltip = true,
  className,
  ...props
}: VerificationStatusProps) {
  const status: VerificationStatus | 'verifying' = isVerifying
    ? 'verifying'
    : result?.status || 'pending';

  const hasWarnings = (result?.warnings?.length ?? 0) > 0;
  const variant = getStatusVariant(status, hasWarnings);
  const label = getStatusLabel(status, hasWarnings);
  const icon = getStatusIcon(status, size);

  const tooltipContent = result?.message || label;

  const badgeSizeClass = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }[size];

  const badge = (
    <Badge
      variant={variant}
      className={cn('gap-1 cursor-default', badgeSizeClass, className)}
      {...props}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{tooltipContent}</p>
          {hasWarnings && result?.warnings && (
            <ul className="mt-1 text-xs text-warning">
              {result.warnings.slice(0, 2).map((w, i) => (
                <li key={i}>• {w.message}</li>
              ))}
              {result.warnings.length > 2 && (
                <li>• +{result.warnings.length - 2} more</li>
              )}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline verification indicator (just the icon with color).
 */
export function VerificationIndicator({
  result,
  isVerifying = false,
  size = 'md',
  className,
}: {
  result: VerificationResult | null;
  isVerifying?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const status: VerificationStatus | 'verifying' = isVerifying
    ? 'verifying'
    : result?.status || 'pending';

  const hasWarnings = (result?.warnings?.length ?? 0) > 0;

  const colorClass = {
    verifying: 'text-text-muted',
    verified: hasWarnings ? 'text-warning' : 'text-success',
    expired: 'text-warning',
    invalid: 'text-error',
    error: 'text-error',
    unverified: 'text-text-muted',
    pending: 'text-text-muted',
  }[status];

  return (
    <span className={cn(colorClass, className)}>
      {getStatusIcon(status, size)}
    </span>
  );
}
