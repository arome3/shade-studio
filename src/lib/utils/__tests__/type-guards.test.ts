import { describe, it, expect } from 'vitest';
import {
  isDefined,
  isNonEmptyString,
  isValidAccountId,
  isObject,
  isNonEmptyArray,
  isISODateString,
  isValidUrl,
  isValidEmail,
  isPositiveNumber,
  isHexString,
  isBase64String,
  isError,
  assertDefined,
  assert,
} from '../type-guards';

describe('type-guards', () => {
  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined([])).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' ')).toBe(true);
    });

    it('should return false for empty strings and non-strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isValidAccountId', () => {
    it('should validate correct NEAR account IDs', () => {
      expect(isValidAccountId('alice.near')).toBe(true);
      expect(isValidAccountId('bob.testnet')).toBe(true);
      expect(isValidAccountId('test-account.near')).toBe(true);
      expect(isValidAccountId('test_account.near')).toBe(true);
      expect(isValidAccountId('a1.near')).toBe(true);
    });

    it('should reject invalid NEAR account IDs', () => {
      expect(isValidAccountId('-invalid.near')).toBe(false);
      expect(isValidAccountId('invalid-.near')).toBe(false);
      expect(isValidAccountId('UPPERCASE.near')).toBe(false);
      expect(isValidAccountId('a')).toBe(false); // too short
      expect(isValidAccountId('')).toBe(false);
      expect(isValidAccountId(null)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a', 'b'])).toBe(true);
    });

    it('should return false for empty arrays and non-arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray('string')).toBe(false);
    });
  });

  describe('isISODateString', () => {
    it('should validate ISO 8601 date strings', () => {
      expect(isISODateString('2024-01-15T10:30:00.000Z')).toBe(true);
      expect(isISODateString('2024-01-15T10:30:00Z')).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(isISODateString('2024-01-15')).toBe(false); // No T
      expect(isISODateString('not a date')).toBe(false);
      expect(isISODateString(null)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://near.org/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(100)).toBe(true);
      expect(isPositiveNumber(0.5)).toBe(true);
    });

    it('should return false for non-positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('5')).toBe(false);
    });
  });

  describe('isHexString', () => {
    it('should validate hex strings', () => {
      expect(isHexString('0x1234abcd')).toBe(true);
      expect(isHexString('1234abcd')).toBe(true);
      expect(isHexString('ABCDEF')).toBe(true);
    });

    it('should reject non-hex strings', () => {
      expect(isHexString('not hex')).toBe(false);
      expect(isHexString('0xGHIJ')).toBe(false);
      expect(isHexString(null)).toBe(false);
    });
  });

  describe('isBase64String', () => {
    it('should validate base64 strings', () => {
      expect(isBase64String('SGVsbG8gV29ybGQ=')).toBe(true);
      expect(isBase64String('dGVzdA==')).toBe(true);
    });

    it('should reject invalid base64 strings', () => {
      expect(isBase64String('not base64!')).toBe(false);
      expect(isBase64String(null)).toBe(false);
    });
  });

  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('type error'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('error string')).toBe(false);
      expect(isError({ message: 'error' })).toBe(false);
      expect(isError(null)).toBe(false);
    });
  });

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow();
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
    });

    it('should throw for null and undefined', () => {
      expect(() => assertDefined(null)).toThrow('Value is not defined');
      expect(() => assertDefined(undefined)).toThrow('Value is not defined');
    });

    it('should throw with custom message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('assert', () => {
    it('should not throw for true conditions', () => {
      expect(() => assert(true)).not.toThrow();
      expect(() => assert(1 === 1)).not.toThrow();
    });

    it('should throw for false conditions', () => {
      expect(() => assert(false)).toThrow('Assertion failed');
      expect(() => assert(false, 'Custom message')).toThrow('Custom message');
    });
  });
});
