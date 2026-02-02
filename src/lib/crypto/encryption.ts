/**
 * Core encryption functions using TweetNaCl secretbox.
 * Provides authenticated encryption with XSalsa20-Poly1305.
 */

import nacl from 'tweetnacl';
import { type EncryptedPayload } from '@/types/document';
import { KEY_LENGTH, MAX_FILE_SIZE } from '@/lib/constants';
import {
  encodeBase64,
  decodeBase64,
  encodeUtf8,
  decodeUtf8,
  generateRandomNonce,
} from './utils';
import {
  EncryptionError,
  EncryptionErrorCode,
  DecryptionFailedError,
  InvalidPayloadError,
  FileTooLargeError,
} from './errors';

/**
 * Current encryption version.
 * Increment when making breaking changes to encryption format.
 */
export const ENCRYPTION_VERSION = 1;

/**
 * Validate that a secret key has the correct format.
 * @param secretKey - The key to validate
 * @throws EncryptionError if key is invalid
 */
function validateSecretKey(secretKey: Uint8Array): void {
  if (!(secretKey instanceof Uint8Array)) {
    throw new EncryptionError(
      EncryptionErrorCode.INVALID_KEY,
      'Secret key must be a Uint8Array'
    );
  }
  if (secretKey.length !== KEY_LENGTH) {
    throw new EncryptionError(
      EncryptionErrorCode.INVALID_KEY,
      `Secret key must be ${KEY_LENGTH} bytes, got ${secretKey.length}`
    );
  }
}

/**
 * Validate an encrypted payload structure.
 * @param payload - The payload to validate
 * @throws InvalidPayloadError if payload is invalid
 */
function validatePayload(payload: unknown): asserts payload is EncryptedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new InvalidPayloadError('Payload must be an object');
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.ciphertext !== 'string' || !p.ciphertext) {
    throw new InvalidPayloadError('Missing or invalid ciphertext');
  }

  if (typeof p.nonce !== 'string' || !p.nonce) {
    throw new InvalidPayloadError('Missing or invalid nonce');
  }

  if (typeof p.ephemeralPublicKey !== 'string') {
    throw new InvalidPayloadError('Missing or invalid ephemeralPublicKey');
  }

  if (typeof p.version !== 'number') {
    throw new InvalidPayloadError('Missing or invalid version');
  }
}

/**
 * Encrypt data using XSalsa20-Poly1305 (secretbox).
 *
 * @param plaintext - Data to encrypt (string or Uint8Array)
 * @param secretKey - 32-byte secret key
 * @returns Encrypted payload with ciphertext, nonce, and metadata
 *
 * @example
 * const encrypted = encryptData('Hello, World!', secretKey);
 * // { ciphertext: '...', nonce: '...', ephemeralPublicKey: '', version: 1 }
 */
export function encryptData(
  plaintext: string | Uint8Array,
  secretKey: Uint8Array
): EncryptedPayload {
  validateSecretKey(secretKey);

  try {
    // Convert string to bytes if needed
    const plaintextBytes =
      typeof plaintext === 'string' ? encodeUtf8(plaintext) : plaintext;

    // Generate a fresh random nonce (critical: never reuse!)
    const nonce = generateRandomNonce();

    // Encrypt with secretbox (XSalsa20-Poly1305)
    const ciphertext = nacl.secretbox(plaintextBytes, nonce, secretKey);

    return {
      ciphertext: encodeBase64(ciphertext),
      nonce: encodeBase64(nonce),
      // ephemeralPublicKey is empty for secretbox (symmetric encryption)
      // It's reserved for future asymmetric encryption (nacl.box) for sharing
      ephemeralPublicKey: '',
      version: ENCRYPTION_VERSION,
    };
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      EncryptionErrorCode.ENCRYPTION_FAILED,
      'Failed to encrypt data',
      error
    );
  }
}

/**
 * Decrypt data using XSalsa20-Poly1305 (secretbox).
 *
 * @param payload - Encrypted payload from encryptData
 * @param secretKey - 32-byte secret key (must match encryption key)
 * @returns Decrypted data as Uint8Array
 * @throws DecryptionFailedError if decryption fails (wrong key or tampered data)
 *
 * @example
 * const decrypted = decryptData(encrypted, secretKey);
 * const text = new TextDecoder().decode(decrypted);
 */
export function decryptData(
  payload: EncryptedPayload,
  secretKey: Uint8Array
): Uint8Array {
  validatePayload(payload);
  validateSecretKey(secretKey);

  try {
    const ciphertext = decodeBase64(payload.ciphertext);
    const nonce = decodeBase64(payload.nonce);

    // Decrypt with secretbox
    const decrypted = nacl.secretbox.open(ciphertext, nonce, secretKey);

    // secretbox.open returns null if authentication fails (tampered or wrong key)
    if (decrypted === null) {
      throw new DecryptionFailedError(
        'Decryption failed: invalid key or corrupted data'
      );
    }

    return decrypted;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new DecryptionFailedError('Failed to decrypt data', error);
  }
}

