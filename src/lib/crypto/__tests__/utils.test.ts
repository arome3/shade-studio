import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  encodeHex,
  decodeHex,
  encodeUtf8,
  decodeUtf8,
  generateRandomNonce,
  generateRandomBytes,
  constantTimeEqual,
  secureZero,
  isValidBase64,
  concatBytes,
} from '../utils';
import { NONCE_LENGTH } from '@/lib/constants';

describe('crypto/utils', () => {
  describe('base64 encoding', () => {
    it('should encode and decode round-trip', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(decoded).toEqual(original);
    });

    it('should encode empty array', () => {
      const empty = new Uint8Array(0);
      const encoded = encodeBase64(empty);
      const decoded = decodeBase64(encoded);
      expect(decoded).toEqual(empty);
    });

    it('should handle large arrays', () => {
      const large = new Uint8Array(10000).fill(42);
      const encoded = encodeBase64(large);
      const decoded = decodeBase64(encoded);
      expect(decoded).toEqual(large);
    });
  });

  describe('hex encoding', () => {
    it('should encode and decode round-trip', () => {
      const original = new Uint8Array([0, 15, 255, 128]);
      const encoded = encodeHex(original);
      expect(encoded).toBe('000fff80');
      const decoded = decodeHex(encoded);
      expect(decoded).toEqual(original);
    });

    it('should handle empty array', () => {
      const empty = new Uint8Array(0);
      const encoded = encodeHex(empty);
      expect(encoded).toBe('');
      const decoded = decodeHex(encoded);
      expect(decoded).toEqual(empty);
    });

    it('should throw on invalid hex length', () => {
      expect(() => decodeHex('abc')).toThrow('length must be even');
    });

    it('should throw on invalid hex characters', () => {
      expect(() => decodeHex('ghij')).toThrow('Invalid hex character');
    });
  });

  describe('UTF-8 encoding', () => {
    it('should encode and decode ASCII', () => {
      const text = 'Hello, World!';
      const encoded = encodeUtf8(text);
      const decoded = decodeUtf8(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle Unicode characters', () => {
      const text = 'Hello, 世界! 🌍';
      const encoded = encodeUtf8(text);
      const decoded = decodeUtf8(encoded);
      expect(decoded).toBe(text);
    });

    it('should handle empty string', () => {
      const text = '';
      const encoded = encodeUtf8(text);
      expect(encoded.length).toBe(0);
      const decoded = decodeUtf8(encoded);
      expect(decoded).toBe(text);
    });
  });

  describe('generateRandomNonce', () => {
    it('should generate correct length', () => {
      const nonce = generateRandomNonce();
      expect(nonce.length).toBe(NONCE_LENGTH);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateRandomNonce();
      const nonce2 = generateRandomNonce();
      expect(nonce1).not.toEqual(nonce2);
    });

    it('should be Uint8Array', () => {
      const nonce = generateRandomNonce();
      expect(nonce).toBeInstanceOf(Uint8Array);
    });
  });

  describe('generateRandomBytes', () => {
    it('should generate correct length', () => {
      const bytes = generateRandomBytes(32);
      expect(bytes.length).toBe(32);
    });

    it('should generate unique values', () => {
      const bytes1 = generateRandomBytes(32);
      const bytes2 = generateRandomBytes(32);
      expect(bytes1).not.toEqual(bytes2);
    });

    it('should handle zero length', () => {
      const bytes = generateRandomBytes(0);
      expect(bytes.length).toBe(0);
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for equal arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(constantTimeEqual(a, b)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it('should return false for different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it('should return true for empty arrays', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array(0);
      expect(constantTimeEqual(a, b)).toBe(true);
    });
  });

  describe('secureZero', () => {
    it('should zero out array', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      secureZero(arr);
      expect(arr).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should handle empty array', () => {
      const arr = new Uint8Array(0);
      secureZero(arr);
      expect(arr.length).toBe(0);
    });

    it('should handle large array', () => {
      const arr = new Uint8Array(10000).fill(255);
      secureZero(arr);
      expect(arr.every((b) => b === 0)).toBe(true);
    });
  });

  describe('isValidBase64', () => {
    it('should return true for valid base64', () => {
      expect(isValidBase64('SGVsbG8=')).toBe(true);
      expect(isValidBase64('SGVsbG8sIFdvcmxkIQ==')).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isValidBase64('')).toBe(true);
    });

    it('should return false for invalid characters', () => {
      expect(isValidBase64('Hello!')).toBe(false);
      expect(isValidBase64('SGVs bG8=')).toBe(false);
    });
  });

  describe('concatBytes', () => {
    it('should concatenate arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5]);
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should handle empty arrays', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array([1, 2]);
      const result = concatBytes(a, b);
      expect(result).toEqual(new Uint8Array([1, 2]));
    });

    it('should handle single array', () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concatBytes(a);
      expect(result).toEqual(a);
    });

    it('should handle no arrays', () => {
      const result = concatBytes();
      expect(result).toEqual(new Uint8Array(0));
    });
  });
});
