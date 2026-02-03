/**
 * Verification Result Cache
 *
 * In-memory LRU cache for attestation verification results.
 * Prevents redundant verification of the same attestation data.
 */

import type {
  TEEAttestation,
  VerificationResult,
  CacheEntry,
  CacheStats,
} from '@/types/attestation';
import {
  MAX_CACHE_ENTRIES,
  VERIFICATION_CACHE_TTL_MS,
} from './constants';

/**
 * Generate a cache key from attestation data.
 * Format: ${tee_type}:${enclave_id}:${timestamp}
 */
export function generateCacheKey(attestation: TEEAttestation): string {
  const teeType = attestation.tee_type.toLowerCase();
  const enclaveId = attestation.enclave_id;
  const timestamp = attestation.timestamp;
  return `${teeType}:${enclaveId}:${timestamp}`;
}

/**
 * Verification cache with LRU eviction and TTL support.
 *
 * Features:
 * - Maximum entry limit with LRU eviction
 * - TTL-based expiration
 * - Hit/miss statistics
 * - Thread-safe for browser environment
 */
export class VerificationCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private totalHits: number = 0;
  private totalMisses: number = 0;

  constructor(maxSize: number = MAX_CACHE_ENTRIES, ttlMs: number = VERIFICATION_CACHE_TTL_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get a cached verification result.
   * Returns null if not found or expired.
   */
  get(attestation: TEEAttestation): VerificationResult | null {
    const key = generateCacheKey(attestation);
    const entry = this.cache.get(key);

    if (!entry) {
      this.totalMisses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.totalMisses++;
      return null;
    }

    // Update hit count and move to end (most recently used)
    entry.hitCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.totalHits++;

    // Return result with cache flag
    return {
      ...entry.result,
      fromCache: true,
      cacheKey: key,
    };
  }

  /**
   * Store a verification result in cache.
   */
  set(attestation: TEEAttestation, result: VerificationResult): void {
    const key = generateCacheKey(attestation);
    const now = Date.now();

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      result: {
        ...result,
        cacheKey: key,
      },
      createdAt: now,
      expiresAt: now + this.ttlMs,
      hitCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if an attestation has a valid cached result.
   */
  has(attestation: TEEAttestation): boolean {
    const key = generateCacheKey(attestation);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific entry from cache.
   */
  delete(attestation: TEEAttestation): boolean {
    const key = generateCacheKey(attestation);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Remove all expired entries.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const totalRequests = this.totalHits + this.totalMisses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0,
    };
  }

  /**
   * Get the current size of the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys (for debugging).
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all entries (for debugging).
   */
  entries(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
    }));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global verification cache instance */
let globalCache: VerificationCache | null = null;

/**
 * Get the global verification cache instance.
 * Creates one if it doesn't exist.
 */
export function getVerificationCache(): VerificationCache {
  if (!globalCache) {
    globalCache = new VerificationCache();
  }
  return globalCache;
}

/**
 * Reset the global cache (useful for testing).
 */
export function resetVerificationCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
  globalCache = null;
}
