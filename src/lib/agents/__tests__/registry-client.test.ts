import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTemplate,
  listTemplates,
  getMyAgents,
  verifyAgent,
  getRegistryStats,
  clearRegistryCache,
  AgentRegistryError,
  AgentNotFoundError,
  TemplateNotFoundError,
  CodehashMismatchError,
} from '../registry-client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/config', () => ({
  config: {
    agents: { registryContractId: 'agent-registry.testnet' },
  },
}));

vi.mock('@/lib/near/config', () => ({
  getNetworkConfig: () => ({
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_TEMPLATE = {
  id: 'tmpl-analysis-v1',
  name: 'Analysis Agent',
  description: 'Analyzes grant proposals',
  version: '1.0.0',
  codehash: 'abc123',
  source_url: 'https://github.com/shade/analysis-agent',
  audit_url: null,
  creator: 'alice.testnet',
  capabilities: ['ai-analysis', 'read-documents'],
  required_permissions: [
    {
      receiver_id: 'social.testnet',
      method_names: ['get'],
      allowance: '250000000000000000000000',
      purpose: 'Read social data',
    },
  ],
  created_at: 1700000000000000000, // nanoseconds
  deployments: 5,
  is_audited: false,
};

const RAW_INSTANCE = {
  account_id: 'my-agent.alice.testnet',
  owner_account_id: 'alice.testnet',
  template_id: 'tmpl-analysis-v1',
  codehash: 'abc123',
  name: 'My Analysis Agent',
  status: 'active',
  last_active_at: 1700000000000000000,
  deployed_at: 1700000000000000000,
  last_attestation: null,
  invocation_count: 42,
  capabilities: ['ai-analysis'],
};

// ---------------------------------------------------------------------------
// Helper: build a successful JSON-RPC response
// ---------------------------------------------------------------------------

function rpcSuccess(result: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(result));
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'view',
      result: { result: Array.from(encoded) },
    }),
  };
}

function rpcError(message: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'view',
      error: { message },
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Registry Client', () => {
  beforeEach(() => {
    clearRegistryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTemplate', () => {
    it('should return a parsed template on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess(RAW_TEMPLATE) as unknown as Response
      );

      const template = await getTemplate('tmpl-analysis-v1');

      expect(template).not.toBeNull();
      expect(template!.id).toBe('tmpl-analysis-v1');
      expect(template!.name).toBe('Analysis Agent');
      expect(template!.sourceUrl).toBe('https://github.com/shade/analysis-agent');
      expect(template!.capabilities).toEqual(['ai-analysis', 'read-documents']);
      expect(template!.requiredPermissions[0]?.receiverId).toBe('social.testnet');
      // Verify nanosecond→ISO conversion
      expect(template!.createdAt).toBeTruthy();
      expect(new Date(template!.createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should return null when template is not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess(null) as unknown as Response
      );

      const template = await getTemplate('nonexistent');
      expect(template).toBeNull();
    });

    it('should throw AgentRegistryError on RPC error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcError('Method not found') as unknown as Response
      );

      await expect(getTemplate('tmpl-1')).rejects.toThrow(AgentRegistryError);
    });

    it('should use cache on second call', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        rpcSuccess(RAW_TEMPLATE) as unknown as Response
      );

      // First call — hits RPC
      await getTemplate('tmpl-analysis-v1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      const cached = await getTemplate('tmpl-analysis-v1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(cached!.id).toBe('tmpl-analysis-v1');
    });
  });

  describe('listTemplates', () => {
    it('should return an array of parsed templates', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess([RAW_TEMPLATE]) as unknown as Response
      );

      const templates = await listTemplates(0, 50);
      expect(templates).toHaveLength(1);
      expect(templates[0]!.id).toBe('tmpl-analysis-v1');
      expect(templates[0]!.requiredPermissions).toHaveLength(1);
    });

    it('should pass pagination parameters', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess([]) as unknown as Response
      );

      await listTemplates(10, 20);

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
      const args = JSON.parse(atob(body.params.args_base64));
      expect(args.from_index).toBe(10);
      expect(args.limit).toBe(20);
    });
  });

  describe('getMyAgents', () => {
    it('should return empty array when user has no agents', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess([]) as unknown as Response
      );

      const agents = await getMyAgents('bob.testnet');
      expect(agents).toEqual([]);
    });

    it('should return parsed instances', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess([RAW_INSTANCE]) as unknown as Response
      );

      const agents = await getMyAgents('alice.testnet');
      expect(agents).toHaveLength(1);
      expect(agents[0]!.accountId).toBe('my-agent.alice.testnet');
      expect(agents[0]!.ownerAccountId).toBe('alice.testnet');
      expect(agents[0]!.invocationCount).toBe(42);
      expect(agents[0]!.capabilities).toEqual(['ai-analysis']);
    });
  });

  describe('verifyAgent', () => {
    it('should return verification result (verified)', async () => {
      const result = { valid: true, codehash: 'abc123', isAudited: false };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess(result) as unknown as Response
      );

      const verification = await verifyAgent('my-agent.alice.testnet');
      expect(verification.valid).toBe(true);
    });

    it('should return verification result (unverified)', async () => {
      const result = { valid: false, reason: 'Codehash mismatch', isAudited: false };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess(result) as unknown as Response
      );

      const verification = await verifyAgent('my-agent.alice.testnet');
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('mismatch');
    });
  });

  describe('getRegistryStats', () => {
    it('should map snake_case to camelCase', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        rpcSuccess({
          total_templates: 10,
          total_deployments: 42,
          verified_codehashes: 8,
        }) as unknown as Response
      );

      const stats = await getRegistryStats();
      expect(stats.totalTemplates).toBe(10);
      expect(stats.totalDeployments).toBe(42);
      expect(stats.verifiedCodehashes).toBe(8);
    });
  });

  describe('Error types', () => {
    it('AgentNotFoundError should extend AgentRegistryError', () => {
      const err = new AgentNotFoundError('agent.testnet');
      expect(err).toBeInstanceOf(AgentRegistryError);
      expect(err.name).toBe('AgentNotFoundError');
      expect(err.message).toContain('agent.testnet');
    });

    it('TemplateNotFoundError should extend AgentRegistryError', () => {
      const err = new TemplateNotFoundError('tmpl-1');
      expect(err).toBeInstanceOf(AgentRegistryError);
      expect(err.name).toBe('TemplateNotFoundError');
    });

    it('CodehashMismatchError should store expected and actual', () => {
      const err = new CodehashMismatchError('abc', 'def');
      expect(err).toBeInstanceOf(AgentRegistryError);
      expect(err.expected).toBe('abc');
      expect(err.actual).toBe('def');
    });
  });
});
