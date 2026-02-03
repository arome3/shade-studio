/**
 * Briefing Generator
 *
 * Generates daily intelligence briefings using NEAR AI Cloud.
 * Supports streaming responses with progress callbacks.
 */

import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import { buildContext, type ContextDocument } from '@/lib/ai/context';
import {
  BRIEFING_SYSTEM_PROMPT,
  buildBriefingUserPrompt,
  DEFAULT_BRIEFING_PROMPT,
  type BriefingProjectContext,
  type BriefingDeadlineContext,
} from './prompts';
import type {
  DailyBriefing,
  BriefingItem,
  BriefingMetrics,
  BriefingPriority,
  BriefingItemType,
  GrantPipelineItem,
  Recommendation,
  ItemStatus,
  BriefingOptions,
  GrantPipelineStatus,
} from '@/types/intelligence';
import type { NEARAIAttestation } from '@/types/ai';

// ============================================================================
// Types
// ============================================================================

/** Raw AI response structure */
interface RawBriefingResponse {
  greeting?: string;
  summary?: string;
  sentiment?: string;
  priorityItems?: Array<{
    title?: string;
    description?: string;
    priority?: string;
    type?: string;
    dueDate?: string;
  }>;
  grantPipeline?: Array<{
    program?: string;
    status?: string;
    deadline?: string;
    nextAction?: string;
    progress?: number;
  }>;
  recommendations?: Array<{
    title?: string;
    description?: string;
    impact?: string;
    effort?: string;
    rationale?: string;
  }>;
  metrics?: Partial<BriefingMetrics>;
}

/** Generation context */
export interface BriefingGenerationContext {
  documents: ContextDocument[];
  deadlines: BriefingDeadlineContext[];
  projects: BriefingProjectContext[];
  accountId: string;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_PRIORITIES: BriefingPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_ITEM_TYPES: BriefingItemType[] = [
  'deadline',
  'opportunity',
  'update',
  'milestone',
  'action-required',
  'news',
  'recommendation',
];
const VALID_PIPELINE_STATUSES: GrantPipelineStatus[] = [
  'researching',
  'drafting',
  'review',
  'submitted',
  'approved',
  'rejected',
];
const VALID_IMPACT_LEVELS = ['high', 'medium', 'low'] as const;

// ============================================================================
// JSON Parsing
// ============================================================================

/**
 * Parse JSON response from AI, handling markdown code blocks.
 */
export function parseJsonResponse(content: string): RawBriefingResponse {
  let jsonString = content.trim();

  // Remove markdown code blocks if present
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.slice(7);
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.slice(3);
  }

  if (jsonString.endsWith('```')) {
    jsonString = jsonString.slice(0, -3);
  }

  jsonString = jsonString.trim();

  // Try to find JSON object if there's surrounding text
  const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('[Briefing] Failed to parse JSON response:', error);
    console.debug('[Briefing] Raw content:', content.slice(0, 500));
    throw new Error('Failed to parse briefing response. Please try again.');
  }
}

// ============================================================================
// Validation & Normalization
// ============================================================================

/**
 * Validate and normalize priority.
 */
export function validatePriority(priority?: string): BriefingPriority {
  if (!priority) return 'medium';
  const lower = priority.toLowerCase() as BriefingPriority;
  return VALID_PRIORITIES.includes(lower) ? lower : 'medium';
}

/**
 * Validate and normalize item type.
 */
export function validateItemType(type?: string): BriefingItemType {
  if (!type) return 'update';
  const lower = type.toLowerCase().replace(/_/g, '-') as BriefingItemType;
  return VALID_ITEM_TYPES.includes(lower) ? lower : 'update';
}

/**
 * Validate and normalize pipeline status.
 */
export function validatePipelineStatus(status?: string): GrantPipelineStatus {
  if (!status) return 'researching';
  const lower = status.toLowerCase() as GrantPipelineStatus;
  return VALID_PIPELINE_STATUSES.includes(lower) ? lower : 'researching';
}

/**
 * Validate impact/effort level.
 */
function validateImpactLevel(level?: string): 'high' | 'medium' | 'low' {
  if (!level) return 'medium';
  const lower = level.toLowerCase() as 'high' | 'medium' | 'low';
  return VALID_IMPACT_LEVELS.includes(lower) ? lower : 'medium';
}

/**
 * Normalize priority items from raw response.
 */
