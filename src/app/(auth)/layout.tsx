import { AuthGuard } from '@/components/features/auth';

/**
 * Auth group layout for protected routes.
 * Wraps children with AuthGuard to require wallet connection.
 *
 * Features:
 * - Requires wallet connection to view
 * - Redirects to home if not connected
 * - Shows loading state while checking auth
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard redirectTo="/">
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </AuthGuard>
  );
}
