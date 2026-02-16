'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { useMounted } from '@/hooks/use-mounted';
import { useOnWalletDisconnect } from '@/hooks/use-wallet-events';

/** Max time (ms) to wait for reconnection before redirecting */
const RECONNECT_TIMEOUT_MS = 5000;

interface AuthGuardProps {
  /** Content to render when authenticated */
  children: ReactNode;
  /** Content to show while checking auth status (default: loading spinner) */
  fallback?: ReactNode;
  /** Route to redirect to if not authenticated (default: '/') */
  redirectTo?: string;
}

/**
 * Route protection component that requires wallet connection.
 * Redirects to the specified route if the user is not connected.
 *
 * Features:
 * - Shows loading state while checking auth
 * - Redirects if not connected after initialization
 * - Listens for disconnect events and redirects
 * - Times out after 5s to prevent infinite spinner on failed reconnects
 *
 * @example
 * // In a layout or page
 * <AuthGuard redirectTo="/login">
 *   <ProtectedContent />
 * </AuthGuard>
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo = '/',
}: AuthGuardProps) {
  const router = useRouter();
  const mounted = useMounted();
  const { isConnected, isConnecting, isInitialized } = useWallet();
  const [timedOut, setTimedOut] = useState(false);

  // Redirect on disconnect
  useOnWalletDisconnect(() => {
    router.push(redirectTo);
  });

  // Timeout: if still connecting after RECONNECT_TIMEOUT_MS, give up
  useEffect(() => {
    if (!mounted || isConnected || !isConnecting) return;

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, RECONNECT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [mounted, isConnected, isConnecting]);

  // Handle redirect when not connected
  useEffect(() => {
    // Wait for mount and initialization
    if (!mounted || !isInitialized) return;

    // If not connecting and not connected, redirect
    if (!isConnecting && !isConnected) {
      router.push(redirectTo);
    }

    // If reconnection timed out, redirect
    if (timedOut && !isConnected) {
      router.push(redirectTo);
    }
  }, [mounted, isInitialized, isConnecting, isConnected, timedOut, router, redirectTo]);

  // Not mounted yet - prevent hydration issues
  if (!mounted) {
    return fallback ?? <AuthGuardFallback />;
  }

  // Still initializing or connecting (but not timed out)
  if ((!isInitialized || isConnecting) && !timedOut) {
    return fallback ?? <AuthGuardFallback />;
  }

  // Not connected - will redirect, show fallback in meantime
  if (!isConnected) {
    return fallback ?? <AuthGuardFallback />;
  }

  // Connected - render children
  return <>{children}</>;
}

/**
 * Default loading fallback for AuthGuard.
 * Shows a centered loading spinner.
 */
function AuthGuardFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner />
        <p className="text-sm text-text-muted">Checking authentication...</p>
      </div>
    </div>
  );
}

/**
 * Simple loading spinner component.
 */
function LoadingSpinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-near-green-500"
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
  );
}
