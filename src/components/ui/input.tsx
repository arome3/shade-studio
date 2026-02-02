import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Show error state */
  error?: boolean;
}

/**
 * Input component with NEAR design system styling.
 *
 * @example
 * <Input placeholder="Enter your name" />
 * <Input type="email" error={!!errors.email} />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border bg-background-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-error focus-visible:ring-error'
            : 'border-border focus-visible:ring-near-green-500 hover:border-border-hover',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
