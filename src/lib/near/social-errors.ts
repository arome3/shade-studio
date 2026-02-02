/**
 * Custom error classes for NEAR Social operations.
 * Provides typed errors for better error handling and user feedback.
 */

/**
 * Error codes for NEAR Social operations.
 * Used for programmatic error handling and localization.
 */
export enum SocialErrorCode {
  /** Social client has not been initialized */
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  /** Failed to read data from NEAR Social */
  READ_FAILED = 'READ_FAILED',
  /** Failed to write data to NEAR Social */
  WRITE_FAILED = 'WRITE_FAILED',
  /** Transaction signing failed */
  SIGNING_FAILED = 'SIGNING_FAILED',
  /** User rejected the transaction */
  USER_REJECTED = 'USER_REJECTED',
  /** Requested data was not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Data validation failed */
  INVALID_DATA = 'INVALID_DATA',
  /** Insufficient storage deposit for write operation */
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  /** Network error during operation */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Human-readable error messages for each error code.
 */
const ERROR_MESSAGES: Record<SocialErrorCode, string> = {
  [SocialErrorCode.NOT_INITIALIZED]: 'NEAR Social client is not initialized. Please wait and try again.',
  [SocialErrorCode.READ_FAILED]: 'Failed to read data from NEAR Social. Please try again.',
  [SocialErrorCode.WRITE_FAILED]: 'Failed to save data to NEAR Social. Please try again.',
  [SocialErrorCode.SIGNING_FAILED]: 'Failed to sign the transaction. Please try again.',
  [SocialErrorCode.USER_REJECTED]: 'Transaction was rejected. Please approve the transaction in your wallet.',
  [SocialErrorCode.NOT_FOUND]: 'The requested data was not found.',
  [SocialErrorCode.INVALID_DATA]: 'The data format is invalid. Please check your input.',
  [SocialErrorCode.INSUFFICIENT_STORAGE]: 'Insufficient storage deposit. Please add more NEAR for storage.',
  [SocialErrorCode.NETWORK_ERROR]: 'Network error occurred. Please check your connection and try again.',
  [SocialErrorCode.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Base class for all NEAR Social errors.
 * Extends Error with a typed code for programmatic handling.
 */
export class SocialError extends Error {
  readonly code: SocialErrorCode;
  readonly originalError?: unknown;

  constructor(code: SocialErrorCode, message?: string, originalError?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'SocialError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SocialError);
    }
  }
}

/**
 * Error thrown when NEAR Social client hasn't been initialized.
 */
export class SocialNotInitializedError extends SocialError {
  constructor(message?: string) {
    super(SocialErrorCode.NOT_INITIALIZED, message);
    this.name = 'SocialNotInitializedError';
  }
}

/**
 * Error thrown when reading from NEAR Social fails.
 */
export class SocialReadError extends SocialError {
  constructor(message?: string, originalError?: unknown) {
    super(SocialErrorCode.READ_FAILED, message, originalError);
    this.name = 'SocialReadError';
  }
}

/**
 * Error thrown when writing to NEAR Social fails.
 */
export class SocialWriteError extends SocialError {
  constructor(message?: string, originalError?: unknown) {
    super(SocialErrorCode.WRITE_FAILED, message, originalError);
    this.name = 'SocialWriteError';
  }
}

/**
 * Error thrown when the user rejects a transaction.
 */
export class SocialUserRejectedError extends SocialError {
  constructor(message?: string) {
    super(SocialErrorCode.USER_REJECTED, message);
    this.name = 'SocialUserRejectedError';
  }
}

/**
 * Error thrown when requested data is not found.
 */
export class SocialNotFoundError extends SocialError {
  constructor(message?: string) {
    super(SocialErrorCode.NOT_FOUND, message);
    this.name = 'SocialNotFoundError';
  }
}

/**
 * Error thrown when data validation fails.
 */
export class SocialInvalidDataError extends SocialError {
  constructor(message?: string) {
    super(SocialErrorCode.INVALID_DATA, message);
    this.name = 'SocialInvalidDataError';
  }
}

/**
 * Error thrown when there's insufficient storage deposit.
 */
export class SocialInsufficientStorageError extends SocialError {
  constructor(message?: string) {
    super(SocialErrorCode.INSUFFICIENT_STORAGE, message);
    this.name = 'SocialInsufficientStorageError';
  }
}

/**
 * Type guard to check if an error is a SocialError.
 * @param error - The error to check
 * @returns true if the error is a SocialError
 */
export function isSocialError(error: unknown): error is SocialError {
  return error instanceof SocialError;
}

/**
 * Convert an unknown error to a SocialError.
 * Useful for normalizing errors from external libraries.
 * @param error - The error to convert
 * @returns A SocialError instance
 */
export function toSocialError(error: unknown): SocialError {
  // Already a social error
  if (isSocialError(error)) {
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
      return new SocialUserRejectedError(error.message);
    }

    // Network error patterns
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return new SocialError(SocialErrorCode.NETWORK_ERROR, error.message, error);
    }

    // Storage/deposit patterns
    if (
      message.includes('storage') ||
      message.includes('deposit') ||
      message.includes('not enough balance')
    ) {
      return new SocialInsufficientStorageError(error.message);
    }

    // Not found patterns
    if (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('no such')
    ) {
      return new SocialNotFoundError(error.message);
    }

    // Return generic social error with original message
    return new SocialError(SocialErrorCode.UNKNOWN, error.message, error);
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return new SocialError(SocialErrorCode.UNKNOWN, error);
  }

  return new SocialError(SocialErrorCode.UNKNOWN, undefined, error);
}

/**
 * Get user-friendly error message for display.
 * @param error - The error to get message for
 * @returns A user-friendly error message
 */
export function getSocialErrorMessage(error: unknown): string {
  if (isSocialError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES[SocialErrorCode.UNKNOWN];
}
