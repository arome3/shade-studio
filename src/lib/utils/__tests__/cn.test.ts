import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn utility', () => {
  it('should merge class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;

    const result = cn(
      'base',
      isActive && 'active',
      isDisabled && 'disabled'
    );

    expect(result).toBe('base active');
  });

  it('should handle object syntax', () => {
    const result = cn({
      base: true,
      active: true,
      disabled: false,
    });

    expect(result).toBe('base active');
  });

  it('should merge conflicting Tailwind classes', () => {
    // tailwind-merge should keep only the last conflicting class
    const result = cn('px-4 py-2', 'px-6');
    expect(result).toBe('py-2 px-6');
  });

  it('should handle undefined and null values', () => {
    const result = cn('base', undefined, null, 'final');
    expect(result).toBe('base final');
  });

  it('should handle empty strings', () => {
    const result = cn('base', '', 'final');
    expect(result).toBe('base final');
  });

  it('should handle arrays', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('should handle complex Tailwind conflicts', () => {
    // Test various conflict scenarios
    const result = cn(
      'text-red-500 bg-blue-500',
      'text-green-500'
    );
    expect(result).toBe('bg-blue-500 text-green-500');
  });

  it('should preserve non-conflicting classes', () => {
    const result = cn(
      'flex items-center justify-between',
      'p-4 hover:bg-surface'
    );
    expect(result).toBe('flex items-center justify-between p-4 hover:bg-surface');
  });

  it('should handle complex real-world component example', () => {
    const variant: string = 'primary';
    const size: string = 'lg';
    const customClass = 'mt-4';

    const result = cn(
      'rounded-lg transition-colors',
      variant === 'primary' && 'bg-near-green-500 text-near-black',
      variant === 'secondary' && 'bg-surface text-text-primary',
      size === 'lg' && 'px-6 py-3',
      size === 'sm' && 'px-3 py-1.5',
      customClass
    );

    expect(result).toBe(
      'rounded-lg transition-colors bg-near-green-500 text-near-black px-6 py-3 mt-4'
    );
  });
});
