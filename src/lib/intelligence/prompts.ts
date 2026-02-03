/**
 * Briefing Prompts
 *
 * Specialized prompts for generating daily intelligence briefings.
 * Designed for structured JSON output from NEAR AI Cloud.
 */

import { format, differenceInDays, parseISO } from 'date-fns';
import type { ContextDocument } from '@/lib/ai/context';
import type { TrackedDeadline } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Project data for briefing context */
export interface BriefingProjectContext {
  id: string;
  name: string;
  description?: string;
  grantProgram?: string;
  fundingAmount?: number;
  status?: string;
  deadline?: string;
}

/** Deadline data for briefing context */
export interface BriefingDeadlineContext {
  id: string;
  title: string;
  date: string;
  projectName?: string;
  isCompleted: boolean;
}

// ============================================================================
// System Prompt
// ============================================================================

/**
 * System prompt for generating daily briefings.
 * Instructs the AI to output structured JSON.
 */
export const BRIEFING_SYSTEM_PROMPT = `You are a strategic intelligence analyst generating daily briefings for a Web3 grant writer.
You are running in a Trusted Execution Environment (TEE) ensuring complete privacy of user data.

Your task is to analyze the user's projects, documents, and deadlines to generate a personalized daily briefing.

OUTPUT FORMAT:
You MUST respond with valid JSON only. No markdown, no explanations, just pure JSON.

The JSON must have this exact structure:
{
  "greeting": "Good [morning/afternoon/evening], [first_name or 'there']! Here's your briefing for [day].",
  "summary": "2-3 sentence executive summary of the most important items today.",
  "sentiment": "bullish" | "neutral" | "bearish",
  "priorityItems": [
    {
      "title": "Brief actionable title",
      "description": "What needs to be done and why",
      "priority": "critical" | "high" | "medium" | "low",
      "type": "deadline" | "opportunity" | "action-required" | "milestone" | "update",
      "dueDate": "YYYY-MM-DD" (optional)
    }
  ],
  "grantPipeline": [
    {
      "program": "Grant program name",
      "status": "researching" | "drafting" | "review" | "submitted" | "approved" | "rejected",
      "deadline": "YYYY-MM-DD" (optional),
      "nextAction": "What to do next",
      "progress": 0-100
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "What to do",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "rationale": "Why this matters"
    }
  ],
  "metrics": {
    "activeProjects": number,
    "pendingProposals": number,
    "upcomingDeadlines": number,
    "actionRequired": number,
    "totalFundingRequested": number,
    "totalFundingReceived": number
  }
}

GUIDELINES:
- Deadlines within 3 days are CRITICAL priority
- Deadlines within 7 days are HIGH priority
- Limit priorityItems to 5 items max, sorted by urgency
- Limit grantPipeline to 5 items max
- Limit recommendations to 3 items max
- Be specific and actionable - avoid vague suggestions
- Reference document names when relevant
- For sentiment: "bullish" = things are going well, "bearish" = needs attention, "neutral" = steady progress
- Use active voice and concise language
- If no data is provided, generate a helpful default briefing with general recommendations`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get time of day for greeting.
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Calculate days until a date.
 * Returns negative if date is in the past.
 */
export function getDaysUntil(date: string | Date): number {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(targetDate, new Date());
}

/**
 * Format a deadline for the prompt.
 */
function formatDeadline(deadline: BriefingDeadlineContext): string {
  const daysUntil = getDaysUntil(deadline.date);
  const dateStr = format(parseISO(deadline.date), 'MMM d, yyyy');
  const urgency = daysUntil <= 3 ? '⚠️ URGENT' : daysUntil <= 7 ? '⏰ Soon' : '';

  return `- ${deadline.title}${deadline.projectName ? ` (${deadline.projectName})` : ''}: ${dateStr} (${daysUntil} days) ${urgency}${deadline.isCompleted ? ' ✓ COMPLETED' : ''}`;
}

/**
 * Format a document for the prompt.
 */
function formatDocument(doc: ContextDocument): string {
  const preview = doc.content.slice(0, 500).trim();
  const truncated = doc.content.length > 500 ? '...' : '';
  return `### ${doc.title}
Type: ${doc.type}
${doc.updatedAt ? `Updated: ${format(parseISO(doc.updatedAt), 'MMM d, yyyy')}` : ''}

${preview}${truncated}`;
}

/**
 * Format a project for the prompt.
 */
function formatProject(project: BriefingProjectContext): string {
  const parts = [`- ${project.name}`];

  if (project.grantProgram) {
    parts.push(`Grant: ${project.grantProgram}`);
  }
  if (project.fundingAmount) {
    parts.push(`Amount: $${project.fundingAmount.toLocaleString()}`);
  }
  if (project.status) {
    parts.push(`Status: ${project.status}`);
  }
  if (project.deadline) {
    const daysUntil = getDaysUntil(project.deadline);
    parts.push(`Deadline: ${format(parseISO(project.deadline), 'MMM d')} (${daysUntil}d)`);
  }

  return parts.join(' | ');
}

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build the user prompt for briefing generation.
 * Assembles context from documents, deadlines, and projects.
 */
export function buildBriefingUserPrompt(
  documents: ContextDocument[],
  deadlines: BriefingDeadlineContext[],
  projects: BriefingProjectContext[],
  date: Date = new Date(),
  accountId?: string
): string {
  const parts: string[] = [];
  const timeOfDay = getTimeOfDay();
  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');

  // Header
  parts.push(`Generate a daily briefing for ${formattedDate}.`);
  parts.push(`Time of day: ${timeOfDay}`);
  if (accountId) {
    parts.push(`User: ${accountId}`);
  }

  // Projects section
  if (projects.length > 0) {
    parts.push('');
    parts.push('## ACTIVE PROJECTS');
    parts.push(projects.map(formatProject).join('\n'));
  }

  // Deadlines section
  if (deadlines.length > 0) {
    const upcoming = deadlines
      .filter((d) => !d.isCompleted)
      .sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date))
      .slice(0, 10);

    if (upcoming.length > 0) {
      parts.push('');
      parts.push('## UPCOMING DEADLINES');
      parts.push(upcoming.map(formatDeadline).join('\n'));
    }
  }

  // Documents section
  if (documents.length > 0) {
    parts.push('');
    parts.push('## RELEVANT DOCUMENTS');
    parts.push(documents.slice(0, 5).map(formatDocument).join('\n\n---\n\n'));
  }

  // If no data provided
  if (projects.length === 0 && deadlines.length === 0 && documents.length === 0) {
    parts.push('');
    parts.push('No projects, deadlines, or documents are currently tracked.');
    parts.push('Generate a helpful onboarding briefing with recommendations for getting started with grant writing.');
  }

  parts.push('');
  parts.push('Based on the above information, generate the daily briefing JSON.');

  return parts.join('\n');
}

/**
 * Convert TrackedDeadline to BriefingDeadlineContext.
 */
export function toDeadlineContext(
  deadline: TrackedDeadline,
  projectName?: string
): BriefingDeadlineContext {
  return {
    id: deadline.id,
    title: deadline.title,
    date: deadline.date,
    projectName,
    isCompleted: deadline.isCompleted,
  };
}

/**
 * Default empty briefing prompt for when no context is available.
 */
export const DEFAULT_BRIEFING_PROMPT = `Generate a welcoming daily briefing for a new grant writer.
Focus on:
- Encouraging them to add their first project
- Suggesting they upload proposal documents for AI assistance
- Recommending they set up deadline tracking
- Providing general grant writing tips

Use placeholder metrics (all zeros) and provide helpful onboarding recommendations.`;
