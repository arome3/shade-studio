/**
 * Weekly Synthesis Utilities
 *
 * AI-powered weekly strategic reports using NEAR AI Cloud.
 * Aggregates data from briefings, meetings, decisions, and competitive tracker
 * to produce trend analysis, grant progress tracking, and recommendations.
 */

import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import { withRetry, type ProjectContext } from './competitive';
import { startOfWeek, endOfWeek, format, parseISO, isWithinInterval } from 'date-fns';
import type {
  DailyBriefing,
  Decision,
  Meeting,
  CompetitiveEntry,
  Competitor,
  WeeklySynthesis,
  WeeklyTrend,
  WeeklyGrantProgress,
  WeeklyRecommendation,
  WeeklySummaryStats,
  SynthesisStatus,
  TrendDirection,
  BriefingPriority,
  GrantPipelineStatus,
} from '@/types/intelligence';
import type { BadgeProps } from '@/components/ui/badge';

// ============================================================================
// Week Boundary Helpers
// ============================================================================

/** Week bounds as YYYY-MM-DD strings */
export interface WeekBounds {
  weekStart: string;
  weekEnd: string;
}

/**
 * Get the Monday–Sunday bounds for the week containing the given date.
 * Defaults to the current date.
 */
export function getWeekBounds(date?: Date): WeekBounds {
  const d = date ?? new Date();
  const monday = startOfWeek(d, { weekStartsOn: 1 });
  const sunday = endOfWeek(d, { weekStartsOn: 1 });
  return {
    weekStart: format(monday, 'yyyy-MM-dd'),
    weekEnd: format(sunday, 'yyyy-MM-dd'),
  };
}

// ============================================================================
// Data Gathering
// ============================================================================

/** Aggregated context for a single week used to generate synthesis */
export interface WeeklyDataContext {
  weekStart: string;
  weekEnd: string;
  briefings: DailyBriefing[];
  decisions: Decision[];
  meetings: Meeting[];
  entries: CompetitiveEntry[];
  competitors: Competitor[];
  stats: WeeklySummaryStats;
}

/**
 * Filter and aggregate data from all four modules for a given week.
 * Pure function — accepts all data as arguments for testability.
 */
export function gatherWeeklyData(
  weekStart: string,
  weekEnd: string,
  allBriefings: DailyBriefing[],
  allDecisions: Decision[],
  allMeetings: Meeting[],
  allEntries: CompetitiveEntry[],
  allCompetitors: Competitor[]
): WeeklyDataContext {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);
  const interval = { start, end };

  // Filter briefings by date string (YYYY-MM-DD)
  const briefings = allBriefings.filter((b) => {
    try {
      return isWithinInterval(parseISO(b.date), interval);
    } catch {
      return false;
    }
  });

  // Filter decisions by decisionDate
  const decisions = allDecisions.filter((d) => {
    try {
      return isWithinInterval(parseISO(d.decisionDate), interval);
    } catch {
      return false;
    }
  });

  // Filter meetings by date
  const meetings = allMeetings.filter((m) => {
    try {
      return isWithinInterval(parseISO(m.date), interval);
    } catch {
      return false;
    }
  });

  // Filter competitive entries by createdAt timestamp
  // endOfWeek already returns Sunday 23:59:59.999, so no adjustment needed
  const startTs = start.getTime();
  const endTs = end.getTime();
  const entries = allEntries.filter(
    (e) => e.createdAt >= startTs && e.createdAt <= endTs
  );

  // Compute stats
  let actionItemsCompleted = 0;
  let actionItemsCreated = 0;
  for (const m of meetings) {
    actionItemsCreated += m.actionItems.length;
    actionItemsCompleted += m.actionItems.filter(
      (a) => a.status === 'completed'
    ).length;
  }

  const totalFundingTracked = entries
    .filter((e) => e.type === 'funding')
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const stats: WeeklySummaryStats = {
    briefingsGenerated: briefings.length,
    meetingsHeld: meetings.length,
    decisionsMade: decisions.length,
    competitiveEntries: entries.length,
    actionItemsCompleted,
    actionItemsCreated,
    totalFundingTracked,
  };

  return {
    weekStart,
    weekEnd,
    briefings,
    decisions,
    meetings,
    entries,
    competitors: allCompetitors,
    stats,
  };
}

