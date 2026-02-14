/**
 * Access key generation and encrypted localStorage CRUD.
 *
 * Key pairs are generated using @near-js/crypto (ed25519).
 * Private keys are stored encrypted in localStorage, keyed by sub-account
 * and public key. Encryption happens at the hook layer via useEncryption().
 */

import { KeyPairEd25519 } from '@near-js/crypto';
import { STORAGE_KEYS } from '@/lib/constants';
import type { StoredAccessKey, PermissionLevel } from '@/types/project-accounts';

// ============================================================================
// Key Pair Generation
// ============================================================================

export interface GeneratedKeyPair {
  /** Public key in NEAR format (ed25519:...) */
  publicKey: string;
  /** Secret key in NEAR format (ed25519:...) */
  secretKey: string;
}

/**
 * Generate a new ed25519 key pair for NEAR access keys.
 *
 * Uses @near-js/crypto's KeyPairEd25519 which produces keys
 * in the NEAR-native `ed25519:Base58...` format.
 */
export function generateKeyPair(): GeneratedKeyPair {
  const keyPair = KeyPairEd25519.fromRandom();
  return {
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: keyPair.toString(),
  };
}

// ============================================================================
// Encrypted Key Storage (localStorage)
// ============================================================================

/**
 * Build the localStorage key for an access key entry.
 */
function buildStorageKey(subAccountId: string, publicKey: string): string {
  return `${STORAGE_KEYS.ACCESS_KEYS}:${subAccountId}:${publicKey}`;
}

/**
 * Build the localStorage prefix for all keys of a sub-account.
 */
function buildStoragePrefix(subAccountId: string): string {
  return `${STORAGE_KEYS.ACCESS_KEYS}:${subAccountId}:`;
}

/**
 * Store an encrypted access key in localStorage.
 *
 * The private key should already be encrypted by the caller
 * (e.g., via useEncryption().encrypt()).
 */
export function storeEncryptedKey(key: StoredAccessKey): void {
  const storageKey = buildStorageKey(key.subAccountId, key.publicKey);
  localStorage.setItem(storageKey, JSON.stringify(key));
}

/**
 * Retrieve all encrypted keys for a sub-account.
 */
export function getEncryptedKeys(subAccountId: string): StoredAccessKey[] {
  const prefix = buildStoragePrefix(subAccountId);
  const keys: StoredAccessKey[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          keys.push(JSON.parse(value) as StoredAccessKey);
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  return keys;
}

/**
 * Remove a specific encrypted key from localStorage.
 */
export function removeEncryptedKey(
  subAccountId: string,
  publicKey: string
): void {
  const storageKey = buildStorageKey(subAccountId, publicKey);
  localStorage.removeItem(storageKey);
}

/**
 * Clear all encrypted keys for a sub-account.
 */
export function clearAllKeysForAccount(subAccountId: string): void {
  const prefix = buildStoragePrefix(subAccountId);
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefix)) {
      keysToRemove.push(storageKey);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Store a key with permission metadata (convenience wrapper).
 */
export function storeKeyForMember(
  subAccountId: string,
  publicKey: string,
  encryptedPrivateKey: string,
  nonce: string,
  permission: PermissionLevel
): void {
  storeEncryptedKey({
    subAccountId,
    publicKey,
    encryptedPrivateKey,
    nonce,
    permission,
  });
}
