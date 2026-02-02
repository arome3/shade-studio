import Link from 'next/link';

/**
 * Custom 404 page with NEAR branding.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full mb-8">
          <div className="w-2 h-2 rounded-full bg-error" />
          <span className="text-sm text-text-secondary">Page Not Found</span>
        </div>

        {/* Large 404 */}
        <h1 className="text-8xl font-bold mb-4">
          <span className="text-gradient">404</span>
        </h1>

        {/* Message */}
        <p className="text-xl text-text-secondary mb-2">
          Oops! This page doesn&apos;t exist.
        </p>
        <p className="text-text-muted mb-8">
          The page you&apos;re looking for might have been moved or deleted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-3 bg-near-green-500 text-near-black font-semibold rounded-lg hover:bg-near-green-400 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-surface border border-border text-text-primary font-semibold rounded-lg hover:bg-surface-hover hover:border-border-hover transition-colors"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
