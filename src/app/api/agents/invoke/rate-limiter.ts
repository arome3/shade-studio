/**
 * Agent Invocation Rate Limiter
 *
 * Simple in-memory sliding window rate limiter.
 * Tracks request timestamps per agent account ID.
 *
 * Suitable for single-instance deployments.
 * For multi-instance, replace with Redis-backed limiter.
 */

// ============================================================================
// Configuration
// ============================================================================

const MAX_REQUESTS_PER_WINDOW = 60;
const WINDOW_MS = 60_000; // 1 minute

// ============================================================================
// Storage
// ============================================================================

const requestLog = new Map<string, number[]>();

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the client can retry (only set when not allowed) */
  retryAfter?: number;
  /** Remaining requests in the current window */
  remaining: number;
}

/**
 * Check if a request from the given agent account ID is within rate limits.
 *
 * Uses a sliding window algorithm: stores timestamps of recent requests,
 * evicts entries older than the window on each check.
 */
export function checkRateLimit(agentAccountId: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get or create entry
  let timestamps = requestLog.get(agentAccountId);
  if (!timestamps) {
    timestamps = [];
    requestLog.set(agentAccountId, timestamps);
  }

  // Evict old entries
  const validIndex = timestamps.findIndex((t) => t > windowStart);
  if (validIndex > 0) {
    timestamps.splice(0, validIndex);
  } else if (validIndex === -1) {
    timestamps.length = 0;
  }

  // Check limit
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = timestamps[0]!;
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    return {
      allowed: false,
      retryAfter: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    };
  }

  // Record request
  timestamps.push(now);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - timestamps.length,
  };
}

/**
 * Clear rate limit state for testing.
 */
export function clearRateLimits(): void {
  requestLog.clear();
}
