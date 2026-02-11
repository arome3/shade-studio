/**
 * Competitive Analysis Utilities
 *
 * AI-powered competitive intelligence analysis using NEAR AI Cloud.
 * Provides insight generation, summary creation, and theme-correct UI helpers.
 */

import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import type {
  Competitor,
  CompetitiveEntry,
  CompetitiveSummary,
  CompetitiveEntryType,
  ThreatLevel,
} from '@/types/intelligence';
import type { BadgeProps } from '@/components/ui/badge';

// ============================================================================
// JSON Parsing
// ============================================================================

/**
 * Parse JSON from AI response, handling markdown code block wrapping.
 * Reuses the same pattern as briefing.ts parseJsonResponse.
 */
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
// Retry Logic
// ============================================================================

/**
 * Wrap an async function with retry logic.
 * Retries on failure with a fixed delay between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check signal before each attempt
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// ============================================================================
// Project Context
// ============================================================================

export interface ProjectContext {
  projectName?: string;
  projectDescription?: string;
}

function buildProjectContextPrompt(ctx?: ProjectContext): string {
  if (!ctx?.projectName) return '';
  const parts = [`You are analyzing competitive intelligence for ${ctx.projectName}.`];
  if (ctx.projectDescription) {
    parts.push(`Project description: ${ctx.projectDescription}.`);
  }
  parts.push('Provide insights relative to this project\'s positioning.');
  return ' ' + parts.join(' ');
}

// ============================================================================
// AI Analysis Functions
// ============================================================================

/**
 * Analyze a single competitive entry and generate a strategic insight.
 * Returns a 2-3 sentence insight string.
 */
export async function analyzeCompetitiveEntry(
  entry: Omit<CompetitiveEntry, 'id' | 'insight' | 'createdAt'>,
  competitor: Competitor,
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<string> {
  const client = getAIClient();
  const projectPrompt = buildProjectContextPrompt(projectContext);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a competitive intelligence analyst for Web3 projects. Provide concise, actionable strategic insights. Respond with only the insight text, no JSON or formatting.' +
        projectPrompt,
    },
    {
      role: 'user',
      content: `Analyze this competitive event and provide a 2-3 sentence strategic insight:

Competitor: ${competitor.name} (Threat Level: ${competitor.threatLevel}/5)
Description: ${competitor.description}
Categories: ${competitor.categories.join(', ')}

Event Type: ${entry.type}
Title: ${entry.title}
Details: ${entry.description}
${entry.sourceUrl ? `Source: ${entry.sourceUrl}` : ''}
${entry.amount ? `Amount: $${entry.amount.toLocaleString()}` : ''}

What does this mean for our positioning and strategy?`,
    },
  ];

  return withRetry(async () => {
    const { content } = await client.chat(messages, {
      temperature: 0.7,
      ...options,
    });
    return content.trim();
  });
}

/**
 * Generate a competitive landscape summary from recent entries.
 * Uses a 30-day window for trend extraction.
 */
export async function generateCompetitiveSummary(
  competitors: Competitor[],
  entries: CompetitiveEntry[],
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<CompetitiveSummary> {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentEntries = entries.filter((e) => e.createdAt >= thirtyDaysAgo);

  // Sum funding amounts from funding-type entries
  const totalFundingTracked = recentEntries
    .filter((e) => e.type === 'funding')
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  // Extract trends via AI
  const trends = await extractTrends(competitors, recentEntries, options, projectContext);

  return {
    totalCompetitors: competitors.length,
    recentEntries: recentEntries.length,
    totalFundingTracked,
    trends,
    generatedAt: Date.now(),
  };
}

/**
 * Extract competitive trends from recent activity using AI.
 * Returns an array of trend descriptions.
 */
async function extractTrends(
  competitors: Competitor[],
  recentEntries: CompetitiveEntry[],
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<string[]> {
  if (recentEntries.length === 0) {
    return ['No recent competitive activity to analyze.'];
  }

  const client = getAIClient();
  const projectPrompt = buildProjectContextPrompt(projectContext);

  const entryDescriptions = recentEntries
    .slice(0, 20) // Limit context
    .map((e) => {
      const comp = competitors.find((c) => c.id === e.competitorId);
      return `- [${e.type}] ${comp?.name ?? 'Unknown'}: ${e.title}`;
    })
    .join('\n');

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a competitive intelligence analyst. Extract key trends from competitive activity. Respond with a JSON array of 3-5 trend strings. Example: ["Trend 1", "Trend 2"]' +
        projectPrompt,
    },
    {
      role: 'user',
      content: `Analyze the following recent competitive events and identify 3-5 key trends:

Tracked Competitors: ${competitors.map((c) => `${c.name} (threat: ${c.threatLevel}/5)`).join(', ')}

Recent Activity (last 30 days):
${entryDescriptions}

Respond with a JSON array of trend descriptions.`,
    },
  ];

  try {
    return await withRetry(async () => {
      const { content } = await client.chat(messages, {
        temperature: 0.5,
        ...options,
      });

      const parsed = parseJsonFromAI<string[]>(content);
      if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
        return parsed;
      }
      return ['Unable to extract structured trends from activity.'];
    });
  } catch {
    return ['Unable to extract trends at this time.'];
  }
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get text color for a threat level.
 */
export function getThreatLevelColor(level: ThreatLevel): string {
  switch (level) {
    case 5:
      return 'text-error';
    case 4:
      return 'text-warning';
    case 3:
      return 'text-near-cyan-500';
    case 2:
      return 'text-success';
    case 1:
    default:
      return 'text-text-muted';
  }
}

/**
 * Get background color for a threat level.
 */
export function getThreatLevelBgColor(level: ThreatLevel): string {
  switch (level) {
    case 5:
      return 'bg-error/10';
    case 4:
      return 'bg-warning/10';
    case 3:
      return 'bg-near-cyan-500/10';
    case 2:
      return 'bg-success/10';
    case 1:
    default:
      return 'bg-surface';
  }
}

/**
 * Get threat level label text.
 */
export function getThreatLevelLabel(level: ThreatLevel): string {
  switch (level) {
    case 5:
      return 'Critical';
    case 4:
      return 'High';
    case 3:
      return 'Medium';
    case 2:
      return 'Low';
    case 1:
    default:
      return 'Minimal';
  }
}

/**
 * Get lucide icon name for an entry type.
 */
export function getEntryTypeIcon(type: CompetitiveEntryType): string {
  switch (type) {
    case 'funding':
      return 'DollarSign';
    case 'launch':
      return 'Rocket';
    case 'partnership':
      return 'Handshake';
    case 'news':
      return 'Newspaper';
    case 'grant':
      return 'Award';
    default:
      return 'FileText';
  }
}

/**
 * Get Badge variant for an entry type.
 */
export function getEntryTypeBadgeVariant(
  type: CompetitiveEntryType
): NonNullable<BadgeProps['variant']> {
  switch (type) {
    case 'funding':
      return 'success';
    case 'launch':
      return 'default';
    case 'partnership':
      return 'secondary';
    case 'news':
      return 'outline';
    case 'grant':
      return 'warning';
    default:
      return 'secondary';
  }
}
