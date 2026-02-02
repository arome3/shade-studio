'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Button variants using CVA for type-safe styling.
 *
 * Variants:
 * - default: NEAR green primary button
 * - secondary: Subtle surface background
 * - outline: Border only
 * - ghost: No background, hover effect
 * - destructive: Red for dangerous actions
 * - link: Looks like a link
 */
const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-near-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-near-green-500 text-near-black hover:bg-near-green-400 glow',
        secondary:
          'bg-surface text-text-primary hover:bg-surface-hover border border-border hover:border-border-hover',
        outline:
          'border border-border bg-transparent text-text-primary hover:bg-surface hover:border-border-hover',
        ghost: 'text-text-primary hover:bg-surface hover:text-text-primary',
        destructive:
          'bg-error text-near-white hover:bg-error/90',
        link: 'text-near-green-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8 text-base',
        xl: 'h-12 rounded-lg px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as a different element using Radix Slot */
  asChild?: boolean;
  /** Show loading state */
  loading?: boolean;
}

/**
 * Button component with NEAR design system styling.
 *
 * @example
 * <Button>Click me</Button>
 * <Button variant="secondary" size="lg">Large Secondary</Button>
 * <Button asChild><Link href="/page">Navigate</Link></Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
