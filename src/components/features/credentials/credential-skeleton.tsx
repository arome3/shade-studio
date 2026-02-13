'use client';

import { cn } from '@/lib/utils/cn';

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-surface-hover', className)} />
  );
}

export function CredentialSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <SkeletonPulse className="h-3 w-16 mb-2" />
            <SkeletonPulse className="h-6 w-10" />
          </div>
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <SkeletonPulse className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-4 w-28" />
                <SkeletonPulse className="h-3 w-40" />
              </div>
              <SkeletonPulse className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonPulse className="h-3 w-full" />
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-3 w-24" />
              <SkeletonPulse className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
