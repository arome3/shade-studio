/**
 * Credential Store
 *
 * Manages on-chain ZK credential state. Follows the same Zustand v5 pattern
 * as proof-store.ts: devtools + persist middleware with partialize.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { OnChainCredential } from '@/types/zk';

// ============================================================================
// Types
// ============================================================================

export interface CredentialState {
  /** Credentials keyed by ID */
  credentials: Record<string, OnChainCredential>;
  /** Credential IDs in newest-first order */
  credentialOrder: string[];
  /** Timestamp of last fetch from chain */
  lastFetchedAt: number | null;
  /** Whether credentials are currently being fetched */
  isFetching: boolean;
  /** Error message if any */
  error: string | null;
}

export interface CredentialActions {
  setCredentials: (credentials: OnChainCredential[]) => void;
  addCredential: (credential: OnChainCredential) => void;
  removeCredential: (id: string) => void;
  setFetching: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: CredentialState = {
  credentials: {},
  credentialOrder: [],
  lastFetchedAt: null,
  isFetching: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useCredentialStore = create<CredentialState & CredentialActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setCredentials: (credentials: OnChainCredential[]) =>
          set(
            () => {
              const record: Record<string, OnChainCredential> = {};
              const order: string[] = [];
              for (const cred of credentials) {
                record[cred.id] = cred;
                order.push(cred.id);
              }
              return {
                credentials: record,
                credentialOrder: order,
                lastFetchedAt: Date.now(),
              };
            },
            false,
            'setCredentials'
          ),

        addCredential: (credential: OnChainCredential) =>
          set(
            (state) => ({
              credentials: { ...state.credentials, [credential.id]: credential },
              credentialOrder: [credential.id, ...state.credentialOrder],
            }),
            false,
            'addCredential'
          ),

        removeCredential: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remaining } = state.credentials;
              return {
                credentials: remaining,
                credentialOrder: state.credentialOrder.filter((cid) => cid !== id),
              };
            },
            false,
            'removeCredential'
          ),

        setFetching: (fetching: boolean) =>
          set(
            { isFetching: fetching, ...(fetching ? { error: null } : {}) },
            false,
            'setFetching'
          ),

        setError: (error: string | null) =>
          set(
            { error, isFetching: false },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        reset: () =>
          set(initialState, false, 'reset'),
      }),
      {
        name: 'credential-store',
        partialize: (state) => ({
          credentials: state.credentials,
          credentialOrder: state.credentialOrder,
          lastFetchedAt: state.lastFetchedAt,
        }),
      }
    ),
    {
      name: 'credential-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the credentials record. */
export const useCredentialsRecord = () =>
  useCredentialStore((state) => state.credentials);

/** Get a single credential by ID. */
export const useCredentialById = (id: string) =>
  useCredentialStore((state) => state.credentials[id] ?? null);

/** Get the credential order array. */
export const useCredentialOrder = () =>
  useCredentialStore((state) => state.credentialOrder);

/** Check if credentials are being fetched. */
export const useCredentialsFetching = () =>
  useCredentialStore((state) => state.isFetching);

/** Get the current error. */
export const useCredentialsError = () =>
  useCredentialStore((state) => state.error);
