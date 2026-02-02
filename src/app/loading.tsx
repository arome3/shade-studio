/**
 * Global loading component shown during page transitions.
 * Uses Next.js 15 app router loading convention.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative">
          {/* Outer ring */}
          <div className="w-12 h-12 rounded-full border-2 border-border" />
          {/* Spinning arc */}
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-near-green-500 animate-spin" />
        </div>

        {/* Loading text */}
        <p className="text-sm text-text-secondary animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
