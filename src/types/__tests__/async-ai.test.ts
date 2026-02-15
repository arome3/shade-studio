import { describe, it, expect } from 'vitest';
import {
  AIJobParamsSchema,
  AIJobCheckpointSchema,
  AIJobSchema,
  DocumentAnalysisParamsSchema,
  ProposalReviewParamsSchema,
  CompetitiveResearchParamsSchema,
  GrantMatchingParamsSchema,
  WeeklySynthesisParamsSchema,
} from '../async-ai';

// ============================================================================
// Document Analysis Params
// ============================================================================

describe('DocumentAnalysisParamsSchema', () => {
  it('accepts valid params', () => {
    const result = DocumentAnalysisParamsSchema.safeParse({
      type: 'document-analysis',
      documentIds: ['doc-1', 'doc-2'],
      depth: 'standard',
    });
    expect(result.success).toBe(true);
  });

  it('accepts with optional focusAreas', () => {
    const result = DocumentAnalysisParamsSchema.safeParse({
      type: 'document-analysis',
      documentIds: ['doc-1'],
      depth: 'deep',
      focusAreas: ['budget', 'timeline'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty documentIds', () => {
    const result = DocumentAnalysisParamsSchema.safeParse({
      type: 'document-analysis',
      documentIds: [],
      depth: 'quick',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid depth', () => {
    const result = DocumentAnalysisParamsSchema.safeParse({
      type: 'document-analysis',
      documentIds: ['doc-1'],
      depth: 'ultra',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Proposal Review Params
// ============================================================================

describe('ProposalReviewParamsSchema', () => {
  it('accepts valid params', () => {
    const result = ProposalReviewParamsSchema.safeParse({
      type: 'proposal-review',
      proposalId: 'prop-123',
      grantProgram: 'near-grants',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing proposalId', () => {
    const result = ProposalReviewParamsSchema.safeParse({
      type: 'proposal-review',
      grantProgram: 'near-grants',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty grantProgram', () => {
    const result = ProposalReviewParamsSchema.safeParse({
      type: 'proposal-review',
      proposalId: 'prop-1',
      grantProgram: '',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Competitive Research Params
// ============================================================================

describe('CompetitiveResearchParamsSchema', () => {
  it('accepts valid params', () => {
    const result = CompetitiveResearchParamsSchema.safeParse({
      type: 'competitive-research',
      targetProject: 'shade-studio',
      competitors: ['project-a', 'project-b'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty competitors array', () => {
    const result = CompetitiveResearchParamsSchema.safeParse({
      type: 'competitive-research',
      targetProject: 'shade-studio',
      competitors: [],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Grant Matching Params
// ============================================================================

describe('GrantMatchingParamsSchema', () => {
  it('accepts valid params', () => {
    const result = GrantMatchingParamsSchema.safeParse({
      type: 'grant-matching',
      projectDescription: 'A decentralized AI analysis platform built on NEAR.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts with budget range', () => {
    const result = GrantMatchingParamsSchema.safeParse({
      type: 'grant-matching',
      projectDescription: 'A decentralized AI analysis platform built on NEAR.',
      budgetRange: { min: 5000, max: 50000 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects too short description', () => {
    const result = GrantMatchingParamsSchema.safeParse({
      type: 'grant-matching',
      projectDescription: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid budget range (max < min)', () => {
    const result = GrantMatchingParamsSchema.safeParse({
      type: 'grant-matching',
      projectDescription: 'A decentralized AI analysis platform built on NEAR.',
      budgetRange: { min: 50000, max: 5000 },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Weekly Synthesis Params
// ============================================================================

describe('WeeklySynthesisParamsSchema', () => {
  it('accepts valid params', () => {
    const result = WeeklySynthesisParamsSchema.safeParse({
      type: 'weekly-synthesis',
      accountId: 'alice.testnet',
    });
    expect(result.success).toBe(true);
  });

  it('accepts with optional days', () => {
    const result = WeeklySynthesisParamsSchema.safeParse({
      type: 'weekly-synthesis',
      accountId: 'alice.testnet',
      days: 14,
    });
    expect(result.success).toBe(true);
  });

  it('rejects days > 30', () => {
    const result = WeeklySynthesisParamsSchema.safeParse({
      type: 'weekly-synthesis',
      accountId: 'alice.testnet',
      days: 60,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Discriminated Union
// ============================================================================

describe('AIJobParamsSchema (discriminated union)', () => {
  it('dispatches to correct schema by type', () => {
    const docResult = AIJobParamsSchema.safeParse({
      type: 'document-analysis',
      documentIds: ['doc-1'],
      depth: 'quick',
    });
    expect(docResult.success).toBe(true);

    const grantResult = AIJobParamsSchema.safeParse({
      type: 'grant-matching',
      projectDescription: 'A decentralized analytics platform for on-chain data.',
    });
    expect(grantResult.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = AIJobParamsSchema.safeParse({
      type: 'unknown-type',
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched type and fields', () => {
    // document-analysis type but with proposal-review fields
    const result = AIJobParamsSchema.safeParse({
      type: 'document-analysis',
      proposalId: 'prop-1',
      grantProgram: 'near',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Checkpoint Schema
// ============================================================================

describe('AIJobCheckpointSchema', () => {
  it('accepts valid checkpoint', () => {
    const result = AIJobCheckpointSchema.safeParse({
      progress: 50,
      step: 'Analyzing section 3/6',
      state: '{"section":3}',
      timestamp: '2024-01-15T10:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects progress > 100', () => {
    const result = AIJobCheckpointSchema.safeParse({
      progress: 150,
      step: 'step',
      state: '{}',
      timestamp: '2024-01-15T10:30:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects progress < 0', () => {
    const result = AIJobCheckpointSchema.safeParse({
      progress: -1,
      step: 'step',
      state: '{}',
      timestamp: '2024-01-15T10:30:00Z',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Full Job Schema
// ============================================================================

describe('AIJobSchema', () => {
  it('accepts a valid full job', () => {
    const result = AIJobSchema.safeParse({
      id: 'job-abc123',
      type: 'document-analysis',
      owner: 'alice.testnet',
      params: {
        type: 'document-analysis',
        documentIds: ['doc-1'],
        depth: 'standard',
      },
      status: 'processing',
      progress: 42,
      checkpoint: {
        progress: 42,
        step: 'Parsing document 1',
        state: '{}',
        timestamp: '2024-01-15T10:30:00Z',
      },
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts completed job with result', () => {
    const result = AIJobSchema.safeParse({
      id: 'job-def456',
      type: 'proposal-review',
      owner: 'bob.testnet',
      params: {
        type: 'proposal-review',
        proposalId: 'prop-1',
        grantProgram: 'near-grants',
      },
      status: 'completed',
      progress: 100,
      result: {
        type: 'proposal-review',
        data: { score: 85 },
        metadata: {
          totalDuration: 30000,
          checkpointCount: 3,
          tokensUsed: 15000,
        },
      },
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:05:00Z',
      completedAt: '2024-01-15T10:05:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = AIJobSchema.safeParse({
      id: 'job-1',
      type: 'document-analysis',
      owner: 'alice.testnet',
      params: { type: 'document-analysis', documentIds: ['doc-1'], depth: 'quick' },
      status: 'running',
      progress: 0,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});
