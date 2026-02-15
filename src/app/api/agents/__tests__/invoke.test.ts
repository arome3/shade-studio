import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { AgentInstance, AgentCapability, AgentStatus } from '@/types/agents';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();
const mockHealthCheck = vi.fn();

vi.mock('@/lib/agents/executor', () => ({
  getAgentExecutor: () => ({
    execute: mockExecute,
    healthCheck: mockHealthCheck,
  }),
  AgentExecutionError: class AgentExecutionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AgentExecutionError';
    }
  },
}));

vi.mock('@/lib/agents/registry-client', () => ({
  getAgentInstance: vi.fn(),
}));

// Rate limiter needs to be importable so we can clear state between tests
vi.mock('../invoke/rate-limiter', async () => {
  const actual = await vi.importActual<typeof import('../invoke/rate-limiter')>('../invoke/rate-limiter');
  return actual;
});

import { POST, GET } from '../invoke/route';
import { getAgentInstance } from '@/lib/agents/registry-client';
import { AgentExecutionError } from '@/lib/agents/executor';
import { clearRateLimits } from '../invoke/rate-limiter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_INSTANCE: AgentInstance = {
  accountId: 'my-agent.alice.testnet',
  ownerAccountId: 'alice.testnet',
  templateId: 'tmpl-analysis-v1',
  codehash: 'abc123',
  name: 'My Agent',
  status: 'active' as AgentStatus,
  deployedAt: new Date().toISOString(),
  invocationCount: 5,
  capabilities: ['ai-analysis'] as AgentCapability[],
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agents/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/api/agents/invoke', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS;

  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimits();
    process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS = 'true';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Feature gate
  // -----------------------------------------------------------------------

  describe('feature gate', () => {
    it('should return 403 when shade agents is disabled', async () => {
      process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS = 'false';

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain('disabled');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validation', () => {
    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/agents/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 when agentAccountId is missing', async () => {
      const request = makeRequest({
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 when type is missing', async () => {
      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when payload is missing', async () => {
      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Agent resolution
  // -----------------------------------------------------------------------

  describe('agent resolution', () => {
    it('should return 404 when agent is not found', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(null);

      const request = makeRequest({
        agentAccountId: 'nonexistent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should return 404 when agent is deactivated', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue({
        ...MOCK_INSTANCE,
        status: 'deactivated',
      });

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain('deactivated');
    });
  });

  // -----------------------------------------------------------------------
  // Successful invocation
  // -----------------------------------------------------------------------

  describe('successful invocation', () => {
    it('should execute agent and return result', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockResolvedValue({
        data: { analysis: 'looks good' },
        executionTimeMs: 150,
        executor: 'near-ai',
      });

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: { document: 'grant proposal' },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toEqual({ analysis: 'looks good' });
      expect(data.executionTimeMs).toBe(150);
      expect(data.executor).toBe('near-ai');
      expect(data.invocationId).toBeDefined();
      expect(data.attestation).toBeNull();
    });

    it('should use provided invocationId', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockResolvedValue({
        data: {},
        executionTimeMs: 50,
        executor: 'near-ai',
      });

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
        invocationId: 'custom-inv-123',
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.invocationId).toBe('custom-inv-123');
    });

    it('should include attestation header when present', async () => {
      const attestation = {
        codehash: 'abc123',
        teeType: 'intel-tdx',
        attestationDocument: 'doc',
        signature: 'sig',
        timestamp: new Date().toISOString(),
        verified: false,
      };

      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockResolvedValue({
        data: {},
        attestation,
        executionTimeMs: 100,
        executor: 'near-ai',
      });

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-TEE-Attestation')).toBeTruthy();

      const data = await response.json();
      expect(data.attestation).toEqual(attestation);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('should return 422 for AgentExecutionError', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockRejectedValue(
        new AgentExecutionError('Capability violation: requires ai-chat')
      );

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toContain('Capability violation');
    });

    it('should return 504 for timeout (AbortError)', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockExecute.mockRejectedValue(abortError);

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(504);

      const data = await response.json();
      expect(data.error).toContain('timed out');
    });

    it('should return 500 for unexpected errors', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockRejectedValue(new Error('Something went wrong'));

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  describe('rate limiting', () => {
    it('should include X-RateLimit-Remaining header on success', async () => {
      vi.mocked(getAgentInstance).mockResolvedValue(MOCK_INSTANCE);
      mockExecute.mockResolvedValue({
        data: {},
        executionTimeMs: 50,
        executor: 'near-ai',
      });

      const request = makeRequest({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
      });

      const response = await POST(request);
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // GET handler
  // -----------------------------------------------------------------------

  describe('GET /api/agents/invoke', () => {
    it('should return API status when enabled', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('available');
      expect(data.rateLimit).toBeDefined();
      expect(data.supportedTypes).toBeInstanceOf(Array);
      expect(data.executor).toBe('near-ai');
    });

    it('should return disabled status when feature is off', async () => {
      process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS = 'false';

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });
  });
});
