/**
 * Encryption mock factories for tests.
 *
 * Provides helpers to create test keys and mock encrypted payloads
 * without needing real wallet signatures.
 */

import { vi } from 'vitest';
import nacl from 'tweetnacl';
import { KEY_LENGTH } from '@/lib/constants';
import type { EncryptedPayload } from '@/types/document';

/**
 * Generate a random 32-byte encryption key for testing.
 */
export function createTestKey(): Uint8Array {
  return nacl.randomBytes(KEY_LENGTH);
}

/**
 * Create a mock EncryptedPayload shape (does NOT contain real encrypted data).
 * Useful for testing components that display/handle payloads without decrypting.
 */
export function createMockEncryptedPayload(
  overrides?: Partial<EncryptedPayload>
): EncryptedPayload {
  return {
    ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0LWRhdGE=',
    nonce: 'dGVzdC1ub25jZS0yNA==',
    ephemeralPublicKey: '',
    version: 1,
    ...overrides,
  };
}

/**
 * Create a mock useEncryption() return value.
 * Matches the hook's return shape for component testing.
 */
export function createMockEncryption(options: { isReady?: boolean } = {}) {
  const { isReady = true } = options;

  return {
    status: isReady ? ('ready' as const) : ('uninitialized' as const),
    isReady,
    isInitializing: false,
    keyId: isReady ? 'test-key-id-abc123' : null,
    error: null,
    initialize: vi.fn().mockResolvedValue(undefined),
    lock: vi.fn(),
    encrypt: vi.fn().mockResolvedValue(createMockEncryptedPayload()),
    decrypt: vi.fn().mockResolvedValue('decrypted-content'),
    encryptFileData: vi.fn().mockResolvedValue({
      payload: createMockEncryptedPayload(),
      metadata: { name: 'test.txt', type: 'text/plain', size: 100, lastModified: Date.now() },
    }),
    decryptFileData: vi.fn().mockResolvedValue(new File(['test'], 'test.txt')),
    isEncrypted: vi.fn().mockReturnValue(false),
  };
}
