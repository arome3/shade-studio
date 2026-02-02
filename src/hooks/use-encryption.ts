'use client';

import { useCallback, useRef } from 'react';
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
export function useEncryption(): UseEncryptionReturn {
  // Keys stored in ref for security (not in state/store)
  const keysRef = useRef<DerivedKeys | null>(null);

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
    if (status === 'ready' && keysRef.current && storeAccountId === accountId) {
      return; // Already initialized
    }

    try {
      setInitializing();

      // Request signature from wallet
      const signed = await signMessage(KEY_DERIVATION_MESSAGE);

      // Derive keys from signature
      const keys = deriveKeysFromSignature({
        signature: signed.signature,
        publicKey: signed.publicKey,
        accountId: signed.accountId,
      });

      // Store keys in ref (not in state!)
      keysRef.current = keys;

      // Update store with safe metadata only
      setReady(keys.keyId, accountId);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[useEncryption] Encryption initialized for', accountId);
      }
    } catch (err) {
      // Clear any partial state
      if (keysRef.current) {
        clearDerivedKeys(keysRef.current);
        keysRef.current = null;
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
      if (!keysRef.current || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        if (typeof data === 'string') {
          return encryptData(data, keysRef.current.secretKey);
        } else {
          return encryptJson(data, keysRef.current.secretKey);
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
      if (!keysRef.current || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        // Try to decrypt as JSON first, fall back to string
        const decrypted = decryptData(payload, keysRef.current.secretKey);
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
      if (!keysRef.current || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        return await encryptFile(file, keysRef.current.secretKey);
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
      if (!keysRef.current || status !== 'ready') {
        throw new EncryptionNotInitializedError();
      }

      try {
        return await decryptFile(payload, metadata, keysRef.current.secretKey);
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
    if (keysRef.current) {
      clearDerivedKeys(keysRef.current);
      keysRef.current = null;
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
