import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/lib/constants';
import { type WalletError } from '@/lib/near/errors';

/**
 * Connection status states for the wallet.
 * Forms a state machine with defined transitions.
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Auth state shape.
 * Contains only serializable data for persistence.
 */
export interface AuthState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Connected account ID, null if disconnected */
  accountId: string | null;
  /** Type of connected wallet (e.g., 'my-near-wallet', 'here-wallet') */
  walletType: string | null;
  /** Last error that occurred, null if no error */
  error: WalletError | null;
  /** Timestamp of last successful connection */
  lastConnectedAt: number | null;
  /** Number of connection attempts in current session */
  connectionAttempts: number;
}

/**
 * Auth actions for state transitions.
 */
export interface AuthActions {
  /** Transition to connecting state */
  setConnecting: () => void;
  /** Transition to connected state */
  setConnected: (accountId: string, walletType: string) => void;
  /** Transition to disconnected state */
  setDisconnected: () => void;
  /** Transition to reconnecting state (auto-reconnect on page load) */
  setReconnecting: () => void;
  /** Transition to error state */
  setError: (error: WalletError) => void;
  /** Clear error without changing connection status */
  clearError: () => void;
  /** Increment connection attempt counter */
  incrementConnectionAttempts: () => void;
  /** Reset connection attempt counter */
  resetConnectionAttempts: () => void;
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Initial state for the auth store.
 */
const initialState: AuthState = {
  status: 'disconnected',
  accountId: null,
  walletType: null,
  error: null,
  lastConnectedAt: null,
  connectionAttempts: 0,
};

/**
 * Auth store combining state and actions.
 * Persists connection data to localStorage for session recovery.
 */
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setConnecting: () =>
        set((state) => ({
          status: 'connecting',
          error: null,
          connectionAttempts: state.connectionAttempts + 1,
        })),

      setConnected: (accountId: string, walletType: string) =>
        set({
          status: 'connected',
          accountId,
          walletType,
          error: null,
          lastConnectedAt: Date.now(),
        }),

      setDisconnected: () =>
        set({
          status: 'disconnected',
          accountId: null,
          walletType: null,
          error: null,
        }),

      setReconnecting: () =>
        set({
          status: 'reconnecting',
          error: null,
        }),

      setError: (error: WalletError) =>
        set({
          status: 'error',
          error,
        }),

      clearError: () =>
        set({
          error: null,
        }),

      incrementConnectionAttempts: () =>
        set((state) => ({
          connectionAttempts: state.connectionAttempts + 1,
        })),

      resetConnectionAttempts: () =>
        set({
          connectionAttempts: 0,
        }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEYS.WALLET_CONNECTION,
      storage: createJSONStorage(() => localStorage),
      // Only persist essential connection data, not error state
      partialize: (state) => ({
        accountId: state.accountId,
        walletType: state.walletType,
        lastConnectedAt: state.lastConnectedAt,
      }),
      // Handle hydration - set status based on persisted accountId
      onRehydrateStorage: () => (state) => {
        if (state?.accountId) {
          // If we have a persisted accountId, we'll try to reconnect
          // The actual reconnect happens in the useWallet hook
          state.status = 'reconnecting';
        }
      },
    }
  )
);

/**
 * Selector hooks for common state queries.
 * Using selectors prevents unnecessary re-renders.
 */
export const useIsConnected = () =>
  useAuthStore((state) => state.status === 'connected');

export const useIsConnecting = () =>
  useAuthStore((state) => state.status === 'connecting' || state.status === 'reconnecting');

export const useAccountId = () =>
  useAuthStore((state) => state.accountId);

export const useWalletType = () =>
  useAuthStore((state) => state.walletType);

export const useConnectionStatus = () =>
  useAuthStore((state) => state.status);

export const useAuthError = () =>
  useAuthStore((state) => state.error);
