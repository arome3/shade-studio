'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0F1419] font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-[#00EC97] px-6 py-2.5 text-sm font-semibold text-[#0F1419] transition-colors hover:bg-[#00D488]"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
