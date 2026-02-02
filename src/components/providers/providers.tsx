'use client';

import { type ReactNode } from 'react';
import { ErrorBoundary } from './error-boundary';
import { WalletProvider } from './wallet-provider';
import { EncryptionProvider } from './encryption-provider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers wrapper component.
 * Wraps the application with all necessary context providers.
 *
 * Provider order (outermost to innermost):
 * 1. ErrorBoundary - Catches and handles React errors
 * 2. WalletProvider - Initializes NEAR wallet selector
 * 3. EncryptionProvider - Manages encryption key lifecycle
 *
 * Future additions (in subsequent modules):
 * - ToastProvider for notifications
 * - ThemeProvider if light mode is added
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, this would send to error tracking service
        if (process.env.NODE_ENV === 'development') {
          console.error('App Error:', error);
          console.error('Error Info:', errorInfo);
        }
      }}
    >
      <WalletProvider>
        <EncryptionProvider>{children}</EncryptionProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
}
