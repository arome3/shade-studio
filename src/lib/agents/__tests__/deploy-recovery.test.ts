import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentCapability } from '@/types/agents';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../registry-client', () => ({
  registerAgentInstance: vi.fn(),
}));

vi.mock('../agent-keys', () => ({
  storeAgentKey: vi.fn(),
}));

import {
  saveOrphanedDeployment,
  removeOrphanedDeployment,
  getOrphanedDeployments,
  recoverOrphanedDeployment,
  cleanupOrphanedDeployment,
  type OrphanedDeployment,
} from '../deploy-recovery';
import { registerAgentInstance } from '../registry-client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOrphan(overrides: Partial<OrphanedDeployment> = {}): OrphanedDeployment {
  return {
    agentAccountId: 'my-agent.alice.testnet',
    ownerAccountId: 'alice.testnet',
    templateId: 'tmpl-analysis-v1',
    templateCodehash: 'abc123',
    agentName: 'My Agent',
    capabilities: ['ai-analysis'] as AgentCapability[],
    failedStep: 'registration',
    createdAt: new Date().toISOString(),
    ownerPublicKey: 'ed25519:MOCK_PUB_KEY',
    ...overrides,
  };
}

function createMockWalletSelector() {
  return {
    wallet: vi.fn().mockResolvedValue({
      signAndSendTransaction: vi.fn().mockResolvedValue({}),
    }),
  } as unknown as Parameters<typeof recoverOrphanedDeployment>[1];
}

function createMockEncrypt() {
  return vi.fn().mockResolvedValue({
    encrypted: 'ENCRYPTED_DATA',
    nonce: 'NONCE',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deploy-recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // -----------------------------------------------------------------------
  // Save & retrieve
  // -----------------------------------------------------------------------

  describe('save and retrieve', () => {
    it('should save an orphaned deployment to localStorage', () => {
      const orphan = makeOrphan();
      saveOrphanedDeployment(orphan);

      const stored = localStorage.getItem('shade-studio:orphaned-deploys:my-agent.alice.testnet');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.agentAccountId).toBe('my-agent.alice.testnet');
      expect(parsed.failedStep).toBe('registration');
    });

    it('should retrieve orphaned deployments for a specific owner', () => {
      saveOrphanedDeployment(makeOrphan());
      saveOrphanedDeployment(
        makeOrphan({
          agentAccountId: 'other-agent.alice.testnet',
          agentName: 'Other Agent',
        })
      );
      saveOrphanedDeployment(
        makeOrphan({
          agentAccountId: 'bob-agent.bob.testnet',
          ownerAccountId: 'bob.testnet',
        })
      );

      const aliceOrphans = getOrphanedDeployments('alice.testnet');
      expect(aliceOrphans).toHaveLength(2);
      expect(aliceOrphans.map((o) => o.agentAccountId)).toContain('my-agent.alice.testnet');
      expect(aliceOrphans.map((o) => o.agentAccountId)).toContain('other-agent.alice.testnet');

      const bobOrphans = getOrphanedDeployments('bob.testnet');
      expect(bobOrphans).toHaveLength(1);
    });

    it('should return empty array when no orphans exist', () => {
      const orphans = getOrphanedDeployments('alice.testnet');
      expect(orphans).toEqual([]);
    });

    it('should skip malformed localStorage entries', () => {
      localStorage.setItem('shade-studio:orphaned-deploys:bad', '{invalid json!!!');
      const orphans = getOrphanedDeployments('alice.testnet');
      expect(orphans).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Remove
  // -----------------------------------------------------------------------

  describe('remove', () => {
    it('should remove an orphaned deployment record', () => {
      saveOrphanedDeployment(makeOrphan());
      expect(getOrphanedDeployments('alice.testnet')).toHaveLength(1);

      removeOrphanedDeployment('my-agent.alice.testnet');
      expect(getOrphanedDeployments('alice.testnet')).toHaveLength(0);
    });

    it('should be safe to call with non-existent key', () => {
      expect(() => removeOrphanedDeployment('nonexistent.testnet')).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Recovery
  // -----------------------------------------------------------------------

  describe('recoverOrphanedDeployment', () => {
    it('should retry registration and return instance on success', async () => {
      vi.mocked(registerAgentInstance).mockResolvedValue(undefined);
      saveOrphanedDeployment(makeOrphan());

      const instance = await recoverOrphanedDeployment(
        makeOrphan(),
        createMockWalletSelector(),
        createMockEncrypt()
      );

      expect(registerAgentInstance).toHaveBeenCalledTimes(1);
      expect(instance.accountId).toBe('my-agent.alice.testnet');
      expect(instance.ownerAccountId).toBe('alice.testnet');
      expect(instance.status).toBe('active');
      expect(instance.invocationCount).toBe(0);

      // Orphan record should be removed
      expect(getOrphanedDeployments('alice.testnet')).toHaveLength(0);
    });

    it('should skip registration for key-storage failures', async () => {
      const orphan = makeOrphan({ failedStep: 'key-storage' });
      saveOrphanedDeployment(orphan);

      const instance = await recoverOrphanedDeployment(
        orphan,
        createMockWalletSelector(),
        createMockEncrypt()
      );

      // Registration should NOT be called for key-storage failures
      expect(registerAgentInstance).not.toHaveBeenCalled();
      expect(instance.accountId).toBe('my-agent.alice.testnet');
    });

    it('should propagate registration errors', async () => {
      vi.mocked(registerAgentInstance).mockRejectedValue(
        new Error('Registry contract call failed')
      );

      await expect(
        recoverOrphanedDeployment(
          makeOrphan(),
          createMockWalletSelector(),
          createMockEncrypt()
        )
      ).rejects.toThrow('Registry contract call failed');
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  describe('cleanupOrphanedDeployment', () => {
    it('should delete sub-account and remove orphan record', async () => {
      saveOrphanedDeployment(makeOrphan());
      const walletSelector = createMockWalletSelector();

      await cleanupOrphanedDeployment(
        'my-agent.alice.testnet',
        'alice.testnet',
        walletSelector
      );

      // Should have called wallet to delete the account
      const wallet = await walletSelector.wallet();
      expect(wallet.signAndSendTransaction).toHaveBeenCalledWith({
        receiverId: 'my-agent.alice.testnet',
        actions: [
          {
            type: 'DeleteAccount',
            params: { beneficiaryId: 'alice.testnet' },
          },
        ],
      });

      // Orphan record should be removed
      expect(getOrphanedDeployments('alice.testnet')).toHaveLength(0);
    });

    it('should propagate wallet errors', async () => {
      const walletSelector = {
        wallet: vi.fn().mockResolvedValue({
          signAndSendTransaction: vi.fn().mockRejectedValue(
            new Error('User rejected')
          ),
        }),
      } as unknown as Parameters<typeof cleanupOrphanedDeployment>[2];

      await expect(
        cleanupOrphanedDeployment(
          'my-agent.alice.testnet',
          'alice.testnet',
          walletSelector
        )
      ).rejects.toThrow('User rejected');
    });
  });
});
