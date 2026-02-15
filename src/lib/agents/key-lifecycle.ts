/**
 * Key Lifecycle Management
 *
 * Periodic pruning of expired keys, health status reporting,
 * and rotation support for agent keys.
 */

import {
  pruneExpiredKeysFromStorage,
  type AgentKeyType,
  type StoredAgentKey,
} from './agent-keys';

// ============================================================================
// Types
// ============================================================================

export type KeyStatus = 'valid' | 'expiring-soon' | 'expired' | 'missing';

export interface KeyHealth {
  status: KeyStatus;
  /** Milliseconds until expiry (undefined if missing or no expiresAt) */
  expiresIn?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Keys expiring within 7 days are "expiring-soon" */
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

/** Pruning interval: every 5 minutes */
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

// ============================================================================
// Health Assessment
// ============================================================================

function assessKeyHealth(key: StoredAgentKey | null): KeyHealth {
  if (!key) return { status: 'missing' };
  if (!key.expiresAt) return { status: 'valid' };

  const expiresAt = new Date(key.expiresAt).getTime();
  const now = Date.now();
  const expiresIn = expiresAt - now;

  if (expiresIn <= 0) return { status: 'expired', expiresIn: 0 };
  if (expiresIn <= EXPIRING_SOON_MS) return { status: 'expiring-soon', expiresIn };
  return { status: 'valid', expiresIn };
}

/**
 * Get key health for both owner and execution keys of an agent.
 */
export function getKeyHealth(agentAccountId: string): { owner: KeyHealth; execution: KeyHealth } {
  // Read directly from localStorage (not through the expiry-filtered getter)
  // so we can distinguish expired vs missing
  const ownerKey = getAgentKeyRaw(agentAccountId, 'owner');
  const execKey = getAgentKeyRaw(agentAccountId, 'execution');

  return {
    owner: assessKeyHealth(ownerKey),
    execution: assessKeyHealth(execKey),
  };
}

/**
 * Read a key without expiry filtering (for health reporting).
 */
function getAgentKeyRaw(agentAccountId: string, keyType: AgentKeyType): StoredAgentKey | null {
  const storageKey = `shade-studio:agent-keys:${agentAccountId}:${keyType}`;
  try {
    const value = localStorage.getItem(storageKey);
    if (value) return JSON.parse(value) as StoredAgentKey;
  } catch {
    // Skip malformed entry
  }
  return null;
}

/**
 * Get all agent keys that are expiring within the threshold.
 */
export function getKeysNeedingRotation(_ownerAccountId: string): StoredAgentKey[] {
  const prefix = 'shade-studio:agent-keys';
  const keysNeedingRotation: StoredAgentKey[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          const key = JSON.parse(value) as StoredAgentKey;
          if (!key.expiresAt) continue;

          const health = assessKeyHealth(key);
          if (health.status === 'expiring-soon' || health.status === 'expired') {
            keysNeedingRotation.push(key);
          }
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  return keysNeedingRotation;
}

// ============================================================================
// Pruning
// ============================================================================

/**
 * Prune expired keys. Delegates to agent-keys.ts.
 */
export function pruneExpiredKeys(): number {
  return pruneExpiredKeysFromStorage();
}

// ============================================================================
// Lifecycle Management (periodic pruning)
// ============================================================================

let pruneIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic key pruning.
 */
export function initKeyLifecycle(): void {
  if (pruneIntervalId) return;
  pruneExpiredKeys();
  pruneIntervalId = setInterval(pruneExpiredKeys, PRUNE_INTERVAL_MS);
}

/**
 * Stop periodic key pruning.
 */
export function stopKeyLifecycle(): void {
  if (pruneIntervalId) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }
}
