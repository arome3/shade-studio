/**
 * Agent Key Storage
 *
 * Encrypted localStorage CRUD for agent keypairs, scoped by agent
 * account ID and key type (owner/execution). Follows the same pattern
 * as src/lib/near/access-keys.ts but with agent-specific scoping.
 *
 * Private keys are stored encrypted — encryption happens at the hook
 * layer via useEncryption().
 */

import { generateKeyPair } from '@/lib/near/access-keys';
import type { GeneratedKeyPair } from '@/lib/near/access-keys';

// ============================================================================
// Types
// ============================================================================

/** Key type distinguishes owner (FullAccess) from execution (FunctionCall) keys */
export type AgentKeyType = 'owner' | 'execution';

/** Default TTLs for each key type (milliseconds) */
export const KEY_TTLS: Record<AgentKeyType, number> = {
  owner: 90 * 24 * 60 * 60 * 1000,     // 90 days for owner keys
  execution: 30 * 24 * 60 * 60 * 1000,  // 30 days for execution keys
};

/** Stored agent key shape */
export interface StoredAgentKey {
  /** Agent account ID this key belongs to */
  agentAccountId: string;
  /** Key type */
  keyType: AgentKeyType;
  /** Public key (ed25519:...) */
  publicKey: string;
  /** Encrypted private key (encrypted by useEncryption) */
  encryptedPrivateKey: string;
  /** Encryption nonce */
  nonce: string;
  /** ISO 8601 timestamp when stored */
  storedAt?: string;
  /** ISO 8601 timestamp when key expires */
  expiresAt?: string;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_PREFIX = 'shade-studio:agent-keys';

function buildStorageKey(agentAccountId: string, keyType: AgentKeyType): string {
  return `${STORAGE_PREFIX}:${agentAccountId}:${keyType}`;
}

function buildAgentPrefix(agentAccountId: string): string {
  return `${STORAGE_PREFIX}:${agentAccountId}:`;
}

// ============================================================================
// Key Generation (delegates to near/access-keys)
// ============================================================================

export { generateKeyPair };
export type { GeneratedKeyPair };

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store an encrypted agent key in localStorage.
 * The private key should already be encrypted by the caller.
 * Automatically sets storedAt and expiresAt if not provided.
 */
export function storeAgentKey(key: StoredAgentKey): void {
  const storageKey = buildStorageKey(key.agentAccountId, key.keyType);
  const now = new Date();
  const ttl = KEY_TTLS[key.keyType];
  const enriched: StoredAgentKey = {
    ...key,
    storedAt: key.storedAt ?? now.toISOString(),
    expiresAt: key.expiresAt ?? new Date(now.getTime() + ttl).toISOString(),
  };
  localStorage.setItem(storageKey, JSON.stringify(enriched));
}

/**
 * Check if a stored key has expired.
 * Keys without expiresAt (legacy) are treated as non-expiring.
 */
export function isKeyExpired(key: StoredAgentKey): boolean {
  if (!key.expiresAt) return false;
  return Date.now() > new Date(key.expiresAt).getTime();
}

/**
 * Prune all expired keys from localStorage.
 * Returns the count of pruned keys.
 */
export function pruneExpiredKeysFromStorage(): number {
  const prefix = STORAGE_PREFIX;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          const key = JSON.parse(value) as StoredAgentKey;
          if (isKeyExpired(key)) {
            keysToRemove.push(storageKey);
          }
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  return keysToRemove.length;
}

/**
 * Retrieve all encrypted keys for an agent account.
 */
export function getAgentKeys(agentAccountId: string): StoredAgentKey[] {
  const prefix = buildAgentPrefix(agentAccountId);
  const keys: StoredAgentKey[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          keys.push(JSON.parse(value) as StoredAgentKey);
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  return keys;
}

/**
 * Retrieve a specific key type for an agent.
 * Returns null if key is expired.
 */
export function getAgentKey(
  agentAccountId: string,
  keyType: AgentKeyType
): StoredAgentKey | null {
  const storageKey = buildStorageKey(agentAccountId, keyType);
  try {
    const value = localStorage.getItem(storageKey);
    if (value) {
      const key = JSON.parse(value) as StoredAgentKey;
      if (isKeyExpired(key)) return null;
      return key;
    }
  } catch {
    // Skip malformed entry
  }
  return null;
}

/**
 * Remove a specific key for an agent.
 */
export function removeAgentKey(
  agentAccountId: string,
  keyType: AgentKeyType
): void {
  const storageKey = buildStorageKey(agentAccountId, keyType);
  localStorage.removeItem(storageKey);
}

/**
 * Clear all keys for an agent account.
 */
export function clearAllAgentKeys(agentAccountId: string): void {
  const prefix = buildAgentPrefix(agentAccountId);
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      keysToRemove.push(storageKey);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
