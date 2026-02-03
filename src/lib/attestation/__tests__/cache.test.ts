import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  VerificationCache,
  getVerificationCache,
  resetVerificationCache,
  generateCacheKey,
} from '../cache';
import type { TEEAttestation, VerificationResult } from '@/types/attestation';

describe('VerificationCache', () => {
  let cache: VerificationCache;

  const createAttestation = (id: string): TEEAttestation => ({
    tee_type: 'intel-tdx',
    enclave_id: `enclave-${id}`,
    code_hash: `hash-${id}`,
    timestamp: new Date().toISOString(),
  });

  const createResult = (id: string): VerificationResult => ({
    isValid: true,
    status: 'verified',
    message: `Test result ${id}`,
    verifiedAt: new Date().toISOString(),
    totalDurationMs: 100,
    steps: [],
    errors: [],
    warnings: [],
    fromCache: false,
  });

  beforeEach(() => {
    cache = new VerificationCache(10, 60000); // 10 entries, 1 minute TTL
  });

  describe('basic operations', () => {
    it('should store and retrieve a result', () => {
      const attestation = createAttestation('1');
      const result = createResult('1');

      cache.set(attestation, result);
      const retrieved = cache.get(attestation);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.message).toBe('Test result 1');
      expect(retrieved?.fromCache).toBe(true);
    });

    it('should return null for non-existent entry', () => {
      const attestation = createAttestation('nonexistent');
      const retrieved = cache.get(attestation);

      expect(retrieved).toBeNull();
    });

    it('should check existence with has()', () => {
      const attestation = createAttestation('exists');
      const result = createResult('exists');

      expect(cache.has(attestation)).toBe(false);

      cache.set(attestation, result);

      expect(cache.has(attestation)).toBe(true);
    });

    it('should delete entries', () => {
      const attestation = createAttestation('delete-me');
      const result = createResult('delete-me');

      cache.set(attestation, result);
      expect(cache.has(attestation)).toBe(true);

      cache.delete(attestation);
      expect(cache.has(attestation)).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set(createAttestation('1'), createResult('1'));
      cache.set(createAttestation('2'), createResult('2'));
      cache.set(createAttestation('3'), createResult('3'));

      expect(cache.size).toBe(3);

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return null for expired entries on get()', () => {
      const attestation = createAttestation('expiring');
      const result = createResult('expiring');

      cache.set(attestation, result);
      expect(cache.get(attestation)).not.toBeNull();

      // Advance time past TTL
      vi.advanceTimersByTime(61000); // 61 seconds

      expect(cache.get(attestation)).toBeNull();
    });

    it('should return false for expired entries on has()', () => {
      const attestation = createAttestation('has-expiring');
      const result = createResult('has-expiring');

      cache.set(attestation, result);
      expect(cache.has(attestation)).toBe(true);

      vi.advanceTimersByTime(61000);

      expect(cache.has(attestation)).toBe(false);
    });

    it('should prune expired entries', () => {
      cache.set(createAttestation('1'), createResult('1'));
      cache.set(createAttestation('2'), createResult('2'));

      vi.advanceTimersByTime(61000);

      cache.set(createAttestation('3'), createResult('3')); // Fresh entry

      const pruned = cache.prune();

      expect(pruned).toBe(2); // Two expired entries
      expect(cache.size).toBe(1); // Only the fresh one remains
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when at capacity', () => {
      // Fill the cache
      for (let i = 0; i < 10; i++) {
        cache.set(createAttestation(`item-${i}`), createResult(`item-${i}`));
      }

      expect(cache.size).toBe(10);

      // Add one more, should evict the oldest
      cache.set(createAttestation('item-10'), createResult('item-10'));

      expect(cache.size).toBe(10);
      expect(cache.has(createAttestation('item-0'))).toBe(false); // Oldest evicted
      expect(cache.has(createAttestation('item-10'))).toBe(true); // Newest exists
    });

    it('should update position on get (LRU behavior)', () => {
      // Fill the cache
      for (let i = 0; i < 10; i++) {
        cache.set(createAttestation(`lru-${i}`), createResult(`lru-${i}`));
      }

      // Access item-0 to make it recently used
      cache.get(createAttestation('lru-0'));

      // Add new item, should evict item-1 (now oldest)
      cache.set(createAttestation('lru-10'), createResult('lru-10'));

      expect(cache.has(createAttestation('lru-0'))).toBe(true); // Was accessed, kept
      expect(cache.has(createAttestation('lru-1'))).toBe(false); // Not accessed, evicted
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const attestation = createAttestation('stats');
      const result = createResult('stats');

      // Miss
      cache.get(createAttestation('nonexistent'));

      // Store
      cache.set(attestation, result);

      // Hit
      cache.get(attestation);
      cache.get(attestation);

      // Another miss
      cache.get(createAttestation('also-nonexistent'));

      const stats = cache.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(2);
      expect(stats.hitRate).toBe(50); // 2 hits / 4 total = 50%
    });

    it('should report correct size and maxSize', () => {
      cache.set(createAttestation('1'), createResult('1'));
      cache.set(createAttestation('2'), createResult('2'));

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });

    it('should reset stats on clear', () => {
      cache.get(createAttestation('miss'));
      cache.set(createAttestation('1'), createResult('1'));
      cache.get(createAttestation('1'));

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should return all keys', () => {
      cache.set(createAttestation('a'), createResult('a'));
      cache.set(createAttestation('b'), createResult('b'));

      const keys = cache.keys();

      expect(keys.length).toBe(2);
      expect(keys.some((k) => k.includes('enclave-a'))).toBe(true);
      expect(keys.some((k) => k.includes('enclave-b'))).toBe(true);
    });

    it('should return all entries', () => {
      cache.set(createAttestation('x'), createResult('x'));
      cache.set(createAttestation('y'), createResult('y'));

      const entries = cache.entries();

      expect(entries.length).toBe(2);
      expect(entries[0].entry.result).toBeDefined();
      expect(entries[0].entry.createdAt).toBeDefined();
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys', () => {
    const attestation: TEEAttestation = {
      tee_type: 'intel-tdx',
      enclave_id: 'enclave-123',
      code_hash: 'hash-456',
      timestamp: '2024-01-15T12:00:00.000Z',
    };

    const key1 = generateCacheKey(attestation);
    const key2 = generateCacheKey(attestation);

    expect(key1).toBe(key2);
  });

  it('should include tee_type, enclave_id, and timestamp', () => {
    const attestation: TEEAttestation = {
      tee_type: 'AMD-SEV',
      enclave_id: 'my-enclave',
      code_hash: 'hash',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const key = generateCacheKey(attestation);

    expect(key).toContain('amd-sev'); // Lowercase
    expect(key).toContain('my-enclave');
    expect(key).toContain('2024-01-01');
  });

  it('should produce different keys for different attestations', () => {
    const attestation1: TEEAttestation = {
      tee_type: 'intel-tdx',
      enclave_id: 'enclave-1',
      code_hash: 'hash',
      timestamp: '2024-01-15T12:00:00.000Z',
    };

    const attestation2: TEEAttestation = {
      tee_type: 'intel-tdx',
      enclave_id: 'enclave-2',
      code_hash: 'hash',
      timestamp: '2024-01-15T12:00:00.000Z',
    };

    const key1 = generateCacheKey(attestation1);
    const key2 = generateCacheKey(attestation2);

    expect(key1).not.toBe(key2);
  });
});

describe('global cache', () => {
  beforeEach(() => {
    resetVerificationCache();
  });

  it('should return singleton instance', () => {
    const cache1 = getVerificationCache();
    const cache2 = getVerificationCache();

    expect(cache1).toBe(cache2);
  });

  it('should reset properly', () => {
    const cache1 = getVerificationCache();
    cache1.set(
      { tee_type: 'test', enclave_id: 'e', code_hash: 'h', timestamp: new Date().toISOString() },
      { isValid: true, status: 'verified', message: '', verifiedAt: '', totalDurationMs: 0, steps: [], errors: [], warnings: [], fromCache: false }
    );

    expect(cache1.size).toBe(1);

    resetVerificationCache();

    const cache2 = getVerificationCache();
    expect(cache2.size).toBe(0);
    expect(cache1).not.toBe(cache2);
  });
});
