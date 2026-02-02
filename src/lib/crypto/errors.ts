/**
 * Custom error classes for encryption operations.
 * Provides typed errors for better error handling and user feedback.
 */

/**
 * Error codes for encryption-related errors.
 * Used for programmatic error handling and localization.
 */
export enum EncryptionErrorCode {
  /** Encryption has not been initialized */
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  /** Wallet is not connected (required for key derivation) */
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  /** Key derivation from wallet signature failed */
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  /** User rejected the signing request */
  USER_REJECTED_SIGNING = 'USER_REJECTED_SIGNING',
  /** Encryption operation failed */
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  /** Decryption operation failed (wrong key or tampered data) */
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  /** Invalid encrypted payload format */
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  /** Encryption version mismatch */
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  /** File exceeds maximum size limit */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  /** Invalid key format or length */
  INVALID_KEY = 'INVALID_KEY',
}

/**
 * Human-readable error messages for each error code.
 */
const ERROR_MESSAGES: Record<EncryptionErrorCode, string> = {
  [EncryptionErrorCode.NOT_INITIALIZED]:
    'Encryption has not been initialized. Please connect your wallet first.',
  [EncryptionErrorCode.WALLET_NOT_CONNECTED]:
    'Wallet is not connected. Please connect your wallet to enable encryption.',
  [EncryptionErrorCode.KEY_DERIVATION_FAILED]:
    'Failed to derive encryption keys from wallet signature. Please try again.',
  [EncryptionErrorCode.USER_REJECTED_SIGNING]:
    'Signing request was rejected. Please approve the signature to enable encryption.',
  [EncryptionErrorCode.ENCRYPTION_FAILED]:
    'Failed to encrypt data. Please try again.',
  [EncryptionErrorCode.DECRYPTION_FAILED]:
    'Failed to decrypt data. The data may be corrupted or encrypted with a different key.',
  [EncryptionErrorCode.INVALID_PAYLOAD]:
    'Invalid encrypted data format. The data may be corrupted.',
  [EncryptionErrorCode.VERSION_MISMATCH]:
    'Encryption version mismatch. The data was encrypted with an incompatible version.',
  [EncryptionErrorCode.FILE_TOO_LARGE]:
    'File is too large to encrypt. Please choose a smaller file.',
  [EncryptionErrorCode.INVALID_KEY]:
    'Invalid encryption key. Please reconnect your wallet.',
};

/**
 * Base class for all encryption-related errors.
 * Extends Error with a typed code for programmatic handling.
 */
export class EncryptionError extends Error {
  readonly code: EncryptionErrorCode;
  readonly originalError?: unknown;

  constructor(code: EncryptionErrorCode, message?: string, originalError?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'EncryptionError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError);
    }
  }
}

/**
 * Error thrown when encryption has not been initialized.
 */
export class EncryptionNotInitializedError extends EncryptionError {
  constructor(message?: string) {
    super(EncryptionErrorCode.NOT_INITIALIZED, message);
    this.name = 'EncryptionNotInitializedError';
  }
}

/**
 * Error thrown when wallet is not connected but encryption is attempted.
 */
export class WalletNotConnectedForEncryptionError extends EncryptionError {
  constructor(message?: string) {
    super(EncryptionErrorCode.WALLET_NOT_CONNECTED, message);
    this.name = 'WalletNotConnectedForEncryptionError';
  }
}

/**
 * Error thrown when key derivation fails.
 */
export class KeyDerivationError extends EncryptionError {
  constructor(message?: string, originalError?: unknown) {
    super(EncryptionErrorCode.KEY_DERIVATION_FAILED, message, originalError);
    this.name = 'KeyDerivationError';
  }
}

/**
 * Error thrown when user rejects the signing request.
 */
export class UserRejectedSigningError extends EncryptionError {
  constructor(message?: string) {
    super(EncryptionErrorCode.USER_REJECTED_SIGNING, message);
    this.name = 'UserRejectedSigningError';
  }
}

/**
 * Error thrown when decryption fails.
 */
export class DecryptionFailedError extends EncryptionError {
  constructor(message?: string, originalError?: unknown) {
    super(EncryptionErrorCode.DECRYPTION_FAILED, message, originalError);
    this.name = 'DecryptionFailedError';
  }
}

/**
 * Error thrown when the encrypted payload is invalid.
 */
export class InvalidPayloadError extends EncryptionError {
  constructor(message?: string) {
    super(EncryptionErrorCode.INVALID_PAYLOAD, message);
    this.name = 'InvalidPayloadError';
  }
}

/**
 * Error thrown when encryption version doesn't match.
 */
export class VersionMismatchError extends EncryptionError {
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      EncryptionErrorCode.VERSION_MISMATCH,
      `Expected encryption version ${expectedVersion}, but got ${actualVersion}`
    );
    this.name = 'VersionMismatchError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Error thrown when a file exceeds the size limit.
 */
export class FileTooLargeError extends EncryptionError {
  readonly fileSize: number;
  readonly maxSize: number;

  constructor(fileSize: number, maxSize: number) {
    super(
      EncryptionErrorCode.FILE_TOO_LARGE,
      `File size (${formatBytes(fileSize)}) exceeds maximum (${formatBytes(maxSize)})`
    );
    this.name = 'FileTooLargeError';
    this.fileSize = fileSize;
    this.maxSize = maxSize;
  }
}

/**
 * Type guard to check if an error is an EncryptionError.
 * @param error - The error to check
 * @returns true if the error is an EncryptionError
 */
export function isEncryptionError(error: unknown): error is EncryptionError {
  return error instanceof EncryptionError;
}

/**
 * Convert an unknown error to an EncryptionError.
 * Useful for normalizing errors from external libraries.
 * @param error - The error to convert
 * @returns An EncryptionError instance
 */
export function toEncryptionError(error: unknown): EncryptionError {
  // Already an encryption error
  if (isEncryptionError(error)) {
    return error;
  }

  // Check for common error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // User rejection patterns
    if (
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('user cancelled') ||
      message.includes('rejected by user')
    ) {
      return new UserRejectedSigningError(error.message);
    }

    // Decryption failure patterns
    if (
      message.includes('decryption') ||
      message.includes('decrypt') ||
      message.includes('authentication failed') ||
      message.includes('bad mac')
    ) {
      return new DecryptionFailedError(error.message, error);
    }

    // Invalid data patterns
    if (
      message.includes('invalid') ||
      message.includes('malformed') ||
      message.includes('corrupt')
    ) {
      return new InvalidPayloadError(error.message);
    }

    // Return generic encryption error with original message
    return new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED, error.message, error);
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED, error);
  }

  return new EncryptionError(EncryptionErrorCode.ENCRYPTION_FAILED, undefined, error);
}

/**
 * Get user-friendly error message for display.
 * @param error - The error to get message for
 * @returns A user-friendly error message
 */
export function getEncryptionErrorMessage(error: unknown): string {
  if (isEncryptionError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES[EncryptionErrorCode.ENCRYPTION_FAILED];
}

/**
 * Format bytes to human-readable string.
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "10 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
