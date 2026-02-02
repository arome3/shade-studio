import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for merging Tailwind CSS classes with proper conflict resolution.
 *
 * Uses clsx for conditional class joining and tailwind-merge to intelligently
 * handle conflicting Tailwind utilities (e.g., 'px-4 px-6' becomes 'px-6').
 *
 * @example
 * cn('px-4 py-2', 'px-6') // => 'py-2 px-6'
 * cn('text-red-500', isError && 'text-green-500') // conditional classes
 * cn({ 'opacity-50': disabled, 'cursor-pointer': !disabled })
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
