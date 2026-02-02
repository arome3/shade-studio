import { create } from 'zustand';
import { type EncryptionError } from '@/lib/crypto/errors';

/**
 * Encryption status states.
 * Forms a state machine with defined transitions.
 */
export type EncryptionStatus =
  | 'uninitialized'  // Not yet initialized
  | 'initializing'   // Key derivation in progress
  | 'ready'          // Keys derived and ready for use
  | 'error'          // Error during initialization
  | 'locked';        // Keys cleared (wallet disconnected)

/**
 * Encryption state shape.
 *
 * CRITICAL: Keys are NOT stored here!
 * Keys exist only in memory within the useEncryption hook's useRef.
 * This prevents them from being visible in devtools or persisted.
 */
export interface EncryptionState {
  /** Current encryption status */
  status: EncryptionStatus;
  /** Hash of public key for identification (NOT the key itself) */
  keyId: string | null;
  /** Last error that occurred, null if no error */
  error: EncryptionError | null;
  /** Timestamp when encryption was initialized */
  initializedAt: number | null;
  /** Account ID that owns the current keys */
  accountId: string | null;
}

/**
 * Encryption actions for state transitions.
 */
export interface EncryptionActions {
  /** Transition to initializing state */
  setInitializing: () => void;
  /** Transition to ready state with keyId */
  setReady: (keyId: string, accountId: string) => void;
  /** Transition to error state */
  setError: (error: EncryptionError) => void;
  /** Transition to locked state (keys cleared) */
  setLocked: () => void;
  /** Clear error without changing status */
  clearError: () => void;
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Initial state for the encryption store.
 */
const initialState: EncryptionState = {
  status: 'uninitialized',
  keyId: null,
  error: null,
  initializedAt: null,
  accountId: null,
};

/**
 * Encryption store combining state and actions.
 *
 * NOTE: This store intentionally does NOT persist anything.
 * Keys are derived fresh each session from wallet signatures.
 * This is a security feature, not a bug!
 */
export const useEncryptionStore = create<EncryptionState & EncryptionActions>()(
  (set) => ({
    ...initialState,

    setInitializing: () =>
      set({
        status: 'initializing',
        error: null,
      }),

    setReady: (keyId: string, accountId: string) =>
      set({
        status: 'ready',
        keyId,
        accountId,
        error: null,
        initializedAt: Date.now(),
      }),

    setError: (error: EncryptionError) =>
      set({
        status: 'error',
        error,
      }),

    setLocked: () =>
      set({
        status: 'locked',
        keyId: null,
        accountId: null,
        error: null,
      }),

    clearError: () =>
      set({
        error: null,
      }),

    reset: () => set(initialState),
  })
);

/**
 * Selector hooks for common state queries.
 * Using selectors prevents unnecessary re-renders.
 */
export const useEncryptionStatus = () =>
  useEncryptionStore((state) => state.status);

export const useIsEncryptionReady = () =>
  useEncryptionStore((state) => state.status === 'ready');

export const useIsEncryptionInitializing = () =>
  useEncryptionStore((state) => state.status === 'initializing');

export const useEncryptionKeyId = () =>
  useEncryptionStore((state) => state.keyId);

export const useEncryptionError = () =>
  useEncryptionStore((state) => state.error);

export const useEncryptionAccountId = () =>
  useEncryptionStore((state) => state.accountId);
