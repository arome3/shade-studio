/**
 * Tests for AsyncSemaphore and getProofSemaphore.
 * Pure logic — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { AsyncSemaphore, getProofSemaphore } from '../concurrency';

describe('AsyncSemaphore', () => {
  describe('constructor', () => {
    it('should default to 1 permit', () => {
      const sem = new AsyncSemaphore();
      expect(sem.available).toBe(1);
      expect(sem.pending).toBe(0);
    });

    it('should accept custom permit count', () => {
      const sem = new AsyncSemaphore(3);
      expect(sem.available).toBe(3);
    });

    it('should throw for permits < 1', () => {
      expect(() => new AsyncSemaphore(0)).toThrow('permits must be >= 1');
      expect(() => new AsyncSemaphore(-1)).toThrow('permits must be >= 1');
    });
  });

  describe('acquire / release', () => {
    it('should acquire immediately when permit available', async () => {
      const sem = new AsyncSemaphore(1);
      const release = await sem.acquire();

      expect(sem.available).toBe(0);
      release();
      expect(sem.available).toBe(1);
    });

    it('should queue when no permits available', async () => {
      const sem = new AsyncSemaphore(1);
      const release1 = await sem.acquire();

      expect(sem.available).toBe(0);
      expect(sem.pending).toBe(0);

      // This acquire will wait
      let acquired = false;
      const p = sem.acquire().then((rel) => {
        acquired = true;
        return rel;
      });

      // Still pending
      expect(sem.pending).toBe(1);
      expect(acquired).toBe(false);

      // Release first — should wake second
      release1();
      const release2 = await p;

      expect(acquired).toBe(true);
      expect(sem.pending).toBe(0);
      expect(sem.available).toBe(0);

      release2();
      expect(sem.available).toBe(1);
    });

    it('should serve waiters in FIFO order', async () => {
      const sem = new AsyncSemaphore(1);
      const release1 = await sem.acquire();

      const order: number[] = [];

      const p2 = sem.acquire().then((rel) => {
        order.push(2);
        return rel;
      });
      const p3 = sem.acquire().then((rel) => {
        order.push(3);
        return rel;
      });

      expect(sem.pending).toBe(2);

      // Release first permit — should wake #2 first
      release1();
      const release2 = await p2;

      // Release second — should wake #3
      release2();
      const release3 = await p3;

      expect(order).toEqual([2, 3]);
      release3();
    });

    it('should handle multiple permits', async () => {
      const sem = new AsyncSemaphore(2);
      const r1 = await sem.acquire();
      const r2 = await sem.acquire();

      expect(sem.available).toBe(0);

      r1();
      expect(sem.available).toBe(1);

      r2();
      expect(sem.available).toBe(2);
    });

    it('should be safe to release multiple times (no-op)', async () => {
      const sem = new AsyncSemaphore(1);
      const release = await sem.acquire();

      release();
      release(); // Should be a no-op
      release(); // Should be a no-op

      expect(sem.available).toBe(1); // Not 3
    });
  });

  describe('tryAcquire', () => {
    it('should return release function when permit available', () => {
      const sem = new AsyncSemaphore(1);
      const release = sem.tryAcquire();

      expect(release).not.toBeNull();
      expect(sem.available).toBe(0);

      release!();
      expect(sem.available).toBe(1);
    });

    it('should return null when no permits available', async () => {
      const sem = new AsyncSemaphore(1);
      await sem.acquire(); // Take the only permit

      const result = sem.tryAcquire();
      expect(result).toBeNull();
    });
  });
});

describe('getProofSemaphore', () => {
  it('should return a singleton', () => {
    const s1 = getProofSemaphore();
    const s2 = getProofSemaphore();
    expect(s1).toBe(s2);
  });

  it('should have 1 permit', () => {
    const sem = getProofSemaphore();
    expect(sem.available).toBeLessThanOrEqual(1);
  });
});
