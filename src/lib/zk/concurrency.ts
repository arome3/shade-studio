/**
 * Async Semaphore for ZK proof concurrency control.
 *
 * Prevents multiple proof generations from running simultaneously,
 * which would thrash memory and CPU. Uses FIFO queuing so requests
 * are served in order.
 */

// ---------------------------------------------------------------------------
// AsyncSemaphore
// ---------------------------------------------------------------------------

type Resolver = (release: () => void) => void;

/**
 * Async semaphore with FIFO queuing.
 *
 * @example
 * ```ts
 * const sem = new AsyncSemaphore(1);
 * const release = await sem.acquire();
 * try { ... } finally { release(); }
 * ```
 */
export class AsyncSemaphore {
  private permits: number;
  private readonly maxPermits: number;
  private readonly queue: Resolver[] = [];

  constructor(permits = 1) {
    if (permits < 1) throw new Error('Semaphore permits must be >= 1');
    this.permits = permits;
    this.maxPermits = permits;
  }

  /** Number of permits currently available. */
  get available(): number {
    return this.permits;
  }

  /** Number of waiters currently queued. */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Acquire a permit, waiting if none are available.
   * Returns a release function that must be called when done.
   */
  acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve(this.createRelease());
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Non-blocking attempt to acquire a permit.
   * Returns a release function if a permit was available, null otherwise.
   */
  tryAcquire(): (() => void) | null {
    if (this.permits > 0) {
      this.permits--;
      return this.createRelease();
    }
    return null;
  }

  /** Create a one-shot release function. */
  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release();
    };
  }

  /** Internal: return a permit and wake the next waiter. */
  private release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the permit directly to the next waiter (no increment)
      next(this.createRelease());
    } else {
      this.permits = Math.min(this.permits + 1, this.maxPermits);
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton (permits=1 — serialise proof generation)
// ---------------------------------------------------------------------------

let proofSemaphore: AsyncSemaphore | null = null;

/** Get the module-level proof generation semaphore (permits=1). */
export function getProofSemaphore(): AsyncSemaphore {
  if (!proofSemaphore) {
    proofSemaphore = new AsyncSemaphore(1);
  }
  return proofSemaphore;
}
