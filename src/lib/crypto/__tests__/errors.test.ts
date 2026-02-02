import { describe, it, expect } from 'vitest';
import {
  EncryptionErrorCode,
  EncryptionError,
  EncryptionNotInitializedError,
  WalletNotConnectedForEncryptionError,
  KeyDerivationError,
  UserRejectedSigningError,
  DecryptionFailedError,
  InvalidPayloadError,
  VersionMismatchError,
  FileTooLargeError,
  isEncryptionError,
  toEncryptionError,
  getEncryptionErrorMessage,
} from '../errors';

describe('crypto/errors', () => {
  describe('EncryptionError', () => {
    it('should create error with code and default message', () => {
      const error = new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED);
      expect(error.code).toBe(EncryptionErrorCode.ENCRYPTION_FAILED);
      expect(error.message).toContain('Failed to encrypt');
      expect(error.name).toBe('EncryptionError');
    });

    it('should create error with custom message', () => {
      const error = new EncryptionError(
        EncryptionErrorCode.ENCRYPTION_FAILED,
        'Custom message'
      );
      expect(error.message).toBe('Custom message');
    });

    it('should store original error', () => {
      const original = new Error('Original');
      const error = new EncryptionError(
        EncryptionErrorCode.ENCRYPTION_FAILED,
        undefined,
        original
      );
      expect(error.originalError).toBe(original);
    });

    it('should be instance of Error', () => {
      const error = new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('specialized error classes', () => {
    it('EncryptionNotInitializedError', () => {
      const error = new EncryptionNotInitializedError();
      expect(error.code).toBe(EncryptionErrorCode.NOT_INITIALIZED);
      expect(error.name).toBe('EncryptionNotInitializedError');
    });

    it('WalletNotConnectedForEncryptionError', () => {
      const error = new WalletNotConnectedForEncryptionError();
      expect(error.code).toBe(EncryptionErrorCode.WALLET_NOT_CONNECTED);
      expect(error.name).toBe('WalletNotConnectedForEncryptionError');
    });

    it('KeyDerivationError', () => {
      const original = new Error('test');
      const error = new KeyDerivationError('Key derivation failed', original);
      expect(error.code).toBe(EncryptionErrorCode.KEY_DERIVATION_FAILED);
      expect(error.originalError).toBe(original);
    });

    it('UserRejectedSigningError', () => {
      const error = new UserRejectedSigningError();
      expect(error.code).toBe(EncryptionErrorCode.USER_REJECTED_SIGNING);
    });

    it('DecryptionFailedError', () => {
      const error = new DecryptionFailedError();
      expect(error.code).toBe(EncryptionErrorCode.DECRYPTION_FAILED);
    });

    it('InvalidPayloadError', () => {
      const error = new InvalidPayloadError('Missing field');
      expect(error.code).toBe(EncryptionErrorCode.INVALID_PAYLOAD);
      expect(error.message).toBe('Missing field');
    });

    it('VersionMismatchError', () => {
      const error = new VersionMismatchError(1, 2);
      expect(error.code).toBe(EncryptionErrorCode.VERSION_MISMATCH);
      expect(error.expectedVersion).toBe(1);
      expect(error.actualVersion).toBe(2);
      expect(error.message).toContain('1');
      expect(error.message).toContain('2');
    });

    it('FileTooLargeError', () => {
      const error = new FileTooLargeError(20 * 1024 * 1024, 10 * 1024 * 1024);
      expect(error.code).toBe(EncryptionErrorCode.FILE_TOO_LARGE);
      expect(error.fileSize).toBe(20 * 1024 * 1024);
      expect(error.maxSize).toBe(10 * 1024 * 1024);
      expect(error.message).toContain('MB');
    });
  });

  describe('isEncryptionError', () => {
    it('should return true for EncryptionError', () => {
      const error = new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED);
      expect(isEncryptionError(error)).toBe(true);
    });

    it('should return true for specialized errors', () => {
      expect(isEncryptionError(new EncryptionNotInitializedError())).toBe(true);
      expect(isEncryptionError(new DecryptionFailedError())).toBe(true);
      expect(isEncryptionError(new FileTooLargeError(100, 50))).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isEncryptionError(new Error('test'))).toBe(false);
    });

    it('should return false for non-Error', () => {
      expect(isEncryptionError('error')).toBe(false);
      expect(isEncryptionError(null)).toBe(false);
      expect(isEncryptionError(undefined)).toBe(false);
    });
  });

  describe('toEncryptionError', () => {
    it('should return same error if already EncryptionError', () => {
      const error = new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED);
      expect(toEncryptionError(error)).toBe(error);
    });

    it('should convert user rejection errors', () => {
      const patterns = ['User rejected', 'user denied', 'User cancelled', 'rejected by user'];
      for (const pattern of patterns) {
        const error = new Error(pattern);
        const converted = toEncryptionError(error);
        expect(converted.code).toBe(EncryptionErrorCode.USER_REJECTED_SIGNING);
      }
    });

    it('should convert decryption errors', () => {
      const patterns = ['decryption failed', 'could not decrypt', 'authentication failed', 'bad mac'];
      for (const pattern of patterns) {
        const error = new Error(pattern);
        const converted = toEncryptionError(error);
        expect(converted.code).toBe(EncryptionErrorCode.DECRYPTION_FAILED);
      }
    });

    it('should convert invalid data errors', () => {
      const patterns = ['invalid format', 'malformed data', 'corrupt payload'];
      for (const pattern of patterns) {
        const error = new Error(pattern);
        const converted = toEncryptionError(error);
        expect(converted.code).toBe(EncryptionErrorCode.INVALID_PAYLOAD);
      }
    });

    it('should convert string errors', () => {
      const converted = toEncryptionError('Something went wrong');
      expect(isEncryptionError(converted)).toBe(true);
      expect(converted.message).toBe('Something went wrong');
    });

    it('should convert unknown errors', () => {
      const converted = toEncryptionError({ foo: 'bar' });
      expect(isEncryptionError(converted)).toBe(true);
      expect(converted.code).toBe(EncryptionErrorCode.ENCRYPTION_FAILED);
    });
  });

  describe('getEncryptionErrorMessage', () => {
    it('should return message from EncryptionError', () => {
      const error = new EncryptionError(
        EncryptionErrorCode.ENCRYPTION_FAILED,
        'Custom message'
      );
      expect(getEncryptionErrorMessage(error)).toBe('Custom message');
    });

    it('should return message from regular Error', () => {
      const error = new Error('Regular error');
      expect(getEncryptionErrorMessage(error)).toBe('Regular error');
    });

    it('should return string directly', () => {
      expect(getEncryptionErrorMessage('String error')).toBe('String error');
    });

    it('should return default message for unknown', () => {
      const message = getEncryptionErrorMessage(null);
      expect(message).toContain('Failed to encrypt');
    });
  });
});
