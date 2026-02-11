/**
 * Meeting Notes Pipeline Utilities
 *
 * AI-powered meeting note processing using NEAR AI Cloud.
 * Provides extraction of action items, decisions, summaries,
 * along with filtering, stats, export, and theme-correct UI helpers.
 */

import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import { withRetry, type ProjectContext } from './competitive';
import type {
  Meeting,
  MeetingFilter,
  MeetingType,
  MeetingProcessingResult,
  ActionItemPriority,
  ActionItemStatus,
} from '@/types/intelligence';
import type { BadgeProps } from '@/components/ui/badge';

// ============================================================================
// Stats Type
// ============================================================================

/** Aggregate statistics for meeting data */
export interface MeetingStats {
  /** Meetings in the last 30 days */
  recentCount: number;
  /** Total action items across all meetings */
  totalActionItems: number;
  /** Pending action items */
  pendingActionItems: number;
  /** Completion rate (0-100) */
  completionRate: number;
}

// ============================================================================
// JSON Parsing (replicates pattern from competitive.ts)
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
  const parts = [`You are processing meeting notes for ${ctx.projectName}.`];
  if (ctx.projectDescription) {
    parts.push(`Project description: ${ctx.projectDescription}.`);
  }
  parts.push('Provide insights relative to this project\'s goals.');
  return ' ' + parts.join(' ');
}

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_PRIORITIES: ActionItemPriority[] = ['high', 'medium', 'low'];

function normalizePriority(value: unknown): ActionItemPriority {
  if (typeof value === 'string') {
    const lower = value.toLowerCase() as ActionItemPriority;
    if (VALID_PRIORITIES.includes(lower)) return lower;
  }
  return 'medium';
}

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => (v as string).trim());
}

// ============================================================================
// AI Processing
// ============================================================================

/**
 * Process raw meeting notes using AI to extract structured data.
 * Returns summary, action items, decisions, and follow-up info.
 */
export async function processMeetingNotes(
  rawNotes: string,
  meetingType: MeetingType,
  attendees: string[],
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<MeetingProcessingResult> {
  const client = getAIClient();
  const projectPrompt = buildProjectContextPrompt(projectContext);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a meeting analyst for Web3 grant teams. Extract structured information from meeting notes. Respond with ONLY a JSON object matching this schema: { "summary": string, "actionItems": [{ "description": string, "assignee": string | null, "dueDate": string | null, "priority": "high" | "medium" | "low" }], "decisions": string[], "followUpNeeded": boolean, "suggestedFollowUpDate": string | null }. Be thorough in identifying action items and decisions. Priority should reflect urgency and impact.' +
        projectPrompt,
    },
    {
      role: 'user',
      content: `Process these ${meetingType} meeting notes and extract structured information:

${attendees.length > 0 ? `Attendees: ${attendees.join(', ')}\n` : ''}
Meeting Notes:
${rawNotes}

Respond with JSON only.`,
    },
  ];

  return withRetry(async () => {
    const { content } = await client.chat(messages, {
      temperature: 0.3,
      ...options,
    });

    const parsed = parseJsonFromAI<Record<string, unknown>>(content);

    // Normalize and validate each field
    const actionItems = Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((item: Record<string, unknown>) => ({
          description: normalizeString(item?.description, 'Action item'),
          assignee: typeof item?.assignee === 'string' && item.assignee.trim()
            ? item.assignee.trim()
            : undefined,
          dueDate: typeof item?.dueDate === 'string' && item.dueDate.trim()
            ? item.dueDate.trim()
            : undefined,
          priority: normalizePriority(item?.priority),
        }))
      : [];

    return {
      summary: normalizeString(parsed.summary, 'Meeting summary unavailable.'),
      actionItems,
      decisions: normalizeStringArray(parsed.decisions),
      followUpNeeded: typeof parsed.followUpNeeded === 'boolean'
        ? parsed.followUpNeeded
        : false,
      suggestedFollowUpDate:
        typeof parsed.suggestedFollowUpDate === 'string' &&
        parsed.suggestedFollowUpDate.trim()
          ? parsed.suggestedFollowUpDate.trim()
          : undefined,
    };
  });
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter meetings by multiple criteria.
 * All active filters must match (AND logic).
 */
