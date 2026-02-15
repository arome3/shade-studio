import { describe, it, expect } from 'vitest';
import {
  DeployAgentSchema,
  AgentCapabilitySchema,
  InvokeAgentSchema,
  AgentPermissionSchema,
} from '@/types/agents';

describe('Agent Zod Schemas', () => {
  describe('DeployAgentSchema', () => {
    it('should accept valid deploy input', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-analysis-v1',
        name: 'My Analysis Agent',
        slug: 'my-agent',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty templateId', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: '',
        name: 'My Agent',
        slug: 'my-agent',
      });
      expect(result.success).toBe(false);
    });

    it('should reject slug with uppercase letters', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'My Agent',
        slug: 'MyAgent',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('lowercase');
      }
    });

    it('should reject slug with special characters', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'My Agent',
        slug: 'my_agent!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject slug that is too short', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'My Agent',
        slug: 'a',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('2 characters');
      }
    });

    it('should reject slug starting with hyphen', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'My Agent',
        slug: '-my-agent',
      });
      expect(result.success).toBe(false);
    });

    it('should reject slug ending with hyphen', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'My Agent',
        slug: 'my-agent-',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: '',
        slug: 'my-agent',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name that is too long', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'A'.repeat(51),
        slug: 'my-agent',
      });
      expect(result.success).toBe(false);
    });

    it('should accept slug with numbers', () => {
      const result = DeployAgentSchema.safeParse({
        templateId: 'tmpl-1',
        name: 'Agent 42',
        slug: 'agent-42',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AgentCapabilitySchema', () => {
    it('should accept known capabilities', () => {
      const capabilities = [
        'read-documents',
        'write-documents',
        'ai-chat',
        'ai-analysis',
        'blockchain-read',
        'blockchain-write',
        'ipfs-read',
        'ipfs-write',
        'social-read',
        'social-write',
      ];

      for (const cap of capabilities) {
        const result = AgentCapabilitySchema.safeParse(cap);
        expect(result.success).toBe(true);
      }
    });

    it('should reject unknown capability strings', () => {
      const result = AgentCapabilitySchema.safeParse('unknown-capability');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = AgentCapabilitySchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('InvokeAgentSchema', () => {
    it('should accept valid invoke input', () => {
      const result = InvokeAgentSchema.safeParse({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: { documentId: 'doc-1' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional verification flags', () => {
      const result = InvokeAgentSchema.safeParse({
        agentAccountId: 'my-agent.alice.testnet',
        type: 'analyze',
        payload: {},
        verifyCodehash: true,
        verifyAttestation: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing agentAccountId', () => {
      const result = InvokeAgentSchema.safeParse({
        type: 'analyze',
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AgentPermissionSchema', () => {
    it('should accept valid permission', () => {
      const result = AgentPermissionSchema.safeParse({
        receiverId: 'social.testnet',
        methodNames: ['set', 'get'],
        allowance: '1000000000000000000000000',
        purpose: 'Read and write social data',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric allowance', () => {
      const result = AgentPermissionSchema.safeParse({
        receiverId: 'social.testnet',
        methodNames: ['set'],
        allowance: 'not-a-number',
        purpose: 'Test',
      });
      expect(result.success).toBe(false);
    });
  });
});
