/**
 * Encoding and utility functions for TweetNaCl operations.
 * Provides secure helpers for encryption workflows.
 */

import nacl from 'tweetnacl';
import { encodeBase64 as naclEncodeBase64, decodeBase64 as naclDecodeBase64 } from 'tweetnacl-util';
import { NONCE_LENGTH } from '@/lib/constants';

/**
 * Encode a Uint8Array to a base64 string.
 * @param data - The data to encode
 * @returns Base64 encoded string
 */
export function encodeBase64(data: Uint8Array): string {
  return naclEncodeBase64(data);
}

/**
 * Decode a base64 string to a Uint8Array.
 * @param data - The base64 string to decode
 * @returns Decoded Uint8Array
 * @throws Error if the input is not valid base64
 */
export function decodeBase64(data: string): Uint8Array {
  return naclDecodeBase64(data);
}

/**
 * Encode a Uint8Array to a hexadecimal string.
 * @param data - The data to encode
 * @returns Hex encoded string
 */
export function encodeHex(data: Uint8Array): string {
  return Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode a hexadecimal string to a Uint8Array.
 * @param data - The hex string to decode
 * @returns Decoded Uint8Array
 * @throws Error if the input is not valid hex
 */
export function decodeHex(data: string): Uint8Array {
  if (data.length % 2 !== 0) {
    throw new Error('Invalid hex string: length must be even');
  }

  const bytes = new Uint8Array(data.length / 2);
  for (let i = 0; i < data.length; i += 2) {
    const byte = parseInt(data.slice(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/**
 * Encode a string to a UTF-8 Uint8Array.
 * @param data - The string to encode
 * @returns UTF-8 encoded Uint8Array
 */
export function encodeUtf8(data: string): Uint8Array {
  // Use TextEncoder and ensure we return a proper Uint8Array
  // Some environments (like jsdom) may return a subclass that tweetnacl doesn't recognize
  const encoded = new TextEncoder().encode(data);
  const result = new Uint8Array(encoded.length);
  result.set(encoded);
  return result;
}

/**
 * Decode a UTF-8 Uint8Array to a string.
 * @param data - The UTF-8 encoded data
 * @returns Decoded string
 */
export function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

/**
 * Generate a cryptographically secure random nonce for encryption.
 * Uses 24 bytes as required by XSalsa20-Poly1305.
 * @returns Random 24-byte nonce
 */
export function generateRandomNonce(): Uint8Array {
  return nacl.randomBytes(NONCE_LENGTH);
}

/**
 * Generate cryptographically secure random bytes.
 * @param length - Number of bytes to generate
 * @returns Random bytes of specified length
 */
export function generateRandomBytes(length: number): Uint8Array {
  return nacl.randomBytes(length);
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Prevents timing attacks when comparing sensitive data.
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays are equal
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Securely zero out a Uint8Array to clear sensitive data from memory.
 * Important for clearing secret keys after use.
 * @param array - The array to zero out
 */
export function secureZero(array: Uint8Array): void {
  for (let i = 0; i < array.length; i++) {
    array[i] = 0;
  }
}

/**
 * Check if data looks like valid base64.
 * @param data - String to check
 * @returns true if valid base64 format
 */
export function isValidBase64(data: string): boolean {
  try {
    // Check format with regex first (faster)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
      return false;
    }
    // Try to decode
    decodeBase64(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Concatenate multiple Uint8Arrays into one.
 * @param arrays - Arrays to concatenate
 * @returns Combined array
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}