export function normalizeItems(
  rawItems: RawBriefingResponse['priorityItems'],
  maxItems: number = 5
): BriefingItem[] {
  if (!rawItems || !Array.isArray(rawItems)) return [];

  return rawItems
    .slice(0, maxItems)
    .filter((item) => item.title && item.description)
    .map((item) => ({
      id: nanoid(),
      title: item.title || 'Untitled Item',
      description: item.description || '',
      priority: validatePriority(item.priority),
      type: validateItemType(item.type),
      dueDate: item.dueDate,
      isRead: false,
      isDismissed: false,
      status: 'pending' as ItemStatus,
      createdAt: new Date().toISOString(),
    }));
}

/**
 * Normalize grant pipeline items.
 */
function normalizePipeline(
  rawPipeline: RawBriefingResponse['grantPipeline'],
  maxItems: number = 5
): GrantPipelineItem[] {
  if (!rawPipeline || !Array.isArray(rawPipeline)) return [];

  return rawPipeline
    .slice(0, maxItems)
    .filter((item) => item.program)
    .map((item) => ({
      program: item.program || 'Unknown Program',
      status: validatePipelineStatus(item.status),
      deadline: item.deadline,
      nextAction: item.nextAction,
      progress: Math.min(100, Math.max(0, item.progress ?? 0)),
    }));
}

/**
 * Normalize recommendations.
 */
function normalizeRecommendations(
  rawRecs: RawBriefingResponse['recommendations'],
  maxItems: number = 3
): Recommendation[] {
  if (!rawRecs || !Array.isArray(rawRecs)) return [];

  return rawRecs
    .slice(0, maxItems)
    .filter((rec) => rec.title && rec.description)
    .map((rec) => ({
      title: rec.title || 'Recommendation',
      description: rec.description || '',
      impact: validateImpactLevel(rec.impact),
      effort: validateImpactLevel(rec.effort),
      rationale: rec.rationale || '',
    }));
}

/**
 * Normalize metrics with defaults.
 */
function normalizeMetrics(rawMetrics?: Partial<BriefingMetrics>): BriefingMetrics {
  return {
    activeProjects: rawMetrics?.activeProjects ?? 0,
    pendingProposals: rawMetrics?.pendingProposals ?? 0,
    upcomingDeadlines: rawMetrics?.upcomingDeadlines ?? 0,
    actionRequired: rawMetrics?.actionRequired ?? 0,
    totalFundingRequested: rawMetrics?.totalFundingRequested ?? 0,
    totalFundingReceived: rawMetrics?.totalFundingReceived ?? 0,
  };
}

/**
 * Validate sentiment value.
 */
