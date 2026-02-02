/**
 * Custom error classes for NEAR wallet operations.
 * Provides typed errors for better error handling and user feedback.
 */

/**
 * Error codes for wallet-related errors.
 * Used for programmatic error handling and localization.
 */
export enum WalletErrorCode {
  /** Wallet is not connected */
  NOT_CONNECTED = 'NOT_CONNECTED',
  /** Wallet selector has not been initialized */
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  /** The connected wallet doesn't support message signing */
  SIGNING_NOT_SUPPORTED = 'SIGNING_NOT_SUPPORTED',
  /** User rejected the transaction or connection */
  USER_REJECTED = 'USER_REJECTED',
  /** Network error during wallet operation */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Connection timeout */
  TIMEOUT = 'TIMEOUT',
  /** Unknown wallet error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Human-readable error messages for each error code.
 */
const ERROR_MESSAGES: Record<WalletErrorCode, string> = {
  [WalletErrorCode.NOT_CONNECTED]: 'Wallet is not connected. Please connect your wallet to continue.',
  [WalletErrorCode.NOT_INITIALIZED]: 'Wallet selector is initializing. Please wait and try again.',
  [WalletErrorCode.SIGNING_NOT_SUPPORTED]: 'Your wallet does not support message signing. Please try a different wallet.',
  [WalletErrorCode.USER_REJECTED]: 'Transaction was rejected. Please approve the transaction in your wallet.',
  [WalletErrorCode.NETWORK_ERROR]: 'Network error occurred. Please check your connection and try again.',
  [WalletErrorCode.TIMEOUT]: 'Connection timed out. Please try again.',
  [WalletErrorCode.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Base class for all wallet-related errors.
 * Extends Error with a typed code for programmatic handling.
 */
export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly originalError?: unknown;

  constructor(code: WalletErrorCode, message?: string, originalError?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'WalletError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletError);
    }
  }
}

/**
 * Error thrown when an operation requires a connected wallet.
 */
export class WalletNotConnectedError extends WalletError {
  constructor(message?: string) {
    super(WalletErrorCode.NOT_CONNECTED, message);
    this.name = 'WalletNotConnectedError';
  }
}

/**
 * Error thrown when the wallet selector hasn't been initialized.
 */
export class WalletNotInitializedError extends WalletError {
  constructor(message?: string) {
    super(WalletErrorCode.NOT_INITIALIZED, message);
    this.name = 'WalletNotInitializedError';
  }
}

/**
 * Error thrown when the wallet doesn't support required signing capabilities.
 */
export class SigningNotSupportedError extends WalletError {
  constructor(message?: string) {
    super(WalletErrorCode.SIGNING_NOT_SUPPORTED, message);
    this.name = 'SigningNotSupportedError';
  }
}

/**
 * Error thrown when the user rejects a wallet operation.
 */
export class UserRejectedError extends WalletError {
  constructor(message?: string) {
    super(WalletErrorCode.USER_REJECTED, message);
    this.name = 'UserRejectedError';
  }
}

/**
 * Type guard to check if an error is a WalletError.
 * @param error - The error to check
 * @returns true if the error is a WalletError
 */
export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

/**
 * Convert an unknown error to a WalletError.
 * Useful for normalizing errors from external libraries.
 * @param error - The error to convert
 * @returns A WalletError instance
 */
export function toWalletError(error: unknown): WalletError {
  // Already a wallet error
  if (isWalletError(error)) {
    return error;
  }

  // Check for common wallet selector error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // User rejection patterns
    if (
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('user cancelled') ||
      message.includes('rejected by user')
    ) {
      return new UserRejectedError(error.message);
    }

    // Network error patterns
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection')
    ) {
      return new WalletError(WalletErrorCode.NETWORK_ERROR, error.message, error);
    }

    // Timeout patterns
    if (message.includes('timeout') || message.includes('timed out')) {
      return new WalletError(WalletErrorCode.TIMEOUT, error.message, error);
    }

    // Return generic wallet error with original message
    return new WalletError(WalletErrorCode.UNKNOWN, error.message, error);
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return new WalletError(WalletErrorCode.UNKNOWN, error);
  }

  return new WalletError(WalletErrorCode.UNKNOWN, undefined, error);
}

/**
 * Get user-friendly error message for display.
 * @param error - The error to get message for
 * @returns A user-friendly error message
 */
export function getWalletErrorMessage(error: unknown): string {
  if (isWalletError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES[WalletErrorCode.UNKNOWN];
}
