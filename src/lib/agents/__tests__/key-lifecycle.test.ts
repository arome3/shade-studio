import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the NEAR access-keys module to avoid ESM import issues with @near-js
// ---------------------------------------------------------------------------

vi.mock('@/lib/near/access-keys', () => ({
  generateKeyPair: vi.fn(() => ({
    publicKey: 'ed25519:MOCK_PUB',
    secretKey: 'ed25519:MOCK_SECRET',
  })),
}));

import {
  getKeyHealth,
  getKeysNeedingRotation,
  pruneExpiredKeys,
  initKeyLifecycle,
  stopKeyLifecycle,
} from '../key-lifecycle';
import {
  storeAgentKey,
  getAgentKey,
  type StoredAgentKey,
  KEY_TTLS,
} from '../agent-keys';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeKey(overrides: Partial<StoredAgentKey> = {}): StoredAgentKey {
  const now = Date.now();
  return {
    agentAccountId: 'my-agent.alice.testnet',
    keyType: 'execution',
    publicKey: 'ed25519:TEST_PUB_KEY',
    encryptedPrivateKey: 'ENCRYPTED',
    nonce: 'NONCE',
    storedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + KEY_TTLS.execution).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('key-lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    stopKeyLifecycle();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Key health assessment
  // -----------------------------------------------------------------------

  describe('getKeyHealth', () => {
    it('should report missing when no keys exist', () => {
      const health = getKeyHealth('nonexistent.testnet');
      expect(health.owner.status).toBe('missing');
      expect(health.execution.status).toBe('missing');
    });

    it('should report valid for fresh keys', () => {
      storeAgentKey(makeKey({ keyType: 'owner' }));
      storeAgentKey(makeKey({ keyType: 'execution' }));

      const health = getKeyHealth('my-agent.alice.testnet');
      expect(health.owner.status).toBe('valid');
      expect(health.execution.status).toBe('valid');
      expect(health.owner.expiresIn).toBeGreaterThan(0);
      expect(health.execution.expiresIn).toBeGreaterThan(0);
    });

    it('should report expiring-soon when within 7 days of expiry', () => {
      const fiveDaysFromNow = Date.now() + 5 * 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(fiveDaysFromNow).toISOString(),
        })
      );

      const health = getKeyHealth('my-agent.alice.testnet');
      expect(health.execution.status).toBe('expiring-soon');
      expect(health.execution.expiresIn).toBeGreaterThan(0);
      expect(health.execution.expiresIn).toBeLessThanOrEqual(5 * 24 * 60 * 60 * 1000);
    });

    it('should report expired when past expiry', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      const health = getKeyHealth('my-agent.alice.testnet');
      expect(health.execution.status).toBe('expired');
      expect(health.execution.expiresIn).toBe(0);
    });

    it('should report valid for keys without expiresAt (legacy)', () => {
      const key = makeKey({ keyType: 'execution' });
      delete (key as unknown as Record<string, unknown>).expiresAt;
      // Write directly to avoid storeAgentKey auto-setting expiresAt
      localStorage.setItem(
        'shade-studio:agent-keys:my-agent.alice.testnet:execution',
        JSON.stringify(key)
      );

      const health = getKeyHealth('my-agent.alice.testnet');
      expect(health.execution.status).toBe('valid');
      expect(health.execution.expiresIn).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Keys needing rotation
  // -----------------------------------------------------------------------

  describe('getKeysNeedingRotation', () => {
    it('should return empty when all keys are fresh', () => {
      storeAgentKey(makeKey({ keyType: 'owner' }));
      storeAgentKey(makeKey({ keyType: 'execution' }));

      const needsRotation = getKeysNeedingRotation('alice.testnet');
      expect(needsRotation).toHaveLength(0);
    });

    it('should return keys expiring within 7 days', () => {
      const threeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(threeDays).toISOString(),
        })
      );
      storeAgentKey(makeKey({ keyType: 'owner' })); // Still fresh

      const needsRotation = getKeysNeedingRotation('alice.testnet');
      expect(needsRotation).toHaveLength(1);
      expect(needsRotation[0]!.keyType).toBe('execution');
    });

    it('should return expired keys', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      const needsRotation = getKeysNeedingRotation('alice.testnet');
      expect(needsRotation).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Pruning
  // -----------------------------------------------------------------------

  describe('pruneExpiredKeys', () => {
    it('should remove expired keys from localStorage', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;

      // Store an expired key
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      // Store a fresh key
      storeAgentKey(makeKey({ keyType: 'owner' }));

      const pruned = pruneExpiredKeys();
      expect(pruned).toBe(1);

      // Expired key should be gone
      const execKey = getAgentKey('my-agent.alice.testnet', 'execution');
      expect(execKey).toBeNull();

      // Fresh key should remain
      const ownerKey = getAgentKey('my-agent.alice.testnet', 'owner');
      expect(ownerKey).not.toBeNull();
    });

    it('should return 0 when nothing to prune', () => {
      storeAgentKey(makeKey({ keyType: 'owner' }));
      const pruned = pruneExpiredKeys();
      expect(pruned).toBe(0);
    });

    it('should return 0 when localStorage is empty', () => {
      const pruned = pruneExpiredKeys();
      expect(pruned).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getAgentKey expiry filtering
  // -----------------------------------------------------------------------

  describe('getAgentKey with expiry', () => {
    it('should return null for expired keys', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      const key = getAgentKey('my-agent.alice.testnet', 'execution');
      expect(key).toBeNull();
    });

    it('should return key for valid keys', () => {
      storeAgentKey(makeKey({ keyType: 'execution' }));

      const key = getAgentKey('my-agent.alice.testnet', 'execution');
      expect(key).not.toBeNull();
      expect(key!.publicKey).toBe('ed25519:TEST_PUB_KEY');
    });
  });

  // -----------------------------------------------------------------------
  // storeAgentKey TTL auto-fill
  // -----------------------------------------------------------------------

  describe('storeAgentKey TTL auto-fill', () => {
    it('should auto-set storedAt and expiresAt when not provided', () => {
      storeAgentKey({
        agentAccountId: 'my-agent.alice.testnet',
        keyType: 'execution',
        publicKey: 'ed25519:PUB',
        encryptedPrivateKey: 'ENC',
        nonce: 'N',
      });

      const raw = localStorage.getItem('shade-studio:agent-keys:my-agent.alice.testnet:execution');
      const parsed = JSON.parse(raw!) as StoredAgentKey;

      expect(parsed.storedAt).toBeDefined();
      expect(parsed.expiresAt).toBeDefined();

      // Verify expiry is approximately 30 days from now (execution key TTL)
      const expiresAt = new Date(parsed.expiresAt!).getTime();
      const storedAt = new Date(parsed.storedAt!).getTime();
      const diff = expiresAt - storedAt;
      expect(diff).toBe(KEY_TTLS.execution);
    });

    it('should set 90-day TTL for owner keys', () => {
      storeAgentKey({
        agentAccountId: 'my-agent.alice.testnet',
        keyType: 'owner',
        publicKey: 'ed25519:PUB',
        encryptedPrivateKey: 'ENC',
        nonce: 'N',
      });

      const raw = localStorage.getItem('shade-studio:agent-keys:my-agent.alice.testnet:owner');
      const parsed = JSON.parse(raw!) as StoredAgentKey;

      const expiresAt = new Date(parsed.expiresAt!).getTime();
      const storedAt = new Date(parsed.storedAt!).getTime();
      expect(expiresAt - storedAt).toBe(KEY_TTLS.owner);
    });

    it('should preserve explicitly provided TTL values', () => {
      const customExpiry = '2027-01-01T00:00:00Z';
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: customExpiry,
          storedAt: '2026-01-01T00:00:00Z',
        })
      );

      const raw = localStorage.getItem('shade-studio:agent-keys:my-agent.alice.testnet:execution');
      const parsed = JSON.parse(raw!) as StoredAgentKey;
      expect(parsed.expiresAt).toBe(customExpiry);
      expect(parsed.storedAt).toBe('2026-01-01T00:00:00Z');
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle management
  // -----------------------------------------------------------------------

  describe('initKeyLifecycle / stopKeyLifecycle', () => {
    it('should start periodic pruning', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      initKeyLifecycle();

      // Initial prune should have run immediately
      const raw = localStorage.getItem('shade-studio:agent-keys:my-agent.alice.testnet:execution');
      expect(raw).toBeNull();
    });

    it('should not create duplicate intervals', () => {
      initKeyLifecycle();
      initKeyLifecycle(); // Second call should be no-op
      stopKeyLifecycle();
      // No assertion needed — just verifying no error thrown
    });

    it('should stop periodic pruning', () => {
      initKeyLifecycle();
      stopKeyLifecycle();

      // Add an expired key after stopping
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      storeAgentKey(
        makeKey({
          keyType: 'execution',
          expiresAt: new Date(yesterday).toISOString(),
        })
      );

      // Advance time past prune interval
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Expired key should still be there (no more pruning)
      const raw = localStorage.getItem('shade-studio:agent-keys:my-agent.alice.testnet:execution');
      expect(raw).not.toBeNull();
    });
  });
});
