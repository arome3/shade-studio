/**
 * Zustand store for project sub-account state.
 *
 * Intentionally has NO persist/devtools middleware — sub-account data
 * includes sensitive access key references. On-chain state via RPC
 * is the source of truth.
 */

import { create } from 'zustand';
import type {
  ProjectSubAccount,
  ProjectTeamMember,
  AccessKeyInfo,
} from '@/types/project-accounts';

// ============================================================================
// Status Type
// ============================================================================

export type ProjectAccountStatus =
  | 'idle'
  | 'creating'
  | 'adding-member'
  | 'revoking-member'
  | 'loading'
  | 'error';

// ============================================================================
// State & Actions
// ============================================================================

export interface ProjectAccountsState {
  /** Current operation status */
  status: ProjectAccountStatus;
  /** Project ID → sub-account mapping */
  subAccounts: Record<string, ProjectSubAccount>;
  /** Sub-account ID → team members */
  teamMembers: Record<string, ProjectTeamMember[]>;
  /** Sub-account ID → on-chain access keys */
  accessKeys: Record<string, AccessKeyInfo[]>;
  /** Last error */
  error: Error | null;
}

export interface ProjectAccountsActions {
  // Status
  setStatus: (status: ProjectAccountStatus) => void;
  setError: (error: Error) => void;
  clearError: () => void;

  // Sub-accounts
  setSubAccount: (projectId: string, subAccount: ProjectSubAccount) => void;
  removeSubAccount: (projectId: string) => void;

  // Team members
  setTeamMembers: (subAccountId: string, members: ProjectTeamMember[]) => void;
  addTeamMember: (subAccountId: string, member: ProjectTeamMember) => void;
  updateTeamMember: (
    subAccountId: string,
    memberAccountId: string,
    updates: Partial<ProjectTeamMember>
  ) => void;
  removeTeamMember: (subAccountId: string, memberAccountId: string) => void;

  // Access keys
  setAccessKeys: (subAccountId: string, keys: AccessKeyInfo[]) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ProjectAccountsState = {
  status: 'idle',
  subAccounts: {},
  teamMembers: {},
  accessKeys: {},
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useProjectAccountsStore = create<
  ProjectAccountsState & ProjectAccountsActions
>()((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setError: (error) =>
    set({ status: 'error', error }),

  clearError: () =>
    set({ error: null }),

  setSubAccount: (projectId, subAccount) =>
    set((state) => ({
      subAccounts: { ...state.subAccounts, [projectId]: subAccount },
      status: 'idle',
      error: null,
    })),

  removeSubAccount: (projectId) =>
    set((state) => {
      const { [projectId]: _, ...rest } = state.subAccounts;
      return { subAccounts: rest };
    }),

  setTeamMembers: (subAccountId, members) =>
    set((state) => ({
      teamMembers: { ...state.teamMembers, [subAccountId]: members },
    })),

  addTeamMember: (subAccountId, member) =>
    set((state) => ({
      teamMembers: {
        ...state.teamMembers,
        [subAccountId]: [
          ...(state.teamMembers[subAccountId] ?? []),
          member,
        ],
      },
      status: 'idle',
      error: null,
    })),

  updateTeamMember: (subAccountId, memberAccountId, updates) =>
    set((state) => ({
      teamMembers: {
        ...state.teamMembers,
        [subAccountId]: (state.teamMembers[subAccountId] ?? []).map((m) =>
          m.accountId === memberAccountId ? { ...m, ...updates } : m
        ),
      },
    })),

  removeTeamMember: (subAccountId, memberAccountId) =>
    set((state) => ({
      teamMembers: {
        ...state.teamMembers,
        [subAccountId]: (state.teamMembers[subAccountId] ?? []).filter(
          (m) => m.accountId !== memberAccountId
        ),
      },
      status: 'idle',
      error: null,
    })),

  setAccessKeys: (subAccountId, keys) =>
    set((state) => ({
      accessKeys: { ...state.accessKeys, [subAccountId]: keys },
    })),

  reset: () => set(initialState),
}));

// ============================================================================
// Selector Hooks
// ============================================================================

// Stable empty arrays to prevent infinite re-render loops in Zustand v5 selectors.
// Returning `?? []` inline creates a new reference each render, which
// useSyncExternalStore interprets as "changed" → infinite loop.
const EMPTY_MEMBERS: ProjectTeamMember[] = [];
const EMPTY_KEYS: AccessKeyInfo[] = [];

/** Get the sub-account for a project */
export const useProjectSubAccount = (projectId: string) =>
  useProjectAccountsStore((state) => state.subAccounts[projectId]);

/** Get team members for a sub-account */
export const useProjectTeamMembers = (subAccountId: string) =>
  useProjectAccountsStore(
    (state) => state.teamMembers[subAccountId] ?? EMPTY_MEMBERS
  );

/** Get on-chain access keys for a sub-account */
export const useProjectAccessKeys = (subAccountId: string) =>
  useProjectAccountsStore(
    (state) => state.accessKeys[subAccountId] ?? EMPTY_KEYS
  );

/** Get the current operation status */
export const useProjectAccountStatus = () =>
  useProjectAccountsStore((state) => state.status);

/** Get the current error */
export const useProjectAccountError = () =>
  useProjectAccountsStore((state) => state.error);
