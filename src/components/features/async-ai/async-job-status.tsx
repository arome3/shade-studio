'use client';

import { useState } from 'react';
import {
  Brain,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAIJob } from '@/hooks/use-async-ai-job';
import { JobProgressCard } from './job-progress-card';
import { SubmitJobDialog } from './submit-job-dialog';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AsyncJobStatus() {
  const {
    jobs,
    activeJobs,
    completedJobs,
    isFetching,
    isSubmitting,
    error,
    isConnected,
    submitJob,
    cancelJob,
    trackJob,
    refreshJobs,
    clearError,
    retryLastAction,
  } = useAsyncAIJob();

  const [dialogOpen, setDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Guard cascade
  // ---------------------------------------------------------------------------

  // 1. Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Brain className="h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-sm text-text-muted max-w-sm">
          Connect your NEAR wallet to submit and track async AI pipeline jobs.
        </p>
      </div>
    );
  }

  // 2. Loading (initial fetch)
  if (isFetching && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-text-muted animate-spin mb-4" />
        <p className="text-sm text-text-muted">Loading pipeline jobs...</p>
      </div>
    );
  }

  // 3. Error with no data
  if (error && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-error mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Failed to Load Jobs
        </h3>
        <p className="text-sm text-text-muted max-w-sm mb-4">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearError}>
            Dismiss
          </Button>
          <Button size="sm" onClick={retryLastAction}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // 4. Empty state
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          No Pipeline Jobs
        </h3>
        <p className="text-sm text-text-muted max-w-sm mb-4">
          Submit your first async AI analysis job to get started.
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Submit Job
        </Button>
        <SubmitJobDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={submitJob}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Full content
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          AI Pipelines
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refreshJobs}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-error hover:text-error"
            onClick={clearError}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Active Pipelines */}
      {activeJobs.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text-muted">
            Active Pipelines ({activeJobs.length})
          </h3>
          <div className="grid gap-3">
            {activeJobs.map((job) => (
              <JobProgressCard
                key={job.id}
                job={job}
                onCancel={cancelJob}
                onTrack={trackJob}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completedJobs.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text-muted">
            Completed ({completedJobs.length})
          </h3>
          <div className="grid gap-3">
            {completedJobs.map((job) => (
              <JobProgressCard
                key={job.id}
                job={job}
              />
            ))}
          </div>
        </section>
      )}

      {/* Submit dialog */}
      <SubmitJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={submitJob}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
