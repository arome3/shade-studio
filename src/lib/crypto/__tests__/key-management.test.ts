import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import {
  KEY_DERIVATION_MESSAGE,
  deriveKeysFromSignature,
  validateSecretKey,
  clearKey,
  clearDerivedKeys,
  generateRandomKey,
  exportKeyToBase64,
  importKeyFromBase64,
  deriveSubKey,
} from '../key-management';
import { KeyDerivationError, EncryptionError } from '../errors';
import { KEY_LENGTH } from '@/lib/constants';

describe('crypto/key-management', () => {
  // Create mock signature for testing
  // In real usage, the wallet provides a signature from signing KEY_DERIVATION_MESSAGE
  // For testing, we use a random 64-byte signature which is valid input format
  const createMockSignature = () => {
    // Generate a random signature (64 bytes is standard Ed25519 signature size)
    const signature = nacl.randomBytes(64);
    const publicKey = nacl.randomBytes(32);
    return {
      signature: encodeBase64(signature),
      publicKey: encodeBase64(publicKey),
      accountId: 'test.near',
    };
  };

  describe('deriveKeysFromSignature', () => {
    it('should derive keys from valid input', () => {
      const input = createMockSignature();
      const keys = deriveKeysFromSignature(input);

      expect(keys.secretKey).toBeInstanceOf(Uint8Array);
      expect(keys.secretKey.length).toBe(KEY_LENGTH);
      expect(keys.publicKey).toBeInstanceOf(Uint8Array);
      expect(keys.publicKey.length).toBe(KEY_LENGTH);
      expect(typeof keys.keyId).toBe('string');
      expect(keys.keyId.length).toBe(32); // 16 bytes as hex
    });

    it('should be deterministic (same input = same keys)', () => {
      const input = createMockSignature();
      const keys1 = deriveKeysFromSignature(input);
      const keys2 = deriveKeysFromSignature(input);

      expect(keys1.secretKey).toEqual(keys2.secretKey);
      expect(keys1.publicKey).toEqual(keys2.publicKey);
      expect(keys1.keyId).toBe(keys2.keyId);
    });

    it('should produce different keys for different signatures', () => {
      const input1 = createMockSignature();
      const input2 = createMockSignature();

      const keys1 = deriveKeysFromSignature(input1);
      const keys2 = deriveKeysFromSignature(input2);

      expect(keys1.secretKey).not.toEqual(keys2.secretKey);
      expect(keys1.publicKey).not.toEqual(keys2.publicKey);
      expect(keys1.keyId).not.toBe(keys2.keyId);
    });

    it('should throw on missing signature', () => {
      expect(() =>
        deriveKeysFromSignature({
          signature: '',
          publicKey: 'test',
          accountId: 'test.near',
        })
      ).toThrow(KeyDerivationError);
    });

    it('should throw on missing accountId', () => {
      const input = createMockSignature();
      expect(() =>
        deriveKeysFromSignature({
          ...input,
          accountId: '',
        })
      ).toThrow(KeyDerivationError);
    });

    it('should throw on invalid signature encoding', () => {
      expect(() =>
        deriveKeysFromSignature({
          signature: 'not-valid-base64!!!',
          publicKey: 'test',
          accountId: 'test.near',
        })
      ).toThrow(KeyDerivationError);
    });
  });

  describe('validateSecretKey', () => {
    it('should return true for valid key', () => {
      const key = nacl.randomBytes(KEY_LENGTH);
      expect(validateSecretKey(key)).toBe(true);
    });

    it('should return false for wrong length', () => {
      expect(validateSecretKey(new Uint8Array(16))).toBe(false);
      expect(validateSecretKey(new Uint8Array(64))).toBe(false);
    });

    it('should return false for all-zeros key', () => {
      const zeros = new Uint8Array(KEY_LENGTH);
      expect(validateSecretKey(zeros)).toBe(false);
    });

    it('should return false for non-Uint8Array', () => {
      expect(validateSecretKey('not a key' as never)).toBe(false);
      expect(validateSecretKey(null as never)).toBe(false);
      expect(validateSecretKey([1, 2, 3] as never)).toBe(false);
    });
  });

  describe('clearKey', () => {
    it('should zero out the key', () => {
      const key = nacl.randomBytes(KEY_LENGTH);
      const originalSum = key.reduce((a, b) => a + b, 0);
      expect(originalSum).toBeGreaterThan(0);

      clearKey(key);

      const clearedSum = key.reduce((a, b) => a + b, 0);
      expect(clearedSum).toBe(0);
      expect(key.every((b) => b === 0)).toBe(true);
    });
  });

  describe('clearDerivedKeys', () => {
    it('should zero out both keys', () => {
      const input = createMockSignature();
      const keys = deriveKeysFromSignature(input);

      // Verify keys have non-zero content
      expect(keys.secretKey.some((b) => b !== 0)).toBe(true);
      expect(keys.publicKey.some((b) => b !== 0)).toBe(true);

      clearDerivedKeys(keys);

      // Both should be zeroed
      expect(keys.secretKey.every((b) => b === 0)).toBe(true);
      expect(keys.publicKey.every((b) => b === 0)).toBe(true);
    });
  });

  describe('generateRandomKey', () => {
    it('should generate correct length', () => {
      const key = generateRandomKey();
      expect(key.length).toBe(KEY_LENGTH);
    });

    it('should generate unique keys', () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();
      expect(key1).not.toEqual(key2);
    });

    it('should pass validation', () => {
      const key = generateRandomKey();
      expect(validateSecretKey(key)).toBe(true);
    });
  });

  describe('exportKeyToBase64 / importKeyFromBase64', () => {
    it('should export and import round-trip', () => {
      const key = generateRandomKey();
      const exported = exportKeyToBase64(key);
      const imported = importKeyFromBase64(exported);
      expect(imported).toEqual(key);
    });

    it('should throw on export of invalid key', () => {
      const invalidKey = new Uint8Array(16);
      expect(() => exportKeyToBase64(invalidKey)).toThrow(EncryptionError);
    });

    it('should throw on import of invalid key', () => {
      // Wrong length when decoded
      const shortKey = encodeBase64(new Uint8Array(16));
      expect(() => importKeyFromBase64(shortKey)).toThrow(EncryptionError);
    });

    it('should throw on import of invalid base64', () => {
      expect(() => importKeyFromBase64('not valid base64!!!')).toThrow();
    });
  });

  describe('deriveSubKey', () => {
    it('should derive different keys for different contexts', () => {
      const masterKey = generateRandomKey();
      const subKey1 = deriveSubKey(masterKey, 'context1');
      const subKey2 = deriveSubKey(masterKey, 'context2');

      expect(subKey1).not.toEqual(subKey2);
    });

    it('should be deterministic', () => {
      const masterKey = generateRandomKey();
      const context = 'document:abc123';

      const subKey1 = deriveSubKey(masterKey, context);
      const subKey2 = deriveSubKey(masterKey, context);

      expect(subKey1).toEqual(subKey2);
    });

    it('should produce valid keys', () => {
      const masterKey = generateRandomKey();
      const subKey = deriveSubKey(masterKey, 'test');

      expect(subKey.length).toBe(KEY_LENGTH);
      expect(validateSecretKey(subKey)).toBe(true);
    });

    it('should throw on invalid master key', () => {
      const invalidKey = new Uint8Array(16);
      expect(() => deriveSubKey(invalidKey, 'test')).toThrow(EncryptionError);
    });
  });

  describe('KEY_DERIVATION_MESSAGE', () => {
    it('should be a non-empty string', () => {
      expect(typeof KEY_DERIVATION_MESSAGE).toBe('string');
      expect(KEY_DERIVATION_MESSAGE.length).toBeGreaterThan(0);
    });

    it('should include version for migration safety', () => {
      expect(KEY_DERIVATION_MESSAGE).toContain('v1');
    });
  });
});
