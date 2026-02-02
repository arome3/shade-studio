/**
 * Client-side encryption module for Private Grant Studio.
 * Provides TweetNaCl-based encryption with wallet-derived keys.
 */

// Utils
export {
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
} from './utils';

// Errors
export {
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
} from './errors';

// Encryption
export {
  ENCRYPTION_VERSION,
  encryptData,
  decryptData,
  encryptJson,
  decryptJson,
  encryptFile,
  decryptFile,
  isEncryptedPayload,
  encryptToString,
  decryptFromString,
} from './encryption';

// Key Management
export {
  KEY_DERIVATION_MESSAGE,
  type DerivedKeys,
  type KeyDerivationInput,
  deriveKeysFromSignature,
  validateSecretKey,
  clearKey,
  clearDerivedKeys,
  generateRandomKey,
  exportKeyToBase64,
  importKeyFromBase64,
  deriveSubKey,
} from './key-management';
