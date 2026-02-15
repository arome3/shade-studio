/**
 * Async AI Pipeline Types
 *
 * Domain types for long-running AI analysis jobs processed via
 * NEAR's yield/resume pattern. Jobs are submitted on-chain,
 * processed by authorized workers with intermediate checkpoints,
 * and results are polled asynchronously.
 */

import { z } from 'zod';
import type { NEARAIAttestation } from '@/types/ai';

// ============================================================================
// Enums
// ============================================================================

/** Supported async AI job types */
export type AIJobType =
  | 'document-analysis'
  | 'proposal-review'
  | 'competitive-research'
  | 'grant-matching'
  | 'weekly-synthesis';

/** Job lifecycle status (matches contract state machine) */
export type AIJobStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'timeout';

// ============================================================================
// Core Types
// ============================================================================

/** Intermediate checkpoint saved during job processing */
export interface AIJobCheckpoint {
  /** Progress percentage (0–100) */
  progress: number;
  /** Current processing step description */
  step: string;
  /** Serialized intermediate state for resume */
  state: string;
  /** When this checkpoint was created (ISO 8601) */
  timestamp: string;
}

/** Parameters for document analysis jobs */
export interface DocumentAnalysisParams {
  type: 'document-analysis';
  /** Document IDs to analyze */
  documentIds: string[];
  /** Analysis depth */
  depth: 'quick' | 'standard' | 'deep';
  /** Specific focus areas */
  focusAreas?: string[];
}

/** Parameters for proposal review jobs */
export interface ProposalReviewParams {
  type: 'proposal-review';
  /** Proposal document ID */
  proposalId: string;
  /** Grant program to evaluate against */
  grantProgram: string;
  /** Whether to include scoring rubric */
  includeRubric?: boolean;
}

/** Parameters for competitive research jobs */
export interface CompetitiveResearchParams {
  type: 'competitive-research';
  /** Project or protocol to research */
  targetProject: string;
  /** Competitor names or domains */
  competitors: string[];
  /** Research dimensions */
  dimensions?: string[];
}

/** Parameters for grant matching jobs */
export interface GrantMatchingParams {
  type: 'grant-matching';
  /** Project description for matching */
  projectDescription: string;
  /** Budget range in USD */
  budgetRange?: { min: number; max: number };
  /** Technology tags */
  techStack?: string[];
}

/** Parameters for weekly synthesis jobs */
export interface WeeklySynthesisParams {
  type: 'weekly-synthesis';
  /** Account to synthesize activity for */
  accountId: string;
  /** Number of days to cover (default 7) */
  days?: number;
}

/** Discriminated union of all job parameter types */
export type AIJobParams =
  | DocumentAnalysisParams
  | ProposalReviewParams
  | CompetitiveResearchParams
  | GrantMatchingParams
  | WeeklySynthesisParams;

/** Result metadata from a completed job */
export interface AIJobResultMetadata {
  /** Total processing duration in milliseconds */
  totalDuration: number;
  /** Number of checkpoints saved */
  checkpointCount: number;
  /** Total tokens consumed */
  tokensUsed: number;
}

/** Result from a completed AI job */
export interface AIJobResult {
  /** Job type that produced this result */
  type: AIJobType;
  /** Result data (structure varies by job type) */
  data: Record<string, unknown>;
  /** Processing metadata */
  metadata: AIJobResultMetadata;
}

/** Full AI job record */
export interface AIJob {
  /** Unique job identifier */
  id: string;
  /** Job type */
  type: AIJobType;
  /** NEAR account that submitted the job */
  owner: string;
  /** Job parameters */
  params: AIJobParams;
  /** Current status */
  status: AIJobStatus;
  /** Progress percentage (0–100) */
  progress: number;
  /** Latest checkpoint (if any) */
  checkpoint?: AIJobCheckpoint;
  /** Final result (if completed) */
  result?: AIJobResult;
  /** Error message (if failed) */
  error?: string;
  /** TEE attestation for result integrity */
  attestation?: NEARAIAttestation;
  /** When the job was submitted (ISO 8601) */
  createdAt: string;
  /** When the job was last updated (ISO 8601) */
  updatedAt: string;
  /** When the job completed (ISO 8601) */
  completedAt?: string;
}

/** Lightweight job summary for list views */
export interface AIJobSummary {
  id: string;
  type: AIJobType;
  status: AIJobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Display Helpers
// ============================================================================

/** Human-readable labels for job types */
export const JOB_TYPE_LABELS: Record<AIJobType, string> = {
  'document-analysis': 'Document Analysis',
  'proposal-review': 'Proposal Review',
  'competitive-research': 'Competitive Research',
  'grant-matching': 'Grant Matching',
  'weekly-synthesis': 'Weekly Synthesis',
};

/** Human-readable labels for job statuses */
export const JOB_STATUS_LABELS: Record<AIJobStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  timeout: 'Timed Out',
};

// ============================================================================
// Zod Schemas
// ============================================================================

export const DocumentAnalysisParamsSchema = z.object({
  type: z.literal('document-analysis'),
  documentIds: z.array(z.string().min(1)).min(1).max(50),
  depth: z.enum(['quick', 'standard', 'deep']),
  focusAreas: z.array(z.string()).optional(),
});

export const ProposalReviewParamsSchema = z.object({
  type: z.literal('proposal-review'),
  proposalId: z.string().min(1),
  grantProgram: z.string().min(1),
  includeRubric: z.boolean().optional(),
});

export const CompetitiveResearchParamsSchema = z.object({
  type: z.literal('competitive-research'),
  targetProject: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(1).max(20),
  dimensions: z.array(z.string()).optional(),
});

export const GrantMatchingParamsSchema = z.object({
  type: z.literal('grant-matching'),
  projectDescription: z.string().min(10).max(5000),
  budgetRange: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().positive(),
    })
    .refine((r) => r.max > r.min, {
      message: 'max must be greater than min',
    })
    .optional(),
  techStack: z.array(z.string()).optional(),
});

export const WeeklySynthesisParamsSchema = z.object({
  type: z.literal('weekly-synthesis'),
  accountId: z.string().min(2).max(64),
  days: z.number().int().min(1).max(30).optional(),
});

/** Discriminated union schema for all job parameter types */
export const AIJobParamsSchema = z.discriminatedUnion('type', [
  DocumentAnalysisParamsSchema,
  ProposalReviewParamsSchema,
  CompetitiveResearchParamsSchema,
  GrantMatchingParamsSchema,
  WeeklySynthesisParamsSchema,
]);

export const AIJobCheckpointSchema = z.object({
  progress: z.number().min(0).max(100),
  step: z.string(),
  state: z.string(),
  timestamp: z.string(),
});

export const AIJobSchema = z.object({
  id: z.string(),
  type: z.enum([
    'document-analysis',
    'proposal-review',
    'competitive-research',
    'grant-matching',
    'weekly-synthesis',
  ]),
  owner: z.string(),
  params: AIJobParamsSchema,
  status: z.enum(['pending', 'processing', 'paused', 'completed', 'failed', 'timeout']),
  progress: z.number().min(0).max(100),
  checkpoint: AIJobCheckpointSchema.optional(),
  result: z
    .object({
      type: z.enum([
        'document-analysis',
        'proposal-review',
        'competitive-research',
        'grant-matching',
        'weekly-synthesis',
      ]),
      data: z.record(z.unknown()),
      metadata: z.object({
        totalDuration: z.number(),
        checkpointCount: z.number(),
        tokensUsed: z.number(),
      }),
    })
    .optional(),
  error: z.string().optional(),
  attestation: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
