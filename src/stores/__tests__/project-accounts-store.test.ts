import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectAccountsStore } from '../project-accounts-store';
import type {
  ProjectSubAccount,
  ProjectTeamMember,
  AccessKeyInfo,
} from '@/types/project-accounts';

// Mock config (needed by PERMISSION_CONFIGS import chain)
vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      socialContractId: 'v1.social08.testnet',
    },
  },
}));

describe('project-accounts-store', () => {
  beforeEach(() => {
    useProjectAccountsStore.getState().reset();
    vi.clearAllMocks();
  });

  // ========================================================================
  // Initial State
  // ========================================================================

  describe('initial state', () => {
    it('should have idle status', () => {
      expect(useProjectAccountsStore.getState().status).toBe('idle');
    });

    it('should have empty subAccounts', () => {
      expect(useProjectAccountsStore.getState().subAccounts).toEqual({});
    });

    it('should have empty teamMembers', () => {
      expect(useProjectAccountsStore.getState().teamMembers).toEqual({});
    });

    it('should have empty accessKeys', () => {
      expect(useProjectAccountsStore.getState().accessKeys).toEqual({});
    });

    it('should have null error', () => {
      expect(useProjectAccountsStore.getState().error).toBeNull();
    });
  });

  // ========================================================================
  // Status
  // ========================================================================

  describe('status transitions', () => {
    it('should set status to creating', () => {
      useProjectAccountsStore.getState().setStatus('creating');
      expect(useProjectAccountsStore.getState().status).toBe('creating');
    });

    it('should set error and status', () => {
      const error = new Error('test error');
      useProjectAccountsStore.getState().setError(error);
      expect(useProjectAccountsStore.getState().status).toBe('error');
      expect(useProjectAccountsStore.getState().error).toBe(error);
    });

    it('should clear error without changing status', () => {
      useProjectAccountsStore.getState().setError(new Error('test'));
      useProjectAccountsStore.getState().clearError();
      expect(useProjectAccountsStore.getState().error).toBeNull();
    });
  });

  // ========================================================================
  // Sub-accounts
  // ========================================================================

  describe('sub-accounts', () => {
    const mockSubAccount: ProjectSubAccount = {
      accountId: 'project.alice.testnet',
      parentAccountId: 'alice.testnet',
      isCreated: true,
      initialDeposit: '0.1',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    it('should set a sub-account', () => {
      useProjectAccountsStore.getState().setSubAccount('proj-1', mockSubAccount);
      expect(
        useProjectAccountsStore.getState().subAccounts['proj-1']
      ).toEqual(mockSubAccount);
      expect(useProjectAccountsStore.getState().status).toBe('idle');
    });

    it('should remove a sub-account', () => {
      useProjectAccountsStore.getState().setSubAccount('proj-1', mockSubAccount);
      useProjectAccountsStore.getState().removeSubAccount('proj-1');
      expect(
        useProjectAccountsStore.getState().subAccounts['proj-1']
      ).toBeUndefined();
    });

    it('should not affect other sub-accounts when removing', () => {
      const other: ProjectSubAccount = {
        ...mockSubAccount,
        accountId: 'other.alice.testnet',
      };
      useProjectAccountsStore.getState().setSubAccount('proj-1', mockSubAccount);
      useProjectAccountsStore.getState().setSubAccount('proj-2', other);
      useProjectAccountsStore.getState().removeSubAccount('proj-1');
      expect(
        useProjectAccountsStore.getState().subAccounts['proj-2']
      ).toEqual(other);
    });
  });

  // ========================================================================
  // Team Members
  // ========================================================================

  describe('team members', () => {
    const subAccountId = 'project.alice.testnet';
    const mockMember: ProjectTeamMember = {
      accountId: 'bob.testnet',
      permission: 'editor',
      publicKey: 'ed25519:abc123',
      addedAt: '2025-01-01T00:00:00.000Z',
      keyStatus: 'active',
    };

    it('should set team members for a sub-account', () => {
      useProjectAccountsStore
        .getState()
        .setTeamMembers(subAccountId, [mockMember]);
      expect(
        useProjectAccountsStore.getState().teamMembers[subAccountId]
      ).toEqual([mockMember]);
    });

    it('should add a team member', () => {
      useProjectAccountsStore
        .getState()
        .addTeamMember(subAccountId, mockMember);
      const members =
        useProjectAccountsStore.getState().teamMembers[subAccountId];
      expect(members).toHaveLength(1);
      expect(members![0]).toEqual(mockMember);
    });

    it('should append when adding multiple members', () => {
      const second: ProjectTeamMember = {
        ...mockMember,
        accountId: 'carol.testnet',
        publicKey: 'ed25519:def456',
      };
      useProjectAccountsStore
        .getState()
        .addTeamMember(subAccountId, mockMember);
      useProjectAccountsStore
        .getState()
        .addTeamMember(subAccountId, second);
      expect(
        useProjectAccountsStore.getState().teamMembers[subAccountId]
      ).toHaveLength(2);
    });

    it('should update a team member', () => {
      useProjectAccountsStore
        .getState()
        .addTeamMember(subAccountId, mockMember);
      useProjectAccountsStore
        .getState()
        .updateTeamMember(subAccountId, 'bob.testnet', {
          keyStatus: 'revoked',
        });
      const members =
        useProjectAccountsStore.getState().teamMembers[subAccountId];
      expect(members![0]!.keyStatus).toBe('revoked');
    });

    it('should remove a team member', () => {
      useProjectAccountsStore
        .getState()
        .addTeamMember(subAccountId, mockMember);
      useProjectAccountsStore
        .getState()
        .removeTeamMember(subAccountId, 'bob.testnet');
      expect(
        useProjectAccountsStore.getState().teamMembers[subAccountId]
      ).toHaveLength(0);
    });
  });

  // ========================================================================
  // Access Keys
  // ========================================================================

  describe('access keys', () => {
    const subAccountId = 'project.alice.testnet';
    const mockKeys: AccessKeyInfo[] = [
      {
        public_key: 'ed25519:abc',
        access_key: { nonce: 0, permission: 'FullAccess' },
      },
      {
        public_key: 'ed25519:def',
        access_key: {
          nonce: 1,
          permission: {
            FunctionCall: {
              allowance: '1000000000000000000000000',
              receiver_id: 'v1.social08.testnet',
              method_names: ['set'],
            },
          },
        },
      },
    ];

    it('should set access keys', () => {
      useProjectAccountsStore.getState().setAccessKeys(subAccountId, mockKeys);
      expect(
        useProjectAccountsStore.getState().accessKeys[subAccountId]
      ).toEqual(mockKeys);
    });
  });

  // ========================================================================
  // Reset
  // ========================================================================

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useProjectAccountsStore.getState().setStatus('creating');
      useProjectAccountsStore.getState().setSubAccount('proj-1', {
        accountId: 'test.alice.testnet',
        parentAccountId: 'alice.testnet',
        isCreated: true,
        initialDeposit: '0.1',
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      useProjectAccountsStore.getState().reset();

      const state = useProjectAccountsStore.getState();
      expect(state.status).toBe('idle');
      expect(state.subAccounts).toEqual({});
      expect(state.teamMembers).toEqual({});
      expect(state.accessKeys).toEqual({});
      expect(state.error).toBeNull();
    });
  });
});