// ============================================================================
// JSON Parsing (replicates pattern from competitive.ts / meetings.ts)
// ============================================================================

function parseJsonFromAI<T>(content: string): T {
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

  // Try to find JSON in surrounding text
  const jsonMatch = jsonString.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  }

  return JSON.parse(jsonString);
}

// ============================================================================
// Project Context
// ============================================================================

function buildProjectContextPrompt(ctx?: ProjectContext): string {
  if (!ctx?.projectName) return '';
  const parts = [`You are generating a weekly synthesis for ${ctx.projectName}.`];
  if (ctx.projectDescription) {
    parts.push(`Project description: ${ctx.projectDescription}.`);
  }
  parts.push('Provide strategic insights relative to this project\'s goals.');
  return ' ' + parts.join(' ');
}

// ============================================================================
// Normalization Helpers
// ============================================================================

const VALID_DIRECTIONS: TrendDirection[] = ['positive', 'negative', 'neutral'];
const VALID_PRIORITIES: BriefingPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_EFFORTS = ['high', 'medium', 'low'] as const;
const VALID_PIPELINE_STATUSES: GrantPipelineStatus[] = [
  'researching', 'drafting', 'review', 'submitted', 'approved', 'rejected',
];

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(min, Math.min(max, value));
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => (v as string).trim());
}

function normalizeDirection(value: unknown): TrendDirection {
  if (typeof value === 'string' && VALID_DIRECTIONS.includes(value as TrendDirection)) {
    return value as TrendDirection;
  }
  return 'neutral';
}

function normalizePriority(value: unknown): BriefingPriority {
  if (typeof value === 'string' && VALID_PRIORITIES.includes(value as BriefingPriority)) {
    return value as BriefingPriority;
  }
  return 'medium';
}

function normalizeEffort(value: unknown): 'high' | 'medium' | 'low' {
  if (typeof value === 'string' && VALID_EFFORTS.includes(value as 'high' | 'medium' | 'low')) {
    return value as 'high' | 'medium' | 'low';
  }
  return 'medium';
}

function normalizePipelineStatus(value: unknown): GrantPipelineStatus {
  if (typeof value === 'string' && VALID_PIPELINE_STATUSES.includes(value as GrantPipelineStatus)) {
    return value as GrantPipelineStatus;
  }
  return 'researching';
}

function normalizeTrends(raw: unknown): WeeklyTrend[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: Record<string, unknown>) => ({
    title: normalizeString(t?.title, 'Trend'),
    description: normalizeString(t?.description, ''),
    category: normalizeString(t?.category, 'general'),
    direction: normalizeDirection(t?.direction),
    confidence: normalizeNumber(t?.confidence, 50, 0, 100),
  }));
}

function normalizeGrantProgress(raw: unknown): WeeklyGrantProgress[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g: Record<string, unknown>) => ({
    program: normalizeString(g?.program, 'Unknown Program'),
    previousStatus: normalizePipelineStatus(g?.previousStatus),
    currentStatus: normalizePipelineStatus(g?.currentStatus),
    milestones: normalizeStringArray(g?.milestones),
    blockers: normalizeStringArray(g?.blockers),
    progressDelta: normalizeNumber(g?.progressDelta, 0, -100, 100),
  }));
}

function normalizeRecommendations(raw: unknown): WeeklyRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => ({
    title: normalizeString(r?.title, 'Recommendation'),
    description: normalizeString(r?.description, ''),
    priority: normalizePriority(r?.priority),
    category: normalizeString(r?.category, 'general'),
    effort: normalizeEffort(r?.effort),
  }));
}

// ============================================================================
// AI Generation
// ============================================================================

/**
 * Generate a weekly synthesis report from gathered data.
 */
