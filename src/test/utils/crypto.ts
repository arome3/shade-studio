/**
 * Crypto test helpers for encryption round-trip testing.
 *
 * Provides deterministic key generation and convenience wrappers
 * for encrypt/decrypt operations in integration tests.
 */

import nacl from 'tweetnacl';
import { KEY_LENGTH } from '@/lib/constants';
import { encryptData, decryptData, encryptJson, decryptJson } from '@/lib/crypto/encryption';
import {
  deriveKeysFromSignature,
  type DerivedKeys,
} from '@/lib/crypto/key-management';
import { encodeBase64 } from 'tweetnacl-util';

/**
 * Create a random NaCl signing key pair, sliced to KEY_LENGTH for secretbox.
 */
export function createTestKeyPair(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  const keyPair = nacl.sign.keyPair();
  return {
    secretKey: keyPair.secretKey.slice(0, KEY_LENGTH),
    publicKey: keyPair.publicKey,
  };
}

/**
 * Encrypt then decrypt a plaintext string, verifying round-trip correctness.
 * Throws if the result doesn't match the input.
 *
 * @returns The decrypted string (should equal input)
 */
export function roundTrip(plaintext: string, key: Uint8Array): string {
  const encrypted = encryptData(plaintext, key);
  const decrypted = decryptData(encrypted, key);
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt then decrypt a JSON object, verifying round-trip correctness.
 *
 * @returns The decrypted object (should deep-equal input)
 */
export function roundTripJson<T>(data: T, key: Uint8Array): T {
  const encrypted = encryptJson(data, key);
  return decryptJson<T>(encrypted, key);
}

/**
 * Derive deterministic encryption keys from a fake wallet signature.
 *
 * Uses nacl.hash seeded from the accountId for reproducibility
 * within the same test run. Different runs produce different keys unless
 * the same accountId is used.
 */
export function deriveTestKeys(accountId = 'test.near'): DerivedKeys {
  // Create a deterministic signature from the accountId
  // Ensure we pass a real Uint8Array (jsdom's TextEncoder can return a subclass)
  const encoded = new TextEncoder().encode(accountId);
  const accountBytes = new Uint8Array(encoded);
  const hash = nacl.hash(accountBytes);
  const fakeSignature = new Uint8Array(hash.slice(0, 64));
  const fakePublicKey = new Uint8Array(hash.slice(0, 32));

  return deriveKeysFromSignature({
    signature: encodeBase64(fakeSignature),
    publicKey: encodeBase64(fakePublicKey),
    accountId,
  });
}
