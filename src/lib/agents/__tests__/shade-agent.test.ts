import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentCapability } from '@/types/agents';
import {
  deployAgent,
  invokeAgent,
  deactivateAgent,
  AgentDeployError,
  AgentInvokeError,
} from '../shade-agent';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/near/project-accounts', () => ({
  validateSubAccountName: vi.fn(),
  checkAccountExists: vi.fn(),
  nearToYocto: (near: string) => `${parseFloat(near) * 1e24}`,
}));

vi.mock('@/lib/near/access-keys', () => ({
  generateKeyPair: vi.fn(() => ({
    publicKey: 'ed25519:MOCK_PUB_KEY',
    secretKey: 'ed25519:MOCK_SECRET_KEY',
  })),
}));

vi.mock('../registry-client', () => ({
  getTemplate: vi.fn(),
  registerAgentInstance: vi.fn(),
  deactivateAgentOnChain: vi.fn(),
  getAgentInstance: vi.fn(),
}));

vi.mock('../verification', () => ({
  verifyCodehash: vi.fn(),
  verifyAttestation: vi.fn(),
}));

vi.mock('../agent-keys', () => ({
  storeAgentKey: vi.fn(),
  removeAgentKey: vi.fn(),
  clearAllAgentKeys: vi.fn(),
}));

vi.mock('../capabilities', () => ({
  aggregatePermissions: vi.fn(() => [
    {
      receiverId: 'social.testnet',
      methodNames: ['get'],
      allowance: '250000000000000000000000',
    },
  ]),
}));

// Import mocked modules
import { validateSubAccountName, checkAccountExists } from '@/lib/near/project-accounts';
import { getTemplate, registerAgentInstance, deactivateAgentOnChain } from '../registry-client';
import { verifyCodehash } from '../verification';
import { storeAgentKey, removeAgentKey } from '../agent-keys';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_TEMPLATE = {
  id: 'tmpl-analysis-v1',
  name: 'Analysis Agent',
  description: 'Analyzes grants',
  version: '1.0.0',
  codehash: 'abc123',
  sourceUrl: 'https://example.com',
  creator: 'alice.testnet',
  capabilities: ['ai-analysis'] as AgentCapability[],
  requiredPermissions: [],
  createdAt: new Date().toISOString(),
  deployments: 5,
  isAudited: false,
};