export async function generateWeeklySynthesis(
  context: WeeklyDataContext,
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<WeeklySynthesis> {
  const client = getAIClient();
  const projectPrompt = buildProjectContextPrompt(projectContext);

  // Build data summary for AI context
  const briefingSummaries = context.briefings
    .slice(0, 7)
    .map((b) => `- ${b.date}: ${b.summary}`)
    .join('\n');

  const decisionSummaries = context.decisions
    .slice(0, 10)
    .map((d) => `- [${d.category}/${d.status}] ${d.title}: ${d.description.slice(0, 120)}`)
    .join('\n');

  const meetingSummaries = context.meetings
    .slice(0, 10)
    .map((m) => {
      const actionCount = m.actionItems.length;
      const completedCount = m.actionItems.filter((a) => a.status === 'completed').length;
      return `- [${m.type}] ${m.title} (${m.date}): ${m.summary ?? 'No summary'} | Actions: ${completedCount}/${actionCount}`;
    })
    .join('\n');

  const competitiveSummaries = context.entries
    .slice(0, 15)
    .map((e) => {
      const comp = context.competitors.find((c) => c.id === e.competitorId);
      return `- [${e.type}] ${comp?.name ?? 'Unknown'}: ${e.title}${e.amount ? ` ($${e.amount.toLocaleString()})` : ''}`;
    })
    .join('\n');

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a strategic intelligence analyst for Web3 grant teams. Generate comprehensive weekly synthesis reports. Respond with ONLY a JSON object matching this schema: { "executiveSummary": string, "strategicAnalysis": string, "trends": [{ "title": string, "description": string, "category": string, "direction": "positive"|"negative"|"neutral", "confidence": number(0-100) }], "grantProgress": [{ "program": string, "previousStatus": string, "currentStatus": string, "milestones": string[], "blockers": string[], "progressDelta": number(-100 to 100) }], "recommendations": [{ "title": string, "description": string, "priority": "critical"|"high"|"medium"|"low", "category": string, "effort": "high"|"medium"|"low" }], "highlights": string[], "risks": string[] }. Be thorough, strategic, and actionable.' +
        projectPrompt,
    },
    {
      role: 'user',
      content: `Generate a weekly synthesis report for the week of ${context.weekStart} to ${context.weekEnd}.

WEEKLY STATS:
- Briefings generated: ${context.stats.briefingsGenerated}
- Meetings held: ${context.stats.meetingsHeld}
- Decisions made: ${context.stats.decisionsMade}
- Competitive entries: ${context.stats.competitiveEntries}
- Action items created: ${context.stats.actionItemsCreated}
- Action items completed: ${context.stats.actionItemsCompleted}
- Total funding tracked: $${context.stats.totalFundingTracked.toLocaleString()}

${briefingSummaries ? `DAILY BRIEFINGS:\n${briefingSummaries}\n` : ''}
${decisionSummaries ? `DECISIONS:\n${decisionSummaries}\n` : ''}
${meetingSummaries ? `MEETINGS:\n${meetingSummaries}\n` : ''}
${competitiveSummaries ? `COMPETITIVE INTELLIGENCE:\n${competitiveSummaries}\n` : ''}
Provide a comprehensive weekly synthesis. Include 3-5 trends, relevant grant progress entries, and 3-5 actionable recommendations for next week. Respond with JSON only.`,
    },
  ];

  return withRetry(async () => {
    const { content, attestation } = await client.chat(messages, {
      temperature: 0.5,
      ...options,
    });

    const parsed = parseJsonFromAI<Record<string, unknown>>(content);

    const synthesis: WeeklySynthesis = {
      id: `synth-${context.weekStart}`,
      weekStart: context.weekStart,
      weekEnd: context.weekEnd,
      executiveSummary: normalizeString(parsed.executiveSummary, 'Weekly synthesis summary unavailable.'),
      strategicAnalysis: normalizeString(parsed.strategicAnalysis, ''),
      stats: context.stats,
      trends: normalizeTrends(parsed.trends),
      grantProgress: normalizeGrantProgress(parsed.grantProgress),
      recommendations: normalizeRecommendations(parsed.recommendations),
      highlights: normalizeStringArray(parsed.highlights),
      risks: normalizeStringArray(parsed.risks),
      status: 'completed' as SynthesisStatus,
      attestation,
      generatedAt: new Date().toISOString(),
    };

    return synthesis;
  });
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export a weekly synthesis to a formatted Markdown document.
 */
