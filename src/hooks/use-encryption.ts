'use client';

import { useCallback } from 'react';
import { useEncryptionStore, type EncryptionStatus } from '@/stores/encryption-store';
import { useWallet } from './use-wallet';
import { type EncryptedPayload } from '@/types/document';
import {
  type DerivedKeys,
  KEY_DERIVATION_MESSAGE,
  deriveKeysFromSignature,
  clearDerivedKeys,
  encryptData,
  decryptData,
  encryptJson,
  encryptFile,
  decryptFile,
  isEncryptedPayload,
  toEncryptionError,
  EncryptionNotInitializedError,
  WalletNotConnectedForEncryptionError,
  UserRejectedSigningError,
} from '@/lib/crypto';
import { consumeSignMessageResult } from '@/lib/near/sign-message-callback';

/**
 * File metadata returned with encrypted files.
 */
export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

/**
 * Return type for the useEncryption hook.
 */
export interface UseEncryptionReturn {
  // State
  status: EncryptionStatus;
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  keyId: string | null;

  // Actions
  initialize: () => Promise<void>;
  encrypt: (data: string | object) => Promise<EncryptedPayload>;
  decrypt: <T = string>(payload: EncryptedPayload) => Promise<T>;
  encryptFileData: (file: File) => Promise<{ payload: EncryptedPayload; metadata: FileMetadata }>;
  decryptFileData: (payload: EncryptedPayload, metadata: FileMetadata) => Promise<File>;
  lock: () => void;

  // Utilities
  isEncrypted: (data: unknown) => data is EncryptedPayload;
}

/**
 * Main encryption hook for client-side encryption.
 *
 * Keys are stored in a ref (not in state/store) for security:
 * - Not visible in React devtools
 * - Not serialized by Zustand
 * - Cleared on unmount/lock
 *
 * @example
 * function SecureEditor() {
 *   const { isReady, encrypt, decrypt, initialize } = useEncryption();
 *
 *   useEffect(() => {
 *     if (!isReady) {
 *       initialize();
 *     }
 *   }, [isReady, initialize]);
 *
 *   const handleSave = async (content: string) => {
 *     const encrypted = await encrypt(content);
 *     // Store encrypted payload...
 *   };
 * }
 */
// Module-level key storage — shared across all useEncryption() instances.
// Not in React state/store/ref so it's invisible to devtools and not serialized.
// Cleared when lock() is called or the page unloads.
let sharedKeys: DerivedKeys | null = null;