export function filterMeetings(
  meetings: Meeting[],
  filter: MeetingFilter
): Meeting[] {
  return meetings.filter((m) => {
    // Type filter
    if (filter.type && m.type !== filter.type) return false;

    // Processing status filter
    if (filter.status && filter.status !== 'all') {
      if (filter.status === 'processed' && !m.isProcessed) return false;
      if (filter.status === 'unprocessed' && m.isProcessed) return false;
    }

    // Date range filter
    if (filter.dateRange) {
      if (filter.dateRange.start && m.date < filter.dateRange.start) return false;
      if (filter.dateRange.end && m.date > filter.dateRange.end) return false;
    }

    // Search query — matches against title, rawNotes, summary, tags, attendees
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const searchable = [
        m.title,
        m.rawNotes,
        m.summary ?? '',
        ...m.tags,
        ...m.attendees,
        ...m.decisions,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    return true;
  });
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Calculate aggregate statistics from meetings.
 */
export function calculateMeetingStats(meetings: Meeting[]): MeetingStats {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentCount = meetings.filter(
    (m) => m.createdAt >= thirtyDaysAgo
  ).length;

  let totalActionItems = 0;
  let completedActionItems = 0;

  for (const meeting of meetings) {
    totalActionItems += meeting.actionItems.length;
    completedActionItems += meeting.actionItems.filter(
      (a) => a.status === 'completed'
    ).length;
  }

  const pendingActionItems = totalActionItems - completedActionItems;
  const completionRate =
    totalActionItems > 0
      ? Math.round((completedActionItems / totalActionItems) * 100)
      : 0;

  return {
    recentCount,
    totalActionItems,
    pendingActionItems,
    completionRate,
  };
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export meetings to a formatted Markdown document.
 */
export function exportMeetingsToMarkdown(meetings: Meeting[]): string {
  const lines: string[] = [
    '# Meeting Notes',
    '',
    `Exported: ${new Date().toISOString().slice(0, 10)}`,
    `Total Meetings: ${meetings.length}`,
    '',
    '---',
    '',
  ];

  for (const m of meetings) {
    lines.push(`## ${m.title}`);
    lines.push('');
    lines.push(`- **Type:** ${getMeetingTypeLabel(m.type)}`);
    lines.push(`- **Date:** ${m.date}`);
    if (m.duration) {
      lines.push(`- **Duration:** ${m.duration} min`);
    }
    if (m.attendees.length > 0) {
      lines.push(`- **Attendees:** ${m.attendees.join(', ')}`);
    }
    if (m.tags.length > 0) {
      lines.push(`- **Tags:** ${m.tags.join(', ')}`);
    }
    lines.push(`- **Processed:** ${m.isProcessed ? 'Yes' : 'No'}`);
    lines.push('');

    if (m.summary) {
      lines.push('### Summary');
      lines.push('');
      lines.push(m.summary);
      lines.push('');
    }

    if (m.actionItems.length > 0) {
      lines.push('### Action Items');
      lines.push('');
      for (const item of m.actionItems) {
        const checkbox = item.status === 'completed' ? '[x]' : '[ ]';
        const assignee = item.assignee ? ` (@${item.assignee})` : '';
        const due = item.dueDate ? ` — due ${item.dueDate}` : '';
        lines.push(`- ${checkbox} [${item.priority.toUpperCase()}] ${item.description}${assignee}${due}`);
      }
      lines.push('');
    }

    if (m.decisions.length > 0) {
      lines.push('### Decisions');
      lines.push('');
      for (const decision of m.decisions) {
        lines.push(`- ${decision}`);
      }
      lines.push('');
    }

    if (m.followUpNeeded) {
      lines.push(`> **Follow-up needed**${m.followUpDate ? ` by ${m.followUpDate}` : ''}`);
      lines.push('');
    }

    lines.push('### Raw Notes');
    lines.push('');
    lines.push(m.rawNotes);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get Badge variant for a meeting type.
 */
export function getMeetingTypeBadgeVariant(
  type: MeetingType
): NonNullable<BadgeProps['variant']> {
  switch (type) {
    case 'team':
      return 'default';
    case 'funder':
      return 'success';
    case 'partner':
      return 'secondary';
    case 'advisor':
      return 'warning';
    case 'community':
      return 'outline';
    case 'other':
    default:
      return 'secondary';
  }
}

/**
 * Get display label for a meeting type.
 */
export function getMeetingTypeLabel(type: MeetingType): string {
  switch (type) {
    case 'team':
      return 'Team';
    case 'funder':
      return 'Funder';
    case 'partner':
      return 'Partner';
    case 'advisor':
      return 'Advisor';
    case 'community':
      return 'Community';
    case 'other':
      return 'Other';
    default:
      return type;
  }
}

/**
 * Get Badge variant for action item priority.
 */
export function getActionPriorityBadgeVariant(
  priority: ActionItemPriority
): NonNullable<BadgeProps['variant']> {
  switch (priority) {
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

/**
 * Get display label for action item priority.
 */
export function getActionPriorityLabel(priority: ActionItemPriority): string {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return priority;
  }
}

/**
 * Get Badge variant for action item status.
 */
export function getActionStatusBadgeVariant(
  status: ActionItemStatus
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'pending':
      return 'outline';
    case 'in_progress':
      return 'warning';
    case 'completed':
      return 'success';
    default:
      return 'secondary';
  }
}

/**
 * Get display label for action item status.
 */
export function getActionStatusLabel(status: ActionItemStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}
