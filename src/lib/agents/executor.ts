/**
 * Agent Execution Runtime
 *
 * Pluggable execution interface with a default NearAIExecutor that
 * proxies agent invocations through NEAR AI Cloud with capability
 * enforcement and system prompt scoping.
 */

import { getAIClient } from '@/lib/ai/client';
import { CAPABILITY_CONFIGS } from './capabilities';
import { enforceCapabilities } from './capability-enforcer';
import type { AgentCapability, CodehashAttestation } from '@/types/agents';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionRequest {
  agentAccountId: string;
  templateId: string;
  templateName?: string;
  type: string;
  payload: Record<string, unknown>;
  capabilities: AgentCapability[];
  codehash: string;
  invocationId: string;
  signal?: AbortSignal;
}

export interface ExecutionResult {
  data: unknown;
  attestation?: CodehashAttestation;
  executionTimeMs: number;
  executor: string;
}

export interface AgentExecutor {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// NEAR AI Executor (default implementation)
// ============================================================================

export class NearAIExecutor implements AgentExecutor {
  /**
   * Execute an agent invocation via NEAR AI Cloud.
   *
   * 1. Enforce capability boundaries
   * 2. Build scoped system prompt
   * 3. Call NEAR AI via getAIClient().chat()
   * 4. Package result with timing + attestation
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Enforce capabilities
    const enforcement = enforceCapabilities(request.capabilities, request.type, request.payload);
    if (!enforcement.allowed) {
      throw new AgentExecutionError(
        `Capability violation: ${enforcement.violations.join(', ')}`
      );
    }

    // 2. Build scoped system prompt
    const systemPrompt = this.buildSystemPrompt(request);

    // 3. Call NEAR AI
    const client = getAIClient();
    const userMessage = JSON.stringify({
      type: request.type,
      payload: request.payload,
      invocationId: request.invocationId,
    });

    const { content, attestation: rawAttestation } = await client.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        abortController: request.signal
          ? { signal: request.signal } as AbortController
          : undefined,
      }
    );

    // 4. Parse response — try JSON first, fall back to raw string
    let data: unknown;
    try {
      // Strip markdown code blocks if present
      const cleaned = content
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?\s*```\s*$/i, '')
        .trim();
      data = JSON.parse(cleaned);
    } catch {
      data = { content };
    }

    // Map attestation to CodehashAttestation if present
    let attestation: CodehashAttestation | undefined;
    if (rawAttestation) {
      attestation = {
        codehash: request.codehash,
        teeType: rawAttestation.tee_type || 'near-ai',
        attestationDocument: rawAttestation.quote || '',
        signature: rawAttestation.signature ?? '',
        timestamp: rawAttestation.timestamp || new Date().toISOString(),
        verified: false,
      };
    }

    return {
      data,
      attestation,
      executionTimeMs: Date.now() - startTime,
      executor: 'near-ai',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = getAIClient();
      return client.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Build a scoped system prompt that constrains the AI to the
   * agent's declared capabilities.
   */
  private buildSystemPrompt(request: ExecutionRequest): string {
    const capLabels = request.capabilities
      .map((c) => CAPABILITY_CONFIGS[c]?.label ?? c)
      .join(', ');

    const restrictions = request.capabilities
      .map((c) => {
        const cfg = CAPABILITY_CONFIGS[c];
        return cfg ? `- ${cfg.label}: ${cfg.description}` : `- ${c}`;
      })
      .join('\n');

    return [
      `You are a Shade Agent (${request.templateName ?? request.templateId}).`,
      `Agent Account: ${request.agentAccountId}`,
      `Capabilities: ${capLabels}`,
      `Codehash: ${request.codehash}`,
      '',
      'You are executing an invocation request. Respond with structured JSON when possible.',
      '',
      'Your allowed capabilities:',
      restrictions,
      '',
      'You must NOT:',
      '- Access capabilities not listed above',
      '- Execute blockchain write operations unless you have blockchain-write capability',
      '- Produce content outside your defined scope',
      '',
      'Respond concisely and accurately based on the invocation payload.',
    ].join('\n');
  }
}

// ============================================================================
// Error
// ============================================================================

export class AgentExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}

// ============================================================================
// Singleton
// ============================================================================

let executorInstance: AgentExecutor | null = null;

export function getAgentExecutor(): AgentExecutor {
  if (!executorInstance) {
    executorInstance = new NearAIExecutor();
  }
  return executorInstance;
}

export function setAgentExecutor(executor: AgentExecutor): void {
  executorInstance = executor;
}
