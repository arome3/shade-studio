'use client';

import { useEncryption } from '@/hooks/use-encryption';
import { cn } from '@/lib/utils/cn';

export interface EncryptionStatusProps {
  /** Additional CSS classes */
  className?: string;
  /** Show detailed text label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Visual indicator of encryption state.
 * Shows whether documents are encrypted and keys are ready.
 */
export function EncryptionStatus({
  className,
  showLabel = true,
  size = 'md',
}: EncryptionStatusProps) {
  const { status, isReady, isInitializing } = useEncryption();

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  const getStatusColor = () => {
    if (isReady) return 'bg-near-green-500';
    if (isInitializing) return 'bg-warning animate-pulse';
    if (status === 'error') return 'bg-error';
    return 'bg-text-muted';
  };

  const getStatusLabel = () => {
    if (isReady) return 'Encrypted';
    if (isInitializing) return 'Initializing...';
    if (status === 'error') return 'Error';
    return 'Locked';
  };

  const getStatusDescription = () => {
    if (isReady) return 'Your files are encrypted with your wallet key';
    if (isInitializing) return 'Setting up encryption...';
    if (status === 'error') return 'Encryption initialization failed';
    return 'Sign a message to unlock encryption';
  };

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={getStatusDescription()}
    >
      {/* Status dot */}
      <div
        className={cn(
          'rounded-full',
          sizeClasses[size],
          getStatusColor()
        )}
      />

      {/* Label */}
      {showLabel && (
        <span className={cn('text-text-secondary', textClasses[size])}>
          {getStatusLabel()}
        </span>
      )}

      {/* Lock icon for locked state */}
      {status === 'locked' && (
        <svg
          className={cn(
            'text-text-muted',
            size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )}

      {/* Unlock icon for ready state */}
      {isReady && (
        <svg
          className={cn(
            'text-near-green-500',
            size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
          />
        </svg>
      )}
    </div>
  );
}
