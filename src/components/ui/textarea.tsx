'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show error state */
  error?: boolean;
}

/**
 * Textarea component with NEAR design system styling.
 *
 * @example
 * <Textarea placeholder="Enter your message..." />
 * <Textarea error={!!errors.message} />
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-near-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none',
          error
            ? 'border-error focus-visible:ring-error'
            : 'border-border hover:border-border-hover',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
