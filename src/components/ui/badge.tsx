'use client';

import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-near-green-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-near-green-500 text-near-black',
        secondary: 'border-transparent bg-surface text-text-primary',
        outline: 'border-border text-text-primary',
        success: 'border-transparent bg-success/20 text-success',
        warning: 'border-transparent bg-warning/20 text-warning',
        error: 'border-transparent bg-error/20 text-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component for status indicators and labels.
 *
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="success">Verified</Badge>
 * <Badge variant="error">Error</Badge>
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