export function exportSynthesisToMarkdown(synthesis: WeeklySynthesis): string {
  const lines: string[] = [
    `# Weekly Synthesis: ${synthesis.weekStart} – ${synthesis.weekEnd}`,
    '',
    `Generated: ${synthesis.generatedAt.slice(0, 10)}`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    synthesis.executiveSummary,
    '',
  ];

  if (synthesis.strategicAnalysis) {
    lines.push('## Strategic Analysis', '', synthesis.strategicAnalysis, '');
  }

  // Stats
  lines.push('## Weekly Stats', '');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Briefings Generated | ${synthesis.stats.briefingsGenerated} |`);
  lines.push(`| Meetings Held | ${synthesis.stats.meetingsHeld} |`);
  lines.push(`| Decisions Made | ${synthesis.stats.decisionsMade} |`);
  lines.push(`| Competitive Entries | ${synthesis.stats.competitiveEntries} |`);
  lines.push(`| Action Items Created | ${synthesis.stats.actionItemsCreated} |`);
  lines.push(`| Action Items Completed | ${synthesis.stats.actionItemsCompleted} |`);
  lines.push(`| Total Funding Tracked | $${synthesis.stats.totalFundingTracked.toLocaleString()} |`);
  lines.push('');

  // Trends
  if (synthesis.trends.length > 0) {
    lines.push('## Trends', '');
    for (const trend of synthesis.trends) {
      const arrow = trend.direction === 'positive' ? '↑' : trend.direction === 'negative' ? '↓' : '→';
      lines.push(`### ${arrow} ${trend.title}`);
      lines.push('');
      lines.push(`- **Category:** ${trend.category}`);
      lines.push(`- **Direction:** ${trend.direction}`);
      lines.push(`- **Confidence:** ${trend.confidence}%`);
      lines.push('');
      lines.push(trend.description);
      lines.push('');
    }
  }

  // Grant Progress
  if (synthesis.grantProgress.length > 0) {
    lines.push('## Grant Progress', '');
    for (const gp of synthesis.grantProgress) {
      lines.push(`### ${gp.program}`);
      lines.push('');
      lines.push(`- **Status:** ${gp.previousStatus} → ${gp.currentStatus}`);
      lines.push(`- **Progress Delta:** ${gp.progressDelta > 0 ? '+' : ''}${gp.progressDelta}%`);
      if (gp.milestones.length > 0) {
        lines.push(`- **Milestones:** ${gp.milestones.join(', ')}`);
      }
      if (gp.blockers.length > 0) {
        lines.push(`- **Blockers:** ${gp.blockers.join(', ')}`);
      }
      lines.push('');
    }
  }

  // Highlights
  if (synthesis.highlights.length > 0) {
    lines.push('## Key Highlights', '');
    for (const h of synthesis.highlights) {
      lines.push(`- ${h}`);
    }
    lines.push('');
  }

  // Risks
  if (synthesis.risks.length > 0) {
    lines.push('## Risks & Concerns', '');
    for (const r of synthesis.risks) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  // Recommendations
  if (synthesis.recommendations.length > 0) {
    lines.push('## Recommendations for Next Week', '');
    for (const rec of synthesis.recommendations) {
      lines.push(`### [${rec.priority.toUpperCase()}] ${rec.title}`);
      lines.push('');
      lines.push(`- **Category:** ${rec.category}`);
      lines.push(`- **Effort:** ${rec.effort}`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
    }
  }

  if (synthesis.attestation) {
    lines.push('---', '', '*This report was generated with TEE attestation verification.*', '');
  }

  return lines.join('\n');
}

// ============================================================================
// Import Validation
// ============================================================================

/** Result of validating a single synthesis record */
interface SynthesisValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a single synthesis record has required fields with correct types.
 * Returns a list of errors (empty = valid).
 */
function validateSynthesisRecord(key: string, value: unknown): SynthesisValidationResult {
  const errors: string[] = [];

  if (!value || typeof value !== 'object') {
    return { valid: false, errors: [`[${key}] Not an object`] };
  }

  const rec = value as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ['id', 'weekStart', 'weekEnd', 'executiveSummary', 'generatedAt'] as const;
  for (const field of requiredStrings) {
    if (typeof rec[field] !== 'string' || !(rec[field] as string).trim()) {
      errors.push(`[${key}] Missing or invalid "${field}"`);
    }
  }

  // Validate weekStart format (YYYY-MM-DD)
  if (typeof rec.weekStart === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(rec.weekStart)) {
    errors.push(`[${key}] Invalid weekStart format (expected YYYY-MM-DD)`);
  }

  // Required stats object
  if (!rec.stats || typeof rec.stats !== 'object') {
    errors.push(`[${key}] Missing or invalid "stats" object`);
  } else {
    const stats = rec.stats as Record<string, unknown>;
    const numericFields = [
      'briefingsGenerated', 'meetingsHeld', 'decisionsMade',
      'competitiveEntries', 'actionItemsCompleted', 'actionItemsCreated', 'totalFundingTracked',
    ] as const;
    for (const f of numericFields) {
      if (typeof stats[f] !== 'number') {
        errors.push(`[${key}] stats.${f} must be a number`);
      }
    }
  }

  // Required array fields (can be empty, but must be arrays)
  const requiredArrays = ['trends', 'grantProgress', 'recommendations', 'highlights', 'risks'] as const;
  for (const field of requiredArrays) {
    if (!Array.isArray(rec[field])) {
      errors.push(`[${key}] "${field}" must be an array`);
    }
  }

  // Status must be a valid value
  const validStatuses = ['generating', 'completed', 'failed'];
  if (typeof rec.status !== 'string' || !validStatuses.includes(rec.status)) {
    errors.push(`[${key}] Invalid status (expected generating|completed|failed)`);
  }

  return { valid: errors.length === 0, errors };
}

/** Validation result for an entire import payload */
export interface ImportValidationResult {
  valid: boolean;
  validCount: number;
  invalidCount: number;
  errors: string[];
  /** Only the records that passed validation */
  validSyntheses: Record<string, WeeklySynthesis>;
}

/**
 * Validate an import payload containing synthesis records.
 * Returns both validation results and the subset of valid records.
 */
export function validateSynthesisImport(
  data: unknown
): ImportValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, validCount: 0, invalidCount: 0, errors: ['Import data is not an object'], validSyntheses: {} };
  }

  const payload = data as Record<string, unknown>;
  if (!payload.syntheses || typeof payload.syntheses !== 'object') {
    return { valid: false, validCount: 0, invalidCount: 0, errors: ['Missing "syntheses" object in import data'], validSyntheses: {} };
  }

  const syntheses = payload.syntheses as Record<string, unknown>;
  const validSyntheses: Record<string, WeeklySynthesis> = {};
  let validCount = 0;
  let invalidCount = 0;

  for (const [key, value] of Object.entries(syntheses)) {
    const result = validateSynthesisRecord(key, value);
    if (result.valid) {
      validSyntheses[key] = value as WeeklySynthesis;
      validCount++;
    } else {
      invalidCount++;
      errors.push(...result.errors);
    }
  }

  return {
    valid: invalidCount === 0 && validCount > 0,
    validCount,
    invalidCount,
    errors,
    validSyntheses,
  };
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get Badge variant for trend direction.
 */