function validateSentiment(
  sentiment?: string
): 'bullish' | 'neutral' | 'bearish' {
  if (!sentiment) return 'neutral';
  const lower = sentiment.toLowerCase();
  if (lower === 'bullish' || lower === 'neutral' || lower === 'bearish') {
    return lower;
  }
  return 'neutral';
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Get color for priority level.
 */
export function getPriorityColor(priority: BriefingPriority): string {
  switch (priority) {
    case 'critical':
      return 'text-error';
    case 'high':
      return 'text-warning';
    case 'medium':
      return 'text-near-green-500';
    case 'low':
      return 'text-text-muted';
    default:
      return 'text-text-muted';
  }
}

/**
 * Get background color for priority level.
 */
export function getPriorityBgColor(priority: BriefingPriority): string {
  switch (priority) {
    case 'critical':
      return 'bg-error/10';
    case 'high':
      return 'bg-warning/10';
    case 'medium':
      return 'bg-near-green-500/10';
    case 'low':
      return 'bg-surface';
    default:
      return 'bg-surface';
  }
}

/**
 * Get color for pipeline status.
 */
export function getStatusColor(status: GrantPipelineStatus): string {
  switch (status) {
    case 'approved':
      return 'text-success';
    case 'submitted':
      return 'text-near-green-500';
    case 'review':
      return 'text-near-cyan-500';
    case 'drafting':
      return 'text-near-purple-500';
    case 'researching':
      return 'text-text-muted';
    case 'rejected':
      return 'text-error';
    default:
      return 'text-text-muted';
  }
}

/**
 * Get color for item status.
 */
export function getItemStatusColor(status?: ItemStatus): string {
  switch (status) {
    case 'completed':
      return 'text-success';
    case 'in_progress':
      return 'text-near-cyan-500';
    case 'deferred':
      return 'text-text-muted';
    case 'pending':
    default:
      return 'text-text-secondary';
  }
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a daily briefing using NEAR AI Cloud.
 */
export async function generateDailyBriefing(
  context: BriefingGenerationContext,
  options: BriefingOptions = {}
): Promise<DailyBriefing> {
  const {
    maxItemsPerSection = 5,
    onProgress,
    abortController,
  } = options;

  const client = getAIClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Report initial progress
  onProgress?.(10);

  // Build context from documents
  const { contextString, includedDocuments } = buildContext(
    context.documents,
    undefined,
    { maxTokens: 3000 }
  );

  onProgress?.(20);

  // Build user prompt
  const userPrompt = context.documents.length > 0 ||
    context.deadlines.length > 0 ||
    context.projects.length > 0
    ? buildBriefingUserPrompt(
        context.documents,
        context.deadlines,
        context.projects,
        new Date(),
        context.accountId
      )
    : DEFAULT_BRIEFING_PROMPT;

  onProgress?.(30);

  // Build system prompt with optional document context
  let systemPrompt = BRIEFING_SYSTEM_PROMPT;
  if (contextString) {
    systemPrompt += `\n\n## DOCUMENT CONTEXT\n${contextString}`;
  }

  // Prepare messages
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  onProgress?.(40);

  // Call AI for generation
  const chatOptions: ChatOptions = {
    temperature: 0.7,
    abortController,
  };

  let attestation: NEARAIAttestation | undefined;
  let responseContent = '';

  // Use non-streaming for JSON reliability
  try {
    const result = await client.chat(messages, chatOptions);
    responseContent = result.content;
    attestation = result.attestation;
    onProgress?.(80);
  } catch (error) {
    onProgress?.(0);
    throw error;
  }

  // Parse response
  const rawResponse = parseJsonResponse(responseContent);
  onProgress?.(90);

  // Build final briefing
  const briefing: DailyBriefing = {
    id: nanoid(),
    accountId: context.accountId,
    date: today,
    greeting: rawResponse.greeting || `Good ${format(new Date(), 'EEEE')}!`,
    summary: rawResponse.summary || 'No summary available.',
    items: normalizeItems(rawResponse.priorityItems, maxItemsPerSection),
    metrics: normalizeMetrics(rawResponse.metrics),
    sentiment: validateSentiment(rawResponse.sentiment),
    grantPipeline: normalizePipeline(rawResponse.grantPipeline, maxItemsPerSection),
    recommendations: normalizeRecommendations(rawResponse.recommendations, 3),
    sourceDocumentIds: includedDocuments,
    attestation,
    generatedAt: new Date().toISOString(),
  };

  onProgress?.(100);

  return briefing;
}

/**
 * Generate a default briefing without AI (for offline/error cases).
 */
export function generateDefaultBriefing(accountId: string): DailyBriefing {
  const today = format(new Date(), 'yyyy-MM-dd');
  const timeOfDay = new Date().getHours() < 12 ? 'morning' :
    new Date().getHours() < 17 ? 'afternoon' : 'evening';

  return {
    id: nanoid(),
    accountId,
    date: today,
    greeting: `Good ${timeOfDay}! Welcome to Shade Studio.`,
    summary: 'Your daily briefing is ready. Add projects and documents to get personalized insights.',
    items: [
      {
        id: nanoid(),
        title: 'Get Started with Your First Project',
        description: 'Create a project to start tracking your grant applications and deadlines.',
        type: 'action-required',
        priority: 'high',
        isRead: false,
        isDismissed: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: nanoid(),
        title: 'Upload Your Documents',
        description: 'Add proposal drafts and supporting documents to get AI-powered writing assistance.',
        type: 'recommendation',
        priority: 'medium',
        isRead: false,
        isDismissed: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ],
    metrics: {
      activeProjects: 0,
      pendingProposals: 0,
      upcomingDeadlines: 0,
      actionRequired: 2,
      totalFundingRequested: 0,
      totalFundingReceived: 0,
    },
    sentiment: 'neutral',
    grantPipeline: [],
    recommendations: [
      {
        title: 'Explore Grant Programs',
        description: 'Research available Web3 grant programs that align with your project.',
        impact: 'high',
        effort: 'medium',
        rationale: 'Finding the right grant programs early increases your chances of success.',
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}
