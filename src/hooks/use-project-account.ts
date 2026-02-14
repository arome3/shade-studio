'use client';

/**
 * Composition hook for project sub-account management.
 *
 * Composes:
 * - useWallet() for auth state and wallet selector access
 * - useEncryption() for encrypting stored private keys
 * - useProjectAccountsStore for UI state
 * - lib/near/project-accounts for RPC queries and action builders
 * - lib/near/access-keys for key pair generation and storage
 */

import { useCallback, useEffect, useRef } from 'react';
import { useWallet } from './use-wallet';
import { useEncryption } from './use-encryption';
import {
  useProjectAccountsStore,
  useProjectSubAccount,
  useProjectTeamMembers,
  useProjectAccessKeys,
  useProjectAccountStatus,
  useProjectAccountError,
  type ProjectAccountStatus,
} from '@/stores/project-accounts-store';
import {
  validateSubAccountName as validateName,
  checkAccountExists,
  getAccessKeyList,
  buildCreateSubAccountActions,
  buildAddKeyAction,
  buildDeleteKeyAction,
  inferPermissionFromAccessKey,
  type SubAccountValidation,
} from '@/lib/near/project-accounts';
import { generateKeyPair, storeEncryptedKey } from '@/lib/near/access-keys';
import { getWalletSelector } from '@/lib/near/wallet';
import { isValidAccountId } from '@/lib/near/config';
import { WalletNotConnectedError, WalletNotInitializedError } from '@/lib/near/errors';
import type {
  ProjectSubAccount,
  ProjectTeamMember,
  AccessKeyInfo,
  CreateSubAccountInput,
  AddTeamMemberInput,
  AddTeamMemberResult,
} from '@/types/project-accounts';

// ============================================================================
// Return Type
// ============================================================================

export interface UseProjectAccountReturn {
  // State
  status: ProjectAccountStatus;
  subAccount: ProjectSubAccount | undefined;
  teamMembers: ProjectTeamMember[];
  accessKeys: AccessKeyInfo[];
  error: Error | null;
  isCreating: boolean;
  isLoading: boolean;