/**
 * Encrypt a JSON-serializable object.
 *
 * @param data - Object to encrypt
 * @param secretKey - 32-byte secret key
 * @returns Encrypted payload
 *
 * @example
 * const encrypted = encryptJson({ name: 'Alice', balance: 100 }, secretKey);
 */
export function encryptJson<T>(data: T, secretKey: Uint8Array): EncryptedPayload {
  const jsonString = JSON.stringify(data);
  return encryptData(jsonString, secretKey);
}

/**
 * Decrypt and parse a JSON object.
 *
 * @param payload - Encrypted payload
 * @param secretKey - 32-byte secret key
 * @returns Decrypted and parsed object
 * @throws DecryptionFailedError if decryption or parsing fails
 *
 * @example
 * const data = decryptJson<{ name: string }>(encrypted, secretKey);
 * console.log(data.name); // 'Alice'
 */
export function decryptJson<T>(payload: EncryptedPayload, secretKey: Uint8Array): T {
  const decrypted = decryptData(payload, secretKey);
  const jsonString = decodeUtf8(decrypted);

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new DecryptionFailedError('Failed to parse decrypted JSON', error);
  }
}

/**
 * Encrypt a file's contents.
 *
 * @param file - File to encrypt
 * @param secretKey - 32-byte secret key
 * @returns Encrypted payload and file metadata
 * @throws FileTooLargeError if file exceeds MAX_FILE_SIZE
 *
 * @example
 * const { payload, metadata } = await encryptFile(file, secretKey);
 */
export async function encryptFile(
  file: File,
  secretKey: Uint8Array
): Promise<{
  payload: EncryptedPayload;
  metadata: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  };
}> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new FileTooLargeError(file.size, MAX_FILE_SIZE);
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Encrypt the file contents
  const payload = encryptData(data, secretKey);

  return {
    payload,
    metadata: {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    },
  };
}

/**
 * Decrypt file contents and reconstruct a File object.
 *
 * @param payload - Encrypted payload
 * @param metadata - File metadata from encryptFile
 * @param secretKey - 32-byte secret key
 * @returns Reconstructed File object
 *
 * @example
 * const file = await decryptFile(payload, metadata, secretKey);
 * // Use file.name, file.type, etc.
 */
export async function decryptFile(
  payload: EncryptedPayload,
  metadata: {
    name: string;
    type: string;
    size?: number;
    lastModified?: number;
  },
  secretKey: Uint8Array
): Promise<File> {
  const decrypted = decryptData(payload, secretKey);

  // Reconstruct the File object
  // Note: Need to create a new ArrayBuffer copy for File constructor
  const buffer = new Uint8Array(decrypted).buffer;
  return new File([buffer], metadata.name, {
    type: metadata.type,
    lastModified: metadata.lastModified ?? Date.now(),
  });
}

/**
 * Check if an unknown value is a valid EncryptedPayload.
 * Useful for type narrowing in conditional logic.
 *
 * @param data - Value to check
 * @returns true if data is a valid EncryptedPayload
 */
export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  try {
    validatePayload(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a string and return a compact string representation.
 * Useful for storing encrypted data in URLs or compact formats.
 *
 * @param plaintext - String to encrypt
 * @param secretKey - 32-byte secret key
 * @returns Base64-encoded encrypted string (version:nonce:ciphertext)
 */
export function encryptToString(plaintext: string, secretKey: Uint8Array): string {
  const payload = encryptData(plaintext, secretKey);
  // Compact format: version:nonce:ciphertext
  return `${payload.version}:${payload.nonce}:${payload.ciphertext}`;
}

/**
 * Decrypt a compact encrypted string.
 *
 * @param encrypted - Encrypted string from encryptToString
 * @param secretKey - 32-byte secret key
 * @returns Decrypted string
 */
export function decryptFromString(encrypted: string, secretKey: Uint8Array): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new InvalidPayloadError('Invalid encrypted string format');
  }

  const [versionStr, nonce, ciphertext] = parts;

  if (!versionStr || !nonce || !ciphertext) {
    throw new InvalidPayloadError('Invalid encrypted string format');
  }

  const version = parseInt(versionStr, 10);

  if (isNaN(version)) {
    throw new InvalidPayloadError('Invalid version in encrypted string');
  }

  const payload: EncryptedPayload = {
    version,
    nonce,
    ciphertext,
    ephemeralPublicKey: '',
  };

  const decrypted = decryptData(payload, secretKey);
  return decodeUtf8(decrypted);
}
