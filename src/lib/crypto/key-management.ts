/**
 * Key derivation and management for encryption.
 * Derives deterministic keys from NEAR wallet signatures.
 */

import nacl from 'tweetnacl';
import { KEY_LENGTH } from '@/lib/constants';
import { encodeBase64, decodeBase64, encodeHex, secureZero } from './utils';
import {
  EncryptionError,
  EncryptionErrorCode,
  KeyDerivationError,
} from './errors';

/**
 * Message used for key derivation signing.
 * IMPORTANT: Changing this will derive different keys and break existing data!
 */
export const KEY_DERIVATION_MESSAGE = 'Private Grant Studio Key Derivation v1';

/**
 * Derived encryption keys from a wallet signature.
 */
export interface DerivedKeys {
  /** 32-byte secret key for symmetric encryption (secretbox) */
  secretKey: Uint8Array;
  /** 32-byte public key for identification and future asymmetric encryption */
  publicKey: Uint8Array;
  /** Hex-encoded hash of public key for identification (safe to store/display) */
  keyId: string;
}

/**
 * Input for key derivation from wallet signing.
 */
export interface KeyDerivationInput {
  /** Base64-encoded signature from wallet */
  signature: string;
  /** Ed25519 public key from wallet (may be prefixed with "ed25519:") */
  publicKey: string;
  /** NEAR account ID that signed the message */
  accountId: string;
}

/**
 * Derive encryption keys from a wallet signature.
 *
 * The derivation process:
 * 1. Decode the base64 signature from the wallet
 * 2. Hash the signature with SHA-512 (nacl.hash)
 * 3. Use first 32 bytes as seed for nacl.sign.keyPair.fromSeed()
 * 4. The resulting keys are deterministic: same signature = same keys
 *
 * This enables key recovery on new devices by re-signing the same message.
 *
 * @param input - Signature and wallet info from signMessage
 * @returns Derived encryption keys
 * @throws KeyDerivationError if derivation fails
 *
 * @example
 * const { signature, publicKey, accountId } = await signMessage(KEY_DERIVATION_MESSAGE);
 * const keys = deriveKeysFromSignature({ signature, publicKey, accountId });
 */
export function deriveKeysFromSignature(input: KeyDerivationInput): DerivedKeys {
  try {
    // Validate input
    if (!input.signature || typeof input.signature !== 'string') {
      throw new KeyDerivationError('Missing or invalid signature');
    }

    if (!input.accountId || typeof input.accountId !== 'string') {
      throw new KeyDerivationError('Missing or invalid accountId');
    }

    // Decode the signature
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = decodeBase64(input.signature);
    } catch {
      throw new KeyDerivationError('Invalid signature encoding');
    }

    // Hash the signature with SHA-512 to get entropy
    // SHA-512 produces 64 bytes, we use first 32 as seed
    const hash = nacl.hash(signatureBytes);

    // Use first 32 bytes as seed for key pair generation
    const seed = hash.slice(0, KEY_LENGTH);

    // Generate signing key pair from seed
    // We use the sign key pair because secretbox keys are derived from it
    const signingKeyPair = nacl.sign.keyPair.fromSeed(seed);

    // The secretKey from sign.keyPair is 64 bytes (seed + publicKey)
    // We use the first 32 bytes as our encryption secret key
    const secretKey = signingKeyPair.secretKey.slice(0, KEY_LENGTH);
    const publicKey = signingKeyPair.publicKey;

    // Generate keyId from public key hash (safe to store/display)
    const keyIdHash = nacl.hash(publicKey);
    const keyId = encodeHex(keyIdHash.slice(0, 16)); // 16 bytes = 32 hex chars

    return {
      secretKey,
      publicKey,
      keyId,
    };
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new KeyDerivationError(
      'Failed to derive encryption keys from signature',
      error
    );
  }
}

/**
 * Validate that a secret key has the correct format for encryption.
 *
 * @param key - Key to validate
 * @returns true if key is valid
 */
export function validateSecretKey(key: Uint8Array): boolean {
  // Must be Uint8Array
  if (!(key instanceof Uint8Array)) {
    return false;
  }

  // Must be correct length
  if (key.length !== KEY_LENGTH) {
    return false;
  }

  // Must not be all zeros (likely indicates cleared/uninitialized key)
  let allZeros = true;
  for (let i = 0; i < key.length; i++) {
    if (key[i] !== 0) {
      allZeros = false;
      break;
    }
  }

  return !allZeros;
}

/**
 * Securely clear a key from memory.
 * IMPORTANT: Call this when keys are no longer needed.
 *
 * Note: Due to JavaScript's garbage collection, this doesn't guarantee
 * the key is removed from memory, but it's a best-effort defense-in-depth measure.
 *
 * @param key - Key to clear
 */
export function clearKey(key: Uint8Array): void {
  secureZero(key);
}

/**
 * Clear all keys in a DerivedKeys object.
 * @param keys - Keys to clear
 */
export function clearDerivedKeys(keys: DerivedKeys): void {
  secureZero(keys.secretKey);
  secureZero(keys.publicKey);
  // keyId is a string, can't be zeroed, but it's safe to expose
}

/**
 * Create a new random key (not derived from wallet).
 * Useful for testing or temporary encryption.
 *
 * @returns Random 32-byte secret key
 */
export function generateRandomKey(): Uint8Array {
  return nacl.randomBytes(KEY_LENGTH);
}

/**
 * Export a key to base64 for temporary storage/transfer.
 * WARNING: Be extremely careful with exported keys!
 *
 * @param key - Key to export
 * @returns Base64-encoded key
 */
export function exportKeyToBase64(key: Uint8Array): string {
  if (!validateSecretKey(key)) {
    throw new EncryptionError(
      EncryptionErrorCode.INVALID_KEY,
      'Cannot export invalid key'
    );
  }
  return encodeBase64(key);
}

/**
 * Import a key from base64.
 *
 * @param base64Key - Base64-encoded key
 * @returns Decoded key
 * @throws EncryptionError if key is invalid
 */
export function importKeyFromBase64(base64Key: string): Uint8Array {
  try {
    const key = decodeBase64(base64Key);
    if (!validateSecretKey(key)) {
      throw new EncryptionError(
        EncryptionErrorCode.INVALID_KEY,
        'Imported key is invalid'
      );
    }
    return key;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      EncryptionErrorCode.INVALID_KEY,
      'Failed to import key from base64',
      error
    );
  }
}

/**
 * Derive a sub-key from an existing key for a specific purpose.
 * Useful for deriving different keys for different document types.
 *
 * @param masterKey - The master secret key
 * @param context - Context string for key separation
 * @returns Derived sub-key
 *
 * @example
 * const documentKey = deriveSubKey(masterKey, 'document:abc123');
 */
export function deriveSubKey(masterKey: Uint8Array, context: string): Uint8Array {
  if (!validateSecretKey(masterKey)) {
    throw new EncryptionError(
      EncryptionErrorCode.INVALID_KEY,
      'Invalid master key'
    );
  }

  // Combine master key with context and hash
  const contextBytes = new TextEncoder().encode(context);
  const combined = new Uint8Array(masterKey.length + contextBytes.length);
  combined.set(masterKey);
  combined.set(contextBytes, masterKey.length);

  // Hash to derive new key
  const hash = nacl.hash(combined);
  return hash.slice(0, KEY_LENGTH);
}
