import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentCapability } from '@/types/agents';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockChat = vi.fn();

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chat: mockChat,
    isEnabled: () => true,
  }),
}));

vi.mock('../capabilities', () => ({
  CAPABILITY_CONFIGS: {
    'ai-chat': { label: 'AI Chat', description: 'General AI chat', riskLevel: 'low' },
    'ai-analysis': { label: 'AI Analysis', description: 'Document analysis', riskLevel: 'low' },
    'read-documents': { label: 'Read Documents', description: 'Read documents', riskLevel: 'low' },
    'blockchain-read': { label: 'Blockchain Read', description: 'Read chain state', riskLevel: 'low' },
    'blockchain-write': { label: 'Blockchain Write', description: 'Submit transactions', riskLevel: 'high' },
  },
}));

vi.mock('../capability-enforcer', async () => {
  const actual = await vi.importActual<typeof import('../capability-enforcer')>('../capability-enforcer');
  return actual;
});

import {
  NearAIExecutor,
  AgentExecutionError,
  getAgentExecutor,
  setAgentExecutor,
  type ExecutionRequest,
} from '../executor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    agentAccountId: 'my-agent.alice.testnet',
    templateId: 'tmpl-analysis-v1',
    templateName: 'Analysis Agent',
    type: 'analyze',
    payload: { document: 'test doc' },
    capabilities: ['ai-analysis'] as AgentCapability[],
    codehash: 'abc123def',
    invocationId: 'inv-test-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NearAIExecutor', () => {
  let executor: NearAIExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new NearAIExecutor();
  });

  // -----------------------------------------------------------------------
  // Successful execution
  // -----------------------------------------------------------------------

  describe('successful execution', () => {
    it('should call AI client and return structured result', async () => {
      mockChat.mockResolvedValue({
        content: '{"result": "analysis complete"}',
        attestation: null,
      });

      const result = await executor.execute(makeRequest());

      expect(result.data).toEqual({ result: 'analysis complete' });
      expect(result.executor).toBe('near-ai');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.attestation).toBeUndefined();
    });

    it('should strip markdown code blocks from JSON response', async () => {
      mockChat.mockResolvedValue({
        content: '```json\n{"stripped": true}\n```',
        attestation: null,
      });

      const result = await executor.execute(makeRequest());
      expect(result.data).toEqual({ stripped: true });
    });

    it('should fallback to raw content when response is not JSON', async () => {
      mockChat.mockResolvedValue({
        content: 'This is a plain text response.',
        attestation: null,
      });

      const result = await executor.execute(makeRequest());
      expect(result.data).toEqual({ content: 'This is a plain text response.' });
    });

    it('should map attestation to CodehashAttestation when present', async () => {
      mockChat.mockResolvedValue({
        content: '{"ok": true}',
        attestation: {
          version: '1.0',
          tee_type: 'intel-tdx',
          enclave_id: 'enc-001',
          code_hash: 'abc123def',
          timestamp: '2026-01-15T12:00:00Z',
          quote: 'doc-base64',
          signature: 'sig-base64',
        },
      });

      const result = await executor.execute(makeRequest());

      expect(result.attestation).toBeDefined();
      expect(result.attestation!.codehash).toBe('abc123def');
      expect(result.attestation!.teeType).toBe('intel-tdx');
      expect(result.attestation!.attestationDocument).toBe('doc-base64');
      expect(result.attestation!.signature).toBe('sig-base64');
      expect(result.attestation!.verified).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Capability enforcement
  // -----------------------------------------------------------------------

  describe('capability enforcement', () => {
    it('should reject when agent lacks required capability for type', async () => {
      // Agent only has ai-analysis, but 'chat' requires ai-chat
      const request = makeRequest({
        type: 'chat',
        capabilities: ['ai-analysis'] as AgentCapability[],
      });

      await expect(executor.execute(request)).rejects.toThrow(AgentExecutionError);
      await expect(executor.execute(request)).rejects.toThrow('Capability violation');

      // Should not have called AI client
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should reject when payload signals require missing capability', async () => {
      const request = makeRequest({
        type: 'analyze',
        capabilities: ['ai-analysis'] as AgentCapability[],
        payload: { writeToChain: true },
      });

      await expect(executor.execute(request)).rejects.toThrow(AgentExecutionError);
    });

    it('should allow when agent has all required capabilities', async () => {
      mockChat.mockResolvedValue({
        content: '{"result": "ok"}',
        attestation: null,
      });

      const request = makeRequest({
        type: 'summarize',
        capabilities: ['ai-chat', 'read-documents'] as AgentCapability[],
      });

      const result = await executor.execute(request);
      expect(result.data).toEqual({ result: 'ok' });
      expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('should allow unknown type if agent has ai-chat', async () => {
      mockChat.mockResolvedValue({
        content: '{"result": "custom"}',
        attestation: null,
      });

      const request = makeRequest({
        type: 'custom-type',
        capabilities: ['ai-chat'] as AgentCapability[],
      });

      const result = await executor.execute(request);
      expect(result.data).toEqual({ result: 'custom' });
    });
  });

  // -----------------------------------------------------------------------
  // System prompt construction
  // -----------------------------------------------------------------------

  describe('system prompt', () => {
    it('should include agent identity and capabilities in system message', async () => {
      mockChat.mockResolvedValue({ content: '{}', attestation: null });

      await executor.execute(makeRequest());

      const [messages] = mockChat.mock.calls[0]!;
      const systemMsg = messages[0];
      expect(systemMsg.role).toBe('system');
      expect(systemMsg.content).toContain('Analysis Agent');
      expect(systemMsg.content).toContain('my-agent.alice.testnet');
      expect(systemMsg.content).toContain('abc123def');
      expect(systemMsg.content).toContain('AI Analysis');
    });

    it('should include invocation payload in user message', async () => {
      mockChat.mockResolvedValue({ content: '{}', attestation: null });

      await executor.execute(makeRequest({ payload: { query: 'test' } }));

      const [messages] = mockChat.mock.calls[0]!;
      const userMsg = messages[1];
      expect(userMsg.role).toBe('user');
      const parsed = JSON.parse(userMsg.content);
      expect(parsed.payload).toEqual({ query: 'test' });
      expect(parsed.type).toBe('analyze');
    });
  });

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  describe('healthCheck', () => {
    it('should return true when AI client is enabled', async () => {
      const healthy = await executor.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    afterEach(() => {
      // Reset singleton
      setAgentExecutor(new NearAIExecutor());
    });

    it('should return the same executor instance', () => {
      const a = getAgentExecutor();
      const b = getAgentExecutor();
      expect(a).toBe(b);
    });

    it('should allow setting a custom executor', () => {
      const custom = { execute: vi.fn(), healthCheck: vi.fn() };
      setAgentExecutor(custom);
      expect(getAgentExecutor()).toBe(custom);
    });
  });
});
