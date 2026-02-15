/**
 * Job Poller
 *
 * Reusable polling utility for tracking async AI job status.
 * Uses adaptive backoff — slows down when status is unchanged,
 * resets to base interval on status changes for responsiveness.
 */

import type { AIJob, AIJobCheckpoint, AIJobStatus } from '@/types/async-ai';
import { getAsyncJob } from './async-processor';

// ============================================================================
// Types
// ============================================================================

export interface JobPollerOptions {
  /** Base polling interval in ms (default 3000) */
  intervalMs?: number;
  /** Maximum poll attempts before timeout (default 200 = ~10 min) */
  maxPollAttempts?: number;
  /** Backoff multiplier when status unchanged (default 1.5) */
  backoffMultiplier?: number;
  /** Maximum interval after backoff in ms (default 15000) */
  maxIntervalMs?: number;
  /** Called when job status changes */
  onStatusChange?: (job: AIJob) => void;
  /** Called when a new checkpoint is received */
  onCheckpoint?: (checkpoint: AIJobCheckpoint) => void;
  /** Called when job reaches completed status */
  onComplete?: (job: AIJob) => void;
  /** Called on unrecoverable error */
  onError?: (error: Error) => void;
  /** Called when max attempts reached */
  onTimeout?: () => void;
}

// ============================================================================
// JobPoller class
// ============================================================================

export class JobPoller {
  private readonly jobId: string;
  private readonly intervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly backoffMultiplier: number;
  private readonly maxIntervalMs: number;
  private readonly onStatusChange?: (job: AIJob) => void;
  private readonly onCheckpoint?: (checkpoint: AIJobCheckpoint) => void;
  private readonly onComplete?: (job: AIJob) => void;
  private readonly onError?: (error: Error) => void;
  private readonly onTimeout?: () => void;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private currentInterval: number;
  private pollCount = 0;
  private consecutiveErrors = 0;
  private lastStatus: AIJobStatus | null = null;
  private lastCheckpointTimestamp: string | null = null;
  private running = false;

  constructor(jobId: string, options: JobPollerOptions = {}) {
    this.jobId = jobId;
    this.intervalMs = options.intervalMs ?? 3000;
    this.maxPollAttempts = options.maxPollAttempts ?? 200;
    this.backoffMultiplier = options.backoffMultiplier ?? 1.5;
    this.maxIntervalMs = options.maxIntervalMs ?? 15000;
    this.onStatusChange = options.onStatusChange;
    this.onCheckpoint = options.onCheckpoint;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.onTimeout = options.onTimeout;
    this.currentInterval = this.intervalMs;
  }

  /** Start polling. Idempotent — calling start() when already running is a no-op. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollCount = 0;
    this.consecutiveErrors = 0;
    this.currentInterval = this.intervalMs;
    this.scheduleNext();
  }

  /** Stop polling and clear any pending timer. */
  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /** Whether the poller is currently running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Last observed job status. */
  getLastStatus(): AIJobStatus | null {
    return this.lastStatus;
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private scheduleNext(): void {
    if (!this.running) return;
    this.timerId = setTimeout(() => this.poll(), this.currentInterval);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    this.pollCount++;

    // Check timeout
    if (this.pollCount > this.maxPollAttempts) {
      this.stop();
      this.onTimeout?.();
      return;
    }

    try {
      const job = await getAsyncJob(this.jobId);

      if (!job) {
        // Job not found — might have been cancelled
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 3) {
          this.stop();
          this.onError?.(new Error(`Job ${this.jobId} not found`));
          return;
        }
        this.scheduleNext();
        return;
      }

      // Reset consecutive errors on successful fetch
      this.consecutiveErrors = 0;

      // Check for status change
      const statusChanged = this.lastStatus !== null && this.lastStatus !== job.status;
      this.lastStatus = job.status;

      if (statusChanged) {
        // Reset interval on status change for responsiveness
        this.currentInterval = this.intervalMs;
        this.onStatusChange?.(job);
      } else {
        // Backoff when status unchanged
        this.currentInterval = Math.min(
          this.currentInterval * this.backoffMultiplier,
          this.maxIntervalMs
        );
      }

      // First poll always triggers onStatusChange to set initial state
      if (this.pollCount === 1 && !statusChanged) {
        this.onStatusChange?.(job);
      }

      // Check for new checkpoint
      if (
        job.checkpoint &&
        job.checkpoint.timestamp !== this.lastCheckpointTimestamp
      ) {
        this.lastCheckpointTimestamp = job.checkpoint.timestamp;
        this.onCheckpoint?.(job.checkpoint);
      }

      // Check for terminal states
      if (job.status === 'completed') {
        this.stop();
        this.onComplete?.(job);
        return;
      }
      if (job.status === 'failed' || job.status === 'timeout') {
        this.stop();
        this.onStatusChange?.(job);
        return;
      }

      // Continue polling
      this.scheduleNext();
    } catch (err) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 3) {
        this.stop();
        this.onError?.(
          err instanceof Error ? err : new Error(String(err))
        );
        return;
      }
      // Tolerate transient failures — keep polling
      this.scheduleNext();
    }
  }
}
