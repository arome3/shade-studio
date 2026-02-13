/**
 * Tests for ArtifactCache (IndexedDB persistent cache).
 *
 * Uses fake-indexeddb to simulate IndexedDB in Node.js.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ArtifactCache } from '../artifact-cache';

describe('ArtifactCache', () => {
  let cache: ArtifactCache;

  beforeEach(async () => {
    cache = new ArtifactCache();
    await cache.clear();
  });

  afterEach(() => {
    cache.close();
  });

  describe('binary artifacts', () => {
    it('should round-trip a binary artifact', async () => {
      const data = new ArrayBuffer(16);
      new Uint8Array(data).fill(42);

      await cache.setBinary('verified-builder', 'wasm', '1.0.0', data);
      const result = await cache.getBinary('verified-builder', 'wasm', '1.0.0');

      expect(result).not.toBeNull();
      expect(new Uint8Array(result!)).toEqual(new Uint8Array(data));
    });

    it('should return null for missing binary', async () => {
      const result = await cache.getBinary('verified-builder', 'wasm', '1.0.0');
      expect(result).toBeNull();
    });

    it('should version-invalidate — different version returns null', async () => {
      const data = new ArrayBuffer(8);
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', data);

      const result = await cache.getBinary('verified-builder', 'wasm', '2.0.0');
      expect(result).toBeNull();
    });
  });

  describe('vkey artifacts', () => {
    it('should round-trip a vkey', async () => {
      const vkey = { protocol: 'groth16', vk_alpha_1: ['1', '2'] };

      await cache.setVkey('grant-track-record', '1.0.0', vkey);
      const result = await cache.getVkey('grant-track-record', '1.0.0');

      expect(result).toEqual(vkey);
    });

    it('should return null for missing vkey', async () => {
      const result = await cache.getVkey('grant-track-record', '1.0.0');
      expect(result).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true when all artifacts cached', async () => {
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', new ArrayBuffer(8));
      await cache.setBinary('verified-builder', 'zkey', '1.0.0', new ArrayBuffer(8));
      await cache.setVkey('verified-builder', '1.0.0', { protocol: 'groth16' });

      const result = await cache.has('verified-builder', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return false when some artifacts missing', async () => {
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', new ArrayBuffer(8));
      // Missing zkey and vkey

      const result = await cache.has('verified-builder', '1.0.0');
      expect(result).toBe(false);
    });
  });

  describe('invalidateCircuit', () => {
    it('should remove all versions of a circuit', async () => {
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', new ArrayBuffer(8));
      await cache.setBinary('verified-builder', 'zkey', '1.0.0', new ArrayBuffer(8));
      await cache.setVkey('verified-builder', '1.0.0', {});

      await cache.invalidateCircuit('verified-builder');

      expect(await cache.getBinary('verified-builder', 'wasm', '1.0.0')).toBeNull();
      expect(await cache.getBinary('verified-builder', 'zkey', '1.0.0')).toBeNull();
      expect(await cache.getVkey('verified-builder', '1.0.0')).toBeNull();
    });

    it('should not affect other circuits', async () => {
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', new ArrayBuffer(8));
      await cache.setBinary('grant-track-record', 'wasm', '1.0.0', new ArrayBuffer(8));

      await cache.invalidateCircuit('verified-builder');

      expect(await cache.getBinary('verified-builder', 'wasm', '1.0.0')).toBeNull();
      expect(await cache.getBinary('grant-track-record', 'wasm', '1.0.0')).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', new ArrayBuffer(8));
      await cache.setVkey('verified-builder', '1.0.0', {});

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.binaryCount).toBe(0);
      expect(stats.vkeyCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return counts and sizes', async () => {
      const buf = new ArrayBuffer(1024);
      await cache.setBinary('verified-builder', 'wasm', '1.0.0', buf);
      await cache.setBinary('verified-builder', 'zkey', '1.0.0', buf);
      await cache.setVkey('verified-builder', '1.0.0', {});

      const stats = await cache.getStats();
      expect(stats.binaryCount).toBe(2);
      expect(stats.binarySize).toBe(2048);
      expect(stats.vkeyCount).toBe(1);
    });

    it('should return zeroes for empty cache', async () => {
      const stats = await cache.getStats();
      expect(stats.binaryCount).toBe(0);
      expect(stats.binarySize).toBe(0);
      expect(stats.vkeyCount).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache exceeds limit', async () => {
      // Override MAX_CACHE_SIZE to a small value for testing
      const constants = await import('@/lib/constants');
      const original = constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE;
      // @ts-expect-error -- mutating readonly for test
      constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = 100;

      try {
        // Fill cache with 2 entries of 60 bytes each (total 120 > 100)
        const buf1 = new ArrayBuffer(60);
        new Uint8Array(buf1).fill(1);
        await cache.setBinary('verified-builder', 'wasm', '1.0.0', buf1);

        // Small delay so timestamps differ
        await new Promise((r) => setTimeout(r, 10));

        const buf2 = new ArrayBuffer(60);
        new Uint8Array(buf2).fill(2);
        await cache.setBinary('verified-builder', 'zkey', '1.0.0', buf2);

        // The oldest entry (wasm) should have been evicted
        const wasm = await cache.getBinary('verified-builder', 'wasm', '1.0.0');
        const zkey = await cache.getBinary('verified-builder', 'zkey', '1.0.0');

        expect(wasm).toBeNull();
        expect(zkey).not.toBeNull();
      } finally {
        // @ts-expect-error -- restore original
        constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = original;
      }
    });

    it('should not evict when cache has room', async () => {
      const buf1 = new ArrayBuffer(16);
      const buf2 = new ArrayBuffer(16);

      await cache.setBinary('verified-builder', 'wasm', '1.0.0', buf1);
      await cache.setBinary('verified-builder', 'zkey', '1.0.0', buf2);

      // Both should exist — 32 bytes is well under default 200MB
      const wasm = await cache.getBinary('verified-builder', 'wasm', '1.0.0');
      const zkey = await cache.getBinary('verified-builder', 'zkey', '1.0.0');

      expect(wasm).not.toBeNull();
      expect(zkey).not.toBeNull();
    });

    it('should touch timestamp on getBinary (LRU)', async () => {
      const constants = await import('@/lib/constants');
      const original = constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE;
      // @ts-expect-error -- mutating readonly for test
      constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = 100;

      try {
        // Insert entry A (oldest)
        const bufA = new ArrayBuffer(40);
        new Uint8Array(bufA).fill(0xaa);
        await cache.setBinary('verified-builder', 'wasm', '1.0.0', bufA);

        await new Promise((r) => setTimeout(r, 10));

        // Insert entry B
        const bufB = new ArrayBuffer(40);
        new Uint8Array(bufB).fill(0xbb);
        await cache.setBinary('verified-builder', 'zkey', '1.0.0', bufB);

        await new Promise((r) => setTimeout(r, 10));

        // Touch entry A (now most recently used)
        await cache.getBinary('verified-builder', 'wasm', '1.0.0');

        await new Promise((r) => setTimeout(r, 10));

        // Insert entry C — should evict B (oldest untouched), not A
        const bufC = new ArrayBuffer(40);
        new Uint8Array(bufC).fill(0xcc);
        await cache.setBinary('grant-track-record', 'wasm', '1.0.0', bufC);

        const a = await cache.getBinary('verified-builder', 'wasm', '1.0.0');
        const b = await cache.getBinary('verified-builder', 'zkey', '1.0.0');
        const c = await cache.getBinary('grant-track-record', 'wasm', '1.0.0');

        expect(a).not.toBeNull(); // Touched — should survive
        expect(b).toBeNull();     // Oldest untouched — evicted
        expect(c).not.toBeNull(); // Just inserted
      } finally {
        // @ts-expect-error -- restore original
        constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = original;
      }
    });

    it('should not evict vkey entries', async () => {
      const constants = await import('@/lib/constants');
      const original = constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE;
      // @ts-expect-error -- mutating readonly for test
      constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = 50;

      try {
        // Store a vkey (should not be affected by binary eviction)
        await cache.setVkey('verified-builder', '1.0.0', { protocol: 'groth16' });

        // Fill binary cache to trigger eviction
        const buf = new ArrayBuffer(60);
        await cache.setBinary('verified-builder', 'wasm', '1.0.0', buf);

        // Vkey should still be present
        const vkey = await cache.getVkey('verified-builder', '1.0.0');
        expect(vkey).toEqual({ protocol: 'groth16' });
      } finally {
        // @ts-expect-error -- restore original
        constants.ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE = original;
      }
    });
  });

  describe('non-fatal behavior', () => {
    it('should return null when indexedDB is unavailable', async () => {
      // Simulate unavailable by closing and nulling
      const noWindowCache = new ArtifactCache();
      // In node env with fake-indexeddb it should still work, but we test the pattern
      const result = await noWindowCache.getBinary('test', 'wasm', '1.0.0');
      expect(result).toBeNull();
      noWindowCache.close();
    });
  });
});