export function getTrendDirectionBadgeVariant(
  direction: TrendDirection
): NonNullable<BadgeProps['variant']> {
  switch (direction) {
    case 'positive':
      return 'success';
    case 'negative':
      return 'error';
    case 'neutral':
    default:
      return 'secondary';
  }
}

/**
 * Get text color for recommendation priority.
 */
export function getRecommendationPriorityColor(priority: BriefingPriority): string {
  switch (priority) {
    case 'critical':
      return 'text-error';
    case 'high':
      return 'text-warning';
    case 'medium':
      return 'text-near-cyan-500';
    case 'low':
    default:
      return 'text-text-muted';
  }
}

/**
 * Get Badge variant for recommendation priority.
 */
export function getRecommendationPriorityBadgeVariant(
  priority: BriefingPriority
): NonNullable<BadgeProps['variant']> {
  switch (priority) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'default';
    case 'low':
    default:
      return 'outline';
  }
}

/**
 * Get Badge variant for synthesis status.
 */
export function getSynthesisStatusBadgeVariant(
  status: SynthesisStatus
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'completed':
      return 'success';
    case 'generating':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'secondary';
  }
}

/**
 * Get Badge variant for effort level.
 */
export function getEffortBadgeVariant(
  effort: 'high' | 'medium' | 'low'
): NonNullable<BadgeProps['variant']> {
  switch (effort) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'outline';
    default:
      return 'secondary';
  }
}
