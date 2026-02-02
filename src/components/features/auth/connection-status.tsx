'use client';

import { useConnectionStatus } from '@/stores/auth-store';
import { useMounted } from '@/hooks/use-mounted';
import { cn } from '@/lib/utils/cn';
import { type ConnectionStatus as ConnectionStatusType } from '@/stores/auth-store';

interface ConnectionStatusProps {
  /** Show label text next to the indicator */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Visual connection status indicator.
 * Shows a colored dot based on the current wallet connection status.
 *
 * | Status       | Color  | Animation |
 * |--------------|--------|-----------|
 * | disconnected | gray   | none      |
 * | connecting   | yellow | pulse     |
 * | connected    | green  | none      |
 * | reconnecting | yellow | pulse     |
 * | error        | red    | none      |
 *
 * @example
 * // Dot only
 * <ConnectionStatus />
 *
 * // With label
 * <ConnectionStatus showLabel />
 */
export function ConnectionStatus({
  showLabel = false,
  className,
}: ConnectionStatusProps) {
  const mounted = useMounted();
  const status = useConnectionStatus();

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <StatusDot status="disconnected" />
        {showLabel && (
          <span className="text-xs text-text-muted">Disconnected</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StatusDot status={status} />
      {showLabel && <StatusLabel status={status} />}
    </div>
  );
}

/**
 * The colored dot indicator.
 */
function StatusDot({ status }: { status: ConnectionStatusType }) {
  const isAnimated = status === 'connecting' || status === 'reconnecting';

  return (
    <span className="relative flex h-2.5 w-2.5">
      {/* Pulse animation ring */}
      {isAnimated && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            getStatusColor(status, true)
          )}
        />
      )}
      {/* Solid dot */}
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          getStatusColor(status)
        )}
      />
    </span>
  );
}

/**
 * Text label showing the status.
 */
function StatusLabel({ status }: { status: ConnectionStatusType }) {
  const labels: Record<ConnectionStatusType, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    error: 'Connection Error',
  };

  return (
    <span
      className={cn(
        'text-xs',
        status === 'connected' ? 'text-near-green-500' : 'text-text-muted',
        status === 'error' && 'text-error'
      )}
    >
      {labels[status]}
    </span>
  );
}

/**
 * Get the appropriate color class for a status.
 */
function getStatusColor(
  status: ConnectionStatusType,
  isBackground = false
): string {
  const colors: Record<ConnectionStatusType, string> = {
    disconnected: isBackground ? 'bg-text-muted' : 'bg-text-muted',
    connecting: isBackground ? 'bg-warning' : 'bg-warning',
    connected: isBackground ? 'bg-near-green-500' : 'bg-near-green-500',
    reconnecting: isBackground ? 'bg-warning' : 'bg-warning',
    error: isBackground ? 'bg-error' : 'bg-error',
  };

  return colors[status];
}