function createMockWalletSelector() {
  return {
    wallet: vi.fn().mockResolvedValue({
      signAndSendTransaction: vi.fn().mockResolvedValue({}),
    }),
  } as unknown as Parameters<typeof deployAgent>[0]['walletSelector'];
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

describe('shade-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deployAgent', () => {
    it('should deploy an agent through the full 9-step flow', async () => {
      // Setup mocks for the happy path
      vi.mocked(validateSubAccountName).mockReturnValue({
        valid: true,
        fullAccountId: 'my-agent.alice.testnet',
      });
      vi.mocked(getTemplate).mockResolvedValue(MOCK_TEMPLATE);
      vi.mocked(checkAccountExists).mockResolvedValue(null);
      vi.mocked(registerAgentInstance).mockResolvedValue(undefined);

      const walletSelector = createMockWalletSelector();
      const encrypt = createMockEncrypt();

      const instance = await deployAgent({
        templateId: 'tmpl-analysis-v1',
        name: 'My Agent',
        slug: 'my-agent',
        ownerAccountId: 'alice.testnet',
        walletSelector,
        encrypt,
      });

      // Verify result
      expect(instance.accountId).toBe('my-agent.alice.testnet');
      expect(instance.ownerAccountId).toBe('alice.testnet');
      expect(instance.templateId).toBe('tmpl-analysis-v1');
      expect(instance.codehash).toBe('abc123');
      expect(instance.status).toBe('active');
      expect(instance.invocationCount).toBe(0);

      // Verify flow: slug validated, template fetched, account checked
      expect(validateSubAccountName).toHaveBeenCalledWith('my-agent', 'alice.testnet');
      expect(getTemplate).toHaveBeenCalledWith('tmpl-analysis-v1');
      expect(checkAccountExists).toHaveBeenCalledWith('my-agent.alice.testnet');

      // Verify wallet interaction
      const wallet = await walletSelector.wallet();
      expect(wallet.signAndSendTransaction).toHaveBeenCalledTimes(1);

      // Verify on-chain registration
      expect(registerAgentInstance).toHaveBeenCalledTimes(1);

      // Verify encrypted keys stored (owner + execution)
      expect(storeAgentKey).toHaveBeenCalledTimes(2);
      expect(encrypt).toHaveBeenCalledTimes(2);
    });

    it('should throw AgentDeployError when slug is invalid', async () => {
      vi.mocked(validateSubAccountName).mockReturnValue({
        valid: false,
        error: 'Slug must be lowercase',
      });

      await expect(
        deployAgent({
          templateId: 'tmpl-1',
          name: 'Agent',
          slug: 'INVALID',
          ownerAccountId: 'alice.testnet',
          walletSelector: createMockWalletSelector(),
          encrypt: createMockEncrypt(),
        })
      ).rejects.toThrow(AgentDeployError);
    });

    it('should throw AgentDeployError when template is not found', async () => {
      vi.mocked(validateSubAccountName).mockReturnValue({
        valid: true,
        fullAccountId: 'my-agent.alice.testnet',
      });
      vi.mocked(getTemplate).mockResolvedValue(null);

      await expect(
        deployAgent({
          templateId: 'nonexistent',
          name: 'Agent',
          slug: 'my-agent',
          ownerAccountId: 'alice.testnet',
          walletSelector: createMockWalletSelector(),
          encrypt: createMockEncrypt(),
        })
      ).rejects.toThrow('Template not found');
    });

    it('should throw AgentDeployError when account already exists', async () => {
      vi.mocked(validateSubAccountName).mockReturnValue({
        valid: true,
        fullAccountId: 'my-agent.alice.testnet',
      });
      vi.mocked(getTemplate).mockResolvedValue(MOCK_TEMPLATE);
      vi.mocked(checkAccountExists).mockResolvedValue({ amount: '0', locked: '0' } as never);

      await expect(
        deployAgent({
          templateId: 'tmpl-analysis-v1',
          name: 'Agent',
          slug: 'my-agent',
          ownerAccountId: 'alice.testnet',
          walletSelector: createMockWalletSelector(),
          encrypt: createMockEncrypt(),
        })
      ).rejects.toThrow('Account already exists');
    });
  });

  describe('invokeAgent', () => {
    it('should invoke an agent and return an invocation', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { result: 'analyzed' },
          attestation: null,
        }),
        text: async () => '',
      } as unknown as Response);

      const invocation = await invokeAgent('my-agent.alice.testnet', 'analyze', {
        documentId: 'doc-1',
      });

      expect(invocation.agentAccountId).toBe('my-agent.alice.testnet');
      expect(invocation.type).toBe('analyze');
      expect(invocation.status).toBe('completed');
      expect(invocation.response).toEqual({ result: 'analyzed' });
      expect(invocation.id).toMatch(/^inv-/);
    });

    it('should verify codehash before invocation when requested', async () => {
      vi.mocked(verifyCodehash).mockResolvedValue({
        valid: true,
        isAudited: false,
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {}, attestation: null }),
        text: async () => '',
      } as unknown as Response);

      await invokeAgent('my-agent.alice.testnet', 'analyze', {}, {
        verifyBeforeInvoke: true,
      });

      expect(verifyCodehash).toHaveBeenCalledWith('my-agent.alice.testnet');
    });

    it('should throw AgentInvokeError when codehash verification fails', async () => {
      vi.mocked(verifyCodehash).mockResolvedValue({
        valid: false,
        reason: 'Codehash mismatch',
        isAudited: false,
      });

      await expect(
        invokeAgent('my-agent.alice.testnet', 'analyze', {}, {
          verifyBeforeInvoke: true,
        })
      ).rejects.toThrow(AgentInvokeError);
    });

    it('should throw AgentInvokeError on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response);

      await expect(
        invokeAgent('my-agent.alice.testnet', 'analyze', {})
      ).rejects.toThrow('Agent invocation failed');
    });
  });

  describe('deactivateAgent', () => {
    it('should deactivate on-chain and remove execution key', async () => {
      vi.mocked(deactivateAgentOnChain).mockResolvedValue(undefined);

      const walletSelector = createMockWalletSelector();
      await deactivateAgent('my-agent.alice.testnet', walletSelector);

      expect(deactivateAgentOnChain).toHaveBeenCalledWith(
        'my-agent.alice.testnet',
        walletSelector
      );
      expect(removeAgentKey).toHaveBeenCalledWith('my-agent.alice.testnet', 'execution');
    });

    it('should propagate errors from on-chain deactivation', async () => {
      vi.mocked(deactivateAgentOnChain).mockRejectedValue(
        new Error('Unauthorized')
      );

      const walletSelector = createMockWalletSelector();

      await expect(
        deactivateAgent('my-agent.alice.testnet', walletSelector)
      ).rejects.toThrow('Unauthorized');
    });
  });
});