  // Actions
  createSubAccount: (input: CreateSubAccountInput) => Promise<ProjectSubAccount>;
  checkSubAccountExists: (accountId: string) => Promise<boolean>;
  addTeamMember: (input: AddTeamMemberInput) => Promise<AddTeamMemberResult>;
  revokeTeamMember: (subAccountId: string, publicKey: string) => Promise<void>;
  refreshAccessKeys: (subAccountId: string) => Promise<void>;
  validateSubAccountName: (name: string) => SubAccountValidation;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for project sub-account management.
 *
 * @param projectId - The project ID to scope operations to
 */
export function useProjectAccount(projectId: string): UseProjectAccountReturn {
  const { isConnected, accountId } = useWallet();
  const { encrypt } = useEncryption();
  const abortRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Store selectors
  const subAccount = useProjectSubAccount(projectId);
  const subAccountId = subAccount?.accountId ?? '';
  const teamMembers = useProjectTeamMembers(subAccountId);
  const accessKeys = useProjectAccessKeys(subAccountId);
  const status = useProjectAccountStatus();
  const error = useProjectAccountError();

  // Store actions
  const setStatus = useProjectAccountsStore((s) => s.setStatus);
  const setError = useProjectAccountsStore((s) => s.setError);
  const setSubAccount = useProjectAccountsStore((s) => s.setSubAccount);
  const addTeamMemberToStore = useProjectAccountsStore((s) => s.addTeamMember);
  const updateTeamMember = useProjectAccountsStore((s) => s.updateTeamMember);
  const setAccessKeys = useProjectAccountsStore((s) => s.setAccessKeys);
  const setTeamMembers = useProjectAccountsStore((s) => s.setTeamMembers);

  /**
   * Validate a sub-account name against the current user's account.
   */
  const validateSubAccountName = useCallback(
    (name: string): SubAccountValidation => {
      if (!accountId) {
        return { valid: false, error: 'Wallet not connected' };
      }
      return validateName(name, accountId);
    },
    [accountId]
  );

  /**
   * Check if a sub-account exists on-chain.
   */
  const checkSubAccountExistsFn = useCallback(
    async (targetAccountId: string): Promise<boolean> => {
      const result = await checkAccountExists(targetAccountId);
      return result !== null;
    },
    []
  );

  /**
   * Create a new NEAR sub-account for this project.
   *
   * Flow:
   * 1. Validate name and check it doesn't already exist
   * 2. Generate a key pair for the owner
   * 3. Build CreateAccount + Transfer + AddKey actions
   * 4. Sign and send via wallet
   * 5. Store encrypted key and update store
   */
  const createSubAccount = useCallback(
    async (input: CreateSubAccountInput): Promise<ProjectSubAccount> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      // Validate name
      const validation = validateName(input.subAccountName, accountId);
      if (!validation.valid || !validation.fullAccountId) {
        throw new Error(validation.error ?? 'Invalid sub-account name');
      }

      const fullAccountId = validation.fullAccountId;
      const deposit = input.initialDeposit ?? '0.1';

      try {
        setStatus('creating');

        // Check if account already exists
        const exists = await checkAccountExists(fullAccountId);
        if (exists) {
          throw new Error(`Account ${fullAccountId} already exists`);
        }

        // Generate owner key pair
        const keyPair = generateKeyPair();

        // Build and send transaction
        const actions = buildCreateSubAccountActions(keyPair.publicKey, deposit);
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: fullAccountId,
          actions,
        });

        // Store encrypted private key
        try {
          const encrypted = await encrypt(keyPair.secretKey);
          storeEncryptedKey({
            subAccountId: fullAccountId,
            publicKey: keyPair.publicKey,
            encryptedPrivateKey: encrypted.ciphertext,
            nonce: encrypted.nonce,
            permission: 'owner',
          });
        } catch {
          // Encryption not available — key was already shown/used
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[useProjectAccount] Could not encrypt owner key for storage'
            );
          }
        }

        // Build sub-account record
        const subAccountRecord: ProjectSubAccount = {
          accountId: fullAccountId,
          parentAccountId: accountId,
          isCreated: true,
          initialDeposit: deposit,
          createdAt: new Date().toISOString(),
        };

        // Update store
        setSubAccount(input.projectId, subAccountRecord);

        // Add owner as first team member
        addTeamMemberToStore(fullAccountId, {
          accountId,
          permission: 'owner',
          publicKey: keyPair.publicKey,
          addedAt: new Date().toISOString(),
          keyStatus: 'active',
        });

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useProjectAccount] Created sub-account:',
            fullAccountId
          );
        }

        return subAccountRecord;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to create sub-account');
        setError(error);
        throw error;
      }
    },
    [
      isConnected,
      accountId,
      encrypt,
      setStatus,
      setError,
      setSubAccount,
      addTeamMemberToStore,
    ]
  );

  /**
   * Add a team member with a scoped access key.
   *
   * Flow:
   * 1. Generate a key pair for the member
   * 2. Build AddKey action with permission-appropriate scope
   * 3. Sign and send via wallet (owner signs)
   * 4. Return private key for the owner to share ONCE
   */
  const addTeamMember = useCallback(
    async (input: AddTeamMemberInput): Promise<AddTeamMemberResult> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      if (!isValidAccountId(input.memberAccountId)) {
        throw new Error(`Invalid NEAR account ID: ${input.memberAccountId}`);
      }

      // Viewers don't get keys
      if (input.permission === 'viewer') {
        const member: ProjectTeamMember = {
          accountId: input.memberAccountId,
          permission: 'viewer',
          addedAt: new Date().toISOString(),
          keyStatus: 'active',
        };

        addTeamMemberToStore(input.subAccountId, member);

        return {
          member,
          publicKey: '',
          privateKey: '',
        };
      }

      try {
        setStatus('adding-member');

        // Generate key pair for the member
        const keyPair = generateKeyPair();

        // Build and send AddKey transaction
        const action = buildAddKeyAction(keyPair.publicKey, input.permission);
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: input.subAccountId,
          actions: [action],
        });

        // Build member record
        const member: ProjectTeamMember = {
          accountId: input.memberAccountId,
          permission: input.permission,
          publicKey: keyPair.publicKey,
          addedAt: new Date().toISOString(),
          keyStatus: 'active',
        };

        // Update store
        addTeamMemberToStore(input.subAccountId, member);

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useProjectAccount] Added team member:',
            input.memberAccountId,
            'as',
            input.permission
          );
        }

        // Return private key — shown to owner ONCE
        return {
          member,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.secretKey,
        };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to add team member');
        setError(error);
        throw error;
      }
    },
    [isConnected, accountId, setStatus, setError, addTeamMemberToStore]
  );

  /**
   * Revoke a team member's access by deleting their key.
   */
  const revokeTeamMember = useCallback(
    async (targetSubAccountId: string, publicKey: string): Promise<void> => {
      if (!isConnected) {
        throw new WalletNotConnectedError();
      }

      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      try {
        setStatus('revoking-member');

        const action = buildDeleteKeyAction(publicKey);
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: targetSubAccountId,
          actions: [action],
        });

        // Find and update the member whose key was revoked
        const members = useProjectAccountsStore.getState().teamMembers[targetSubAccountId] ?? [];
        const member = members.find((m) => m.publicKey === publicKey);

        if (member) {
          updateTeamMember(targetSubAccountId, member.accountId, {
            keyStatus: 'revoked',
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useProjectAccount] Revoked key:',
            publicKey,
            'on',
            targetSubAccountId
          );
        }

        setStatus('idle');
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to revoke team member');
        setError(error);
        throw error;
      }
    },
    [isConnected, setStatus, setError, updateTeamMember]
  );

  /**
   * Refresh access keys from on-chain state and reconcile with team members.
   */
  const refreshAccessKeys = useCallback(
    async (targetSubAccountId: string): Promise<void> => {
      // Abort any in-flight refresh
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setStatus('loading');

        const keyList = await getAccessKeyList(targetSubAccountId);
        if (controller.signal.aborted) return;

        setAccessKeys(targetSubAccountId, keyList.keys);

        // Reconcile: infer team members from on-chain keys
        const members: ProjectTeamMember[] = keyList.keys.map((key) => ({
          accountId: '', // Unknown from key alone
          permission: inferPermissionFromAccessKey(key),
          publicKey: key.public_key,
          addedAt: '',
          keyStatus: 'active' as const,
        }));

        // Merge with existing store data (preserve known account IDs)
        const existing =
          useProjectAccountsStore.getState().teamMembers[targetSubAccountId] ?? [];

        const merged = members.map((m) => {
          const known = existing.find((e) => e.publicKey === m.publicKey);
          return known ? { ...known, keyStatus: 'active' as const } : m;
        });

        if (controller.signal.aborted) return;

        setTeamMembers(targetSubAccountId, merged);
        setStatus('idle');
      } catch (err) {
        if (controller.signal.aborted) return;
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to refresh access keys');
        setError(error);
      }
    },
    [setStatus, setError, setAccessKeys, setTeamMembers]
  );

  return {
    // State
    status,
    subAccount,
    teamMembers,
    accessKeys,
    error,
    isCreating: status === 'creating',
    isLoading: status === 'loading',

    // Actions
    createSubAccount,
    checkSubAccountExists: checkSubAccountExistsFn,
    addTeamMember,
    revokeTeamMember,
    refreshAccessKeys,
    validateSubAccountName,
  };
}