export function useEncryption(): UseEncryptionReturn {
  // Get wallet state and actions
  const { isConnected, accountId, signMessage } = useWallet();

  // Get encryption store state and actions
  const status = useEncryptionStore((state) => state.status);
  const keyId = useEncryptionStore((state) => state.keyId);
  const error = useEncryptionStore((state) => state.error);
  const storeAccountId = useEncryptionStore((state) => state.accountId);

  const setInitializing = useEncryptionStore((state) => state.setInitializing);
  const setReady = useEncryptionStore((state) => state.setReady);
  const setError = useEncryptionStore((state) => state.setError);
  const setLocked = useEncryptionStore((state) => state.setLocked);

  /**
   * Initialize encryption by deriving keys from wallet signature.
   * Requires wallet to be connected.
   */
  const initialize = useCallback(async () => {
    // Check if wallet is connected
    if (!isConnected || !accountId) {
      throw new WalletNotConnectedForEncryptionError();
    }

    // Check if already initialized for this account
    if (status === 'ready' && sharedKeys && storeAccountId === accountId) {
      return; // Already initialized
    }

    try {
      setInitializing();

      // Check for a pending sign-message callback from a redirect wallet
      // (e.g., MyNearWallet returns with signature in URL hash after redirect)
      const callbackResult = consumeSignMessageResult();

      let signed: { signature: string; publicKey: string; accountId: string };

      if (callbackResult && callbackResult.accountId === accountId) {
        // Use the captured callback result — no need to redirect again
        signed = {
          signature: callbackResult.signature,
          publicKey: callbackResult.publicKey,
          accountId: callbackResult.accountId,
        };

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useEncryption] Using captured sign-message callback');
        }
      } else {
        // Request signature from wallet (injected wallets resolve inline,
        // redirect wallets will navigate away and return via callback)
        signed = await signMessage(KEY_DERIVATION_MESSAGE);
      }

      // Derive keys from signature
      const keys = deriveKeysFromSignature({
        signature: signed.signature,
        publicKey: signed.publicKey,
        accountId: signed.accountId,
      });

      // Store keys at module level (shared across all hook instances)
      sharedKeys = keys;

      // Update store with safe metadata only
      setReady(keys.keyId, accountId);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[useEncryption] Encryption initialized for', accountId);
      }
    } catch (err) {
      // Clear any partial state
      if (sharedKeys) {
        clearDerivedKeys(sharedKeys);
        sharedKeys = null;
      }

      // Check for user rejection
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        message.includes('user rejected') ||
        message.includes('user denied') ||
        message.includes('cancelled')
      ) {
        const rejectionError = new UserRejectedSigningError();
        setError(rejectionError);
        throw rejectionError;
      }

      const encryptionError = toEncryptionError(err);
      setError(encryptionError);
      throw encryptionError;
    }
  }, [
    isConnected,
    accountId,
    status,
    storeAccountId,
    signMessage,
    setInitializing,
    setReady,
    setError,
  ]);

  /**
   * Encrypt data (string or JSON-serializable object).
   */
  const encrypt = useCallback(
    async (data: string | object): Promise<EncryptedPayload> => {
      if (!sharedKeys || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        if (typeof data === 'string') {
          return encryptData(data, sharedKeys.secretKey);
        } else {
          return encryptJson(data, sharedKeys.secretKey);
        }
      } catch (err) {
        throw toEncryptionError(err);
      }
    },
    [status]
  );

  /**
   * Decrypt data.
   * Returns string by default, or parsed JSON if type parameter provided.
   */
  const decrypt = useCallback(
    async <T = string>(payload: EncryptedPayload): Promise<T> => {
      if (!sharedKeys || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        // Try to decrypt as JSON first, fall back to string
        const decrypted = decryptData(payload, sharedKeys.secretKey);
        const text = new TextDecoder().decode(decrypted);

        // Try to parse as JSON
        try {
          return JSON.parse(text) as T;
        } catch {
          // Not JSON, return as string
          return text as unknown as T;
        }
      } catch (err) {
        throw toEncryptionError(err);
      }
    },
    [status]
  );

  /**
   * Encrypt a file.
   */
  const encryptFileData = useCallback(
    async (
      file: File
    ): Promise<{ payload: EncryptedPayload; metadata: FileMetadata }> => {
      if (!sharedKeys || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        return await encryptFile(file, sharedKeys.secretKey);
      } catch (err) {
        throw toEncryptionError(err);
      }
    },
    [status]
  );

  /**
   * Decrypt a file.
   */
  const decryptFileData = useCallback(
    async (payload: EncryptedPayload, metadata: FileMetadata): Promise<File> => {
      if (!sharedKeys || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        return await decryptFile(payload, metadata, sharedKeys.secretKey);
      } catch (err) {
        throw toEncryptionError(err);
      }
    },
    [status]
  );

  /**
   * Lock encryption (clear keys from memory).
   * Called automatically when wallet disconnects.
   */
  const lock = useCallback(() => {
    // Securely clear keys
    if (sharedKeys) {
      clearDerivedKeys(sharedKeys);
      sharedKeys = null;
    }

    setLocked();

    if (process.env.NODE_ENV === 'development') {
      console.debug('[useEncryption] Encryption locked, keys cleared');
    }
  }, [setLocked]);

  /**
   * Check if data is an encrypted payload.
   */
  const isEncrypted = useCallback(
    (data: unknown): data is EncryptedPayload => {
      return isEncryptedPayload(data);
    },
    []
  );

  return {
    // State
    status,
    isReady: status === 'ready',
    isInitializing: status === 'initializing',
    error,
    keyId,

    // Actions
    initialize,
    encrypt,
    decrypt,
    encryptFileData,
    decryptFileData,
    lock,

    // Utilities
    isEncrypted,
  };
}
