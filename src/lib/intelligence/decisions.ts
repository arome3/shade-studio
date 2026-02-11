/**
 * Decision Journal Utilities
 *
 * AI-powered decision analysis using NEAR AI Cloud.
 * Provides strategic analysis, filtering, export, and theme-correct UI helpers.
 */

import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import { withRetry, type ProjectContext } from './competitive';
import type {
  Decision,
  DecisionFilter,
  DecisionCategory,
  DecisionStatus,
  DecisionOutcome,
} from '@/types/intelligence';
import type { BadgeProps } from '@/components/ui/badge';

// ============================================================================
// Project Context
// ============================================================================

function buildProjectContextPrompt(ctx?: ProjectContext): string {
  if (!ctx?.projectName) return '';
  const parts = [`You are analyzing strategic decisions for ${ctx.projectName}.`];
  if (ctx.projectDescription) {
    parts.push(`Project description: ${ctx.projectDescription}.`);
  }
  parts.push('Provide insights relative to this project\'s goals and positioning.');
  return ' ' + parts.join(' ');
}

// ============================================================================
// AI Analysis
// ============================================================================

/**
 * Analyze a decision and generate strategic insights using AI.
 * Returns a multi-paragraph analysis string.
 */
export async function analyzeDecision(
  decision: Decision,
  options: ChatOptions = {},
  projectContext?: ProjectContext
): Promise<string> {
  const client = getAIClient();
  const projectPrompt = buildProjectContextPrompt(projectContext);

  const alternativesText = decision.alternatives.length > 0
    ? `\nAlternatives considered:\n${decision.alternatives
        .map((a) => `- ${a.title}: ${a.description}${a.whyNotChosen ? ` (Not chosen because: ${a.whyNotChosen})` : ''}`)
        .join('\n')}`
    : '';

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a strategic advisor for Web3 projects. Analyze decisions and provide concise, actionable strategic insights. Cover risk assessment, potential impact, and recommendations for follow-up. Respond with plain text analysis, no JSON or markdown formatting.' +
        projectPrompt,
    },
    {
      role: 'user',
      content: `Analyze this strategic decision:

Title: ${decision.title}
Category: ${decision.category}
Status: ${decision.status}
Outcome: ${decision.outcome}

Context: ${decision.context}
Rationale: ${decision.rationale}
Expected Impact: ${decision.expectedImpact}
${decision.actualImpact ? `Actual Impact: ${decision.actualImpact}` : ''}
${alternativesText}
${decision.tags.length > 0 ? `Tags: ${decision.tags.join(', ')}` : ''}

Provide a 2-4 sentence strategic analysis covering risks, impact assessment, and any recommendations.`,
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

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter decisions by multiple criteria.
 * All active filters must match (AND logic).
 */
export function filterDecisions(
  decisions: Decision[],
  filter: DecisionFilter
): Decision[] {
  return decisions.filter((d) => {
    // Category filter
    if (filter.category && d.category !== filter.category) return false;

    // Status filter
    if (filter.status && d.status !== filter.status) return false;

    // Outcome filter
    if (filter.outcome && d.outcome !== filter.outcome) return false;

    // Date range filter
    if (filter.dateRange) {
      const decisionDate = d.decisionDate;
      if (filter.dateRange.start && decisionDate < filter.dateRange.start) return false;
      if (filter.dateRange.end && decisionDate > filter.dateRange.end) return false;
    }

    // Search query — matches against title, description, context, tags
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const searchable = [
        d.title,
        d.description,
        d.context,
        ...d.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    return true;
  });
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export decisions to a formatted Markdown document.
 */
export function exportDecisionsToMarkdown(decisions: Decision[]): string {
  const lines: string[] = [
    '# Decision Journal',
    '',
    `Exported: ${new Date().toISOString().slice(0, 10)}`,
    `Total Decisions: ${decisions.length}`,
    '',
    '---',
    '',
  ];

  for (const d of decisions) {
    lines.push(`## ${d.title}`);
    lines.push('');
    lines.push(`- **Category:** ${getCategoryLabel(d.category)}`);
    lines.push(`- **Status:** ${d.status}`);
    lines.push(`- **Outcome:** ${getOutcomeLabel(d.outcome)}`);
    lines.push(`- **Date:** ${d.decisionDate}`);
    if (d.reviewDate) {
      lines.push(`- **Review Date:** ${d.reviewDate}`);
    }
    if (d.decisionMakers.length > 0) {
      lines.push(`- **Decision Makers:** ${d.decisionMakers.join(', ')}`);
    }
    if (d.tags.length > 0) {
      lines.push(`- **Tags:** ${d.tags.join(', ')}`);
    }
    lines.push('');

    lines.push('### Context');
    lines.push('');
    lines.push(d.context);
    lines.push('');

    lines.push('### Description');
    lines.push('');
    lines.push(d.description);
    lines.push('');

    lines.push('### Rationale');
    lines.push('');
    lines.push(d.rationale);
    lines.push('');

    if (d.expectedImpact) {
      lines.push('### Expected Impact');
      lines.push('');
      lines.push(d.expectedImpact);
      lines.push('');
    }

    if (d.actualImpact) {
      lines.push('### Actual Impact');
      lines.push('');
      lines.push(d.actualImpact);
      lines.push('');
    }

    if (d.alternatives.length > 0) {
      lines.push('### Alternatives Considered');
      lines.push('');
      for (const alt of d.alternatives) {
        lines.push(`#### ${alt.title}`);
        lines.push('');
        lines.push(alt.description);
        if (alt.pros.length > 0) {
          lines.push('');
          lines.push('**Pros:**');
          for (const pro of alt.pros) {
            lines.push(`- ${pro}`);
          }
        }
        if (alt.cons.length > 0) {
          lines.push('');
          lines.push('**Cons:**');
          for (const con of alt.cons) {
            lines.push(`- ${con}`);
          }
        }
        if (alt.whyNotChosen) {
          lines.push('');
          lines.push(`**Why not chosen:** ${alt.whyNotChosen}`);
        }
        lines.push('');
      }
    }

    if (d.aiAnalysis) {
      lines.push('### AI Analysis');
      lines.push('');
      lines.push(d.aiAnalysis);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get Badge variant for a decision category.
 */
export function getCategoryBadgeVariant(
  category: DecisionCategory
): NonNullable<BadgeProps['variant']> {
  switch (category) {
    case 'strategic':
      return 'default';
    case 'technical':
      return 'secondary';
    case 'financial':
      return 'success';
    case 'team':
      return 'warning';
    case 'partnership':
      return 'outline';
    case 'product':
      return 'default';
    case 'marketing':
      return 'error';
    default:
      return 'secondary';
  }
}

/**
 * Get Badge variant for a decision status.
 */
export function getStatusBadgeVariant(
  status: DecisionStatus
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'proposed':
      return 'outline';
    case 'approved':
      return 'success';
    case 'implemented':
      return 'default';
    case 'revisited':
      return 'warning';
    case 'reversed':
      return 'error';
    default:
      return 'secondary';
  }
}

/**
 * Get Badge variant for a decision outcome.
 */
export function getOutcomeBadgeVariant(
  outcome: DecisionOutcome
): NonNullable<BadgeProps['variant']> {
  switch (outcome) {
    case 'pending':
      return 'outline';
    case 'successful':
      return 'success';
    case 'partially_successful':
      return 'warning';
    case 'unsuccessful':
      return 'error';
    case 'inconclusive':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Get text color class for a decision outcome.
 */
export function getOutcomeColor(outcome: DecisionOutcome): string {
  switch (outcome) {
    case 'successful':
      return 'text-success';
    case 'partially_successful':
      return 'text-warning';
    case 'unsuccessful':
      return 'text-error';
    case 'inconclusive':
      return 'text-near-cyan-500';
    case 'pending':
    default:
      return 'text-text-muted';
  }
}

/**
 * Get background color class for a decision outcome.
 */
export function getOutcomeBgColor(outcome: DecisionOutcome): string {
  switch (outcome) {
    case 'successful':
      return 'bg-success';
    case 'partially_successful':
      return 'bg-warning';
    case 'unsuccessful':
      return 'bg-error';
    case 'inconclusive':
      return 'bg-near-cyan-500';
    case 'pending':
    default:
      return 'bg-text-muted';
  }
}

/**
 * Get display label for a decision category.
 */
export function getCategoryLabel(category: DecisionCategory): string {
  switch (category) {
    case 'strategic':
      return 'Strategic';
    case 'technical':
      return 'Technical';
    case 'financial':
      return 'Financial';
    case 'team':
      return 'Team';
    case 'partnership':
      return 'Partnership';
    case 'product':
      return 'Product';
    case 'marketing':
      return 'Marketing';
    default:
      return category;
  }
}

/**
 * Get display label for a decision outcome.
 */
export function getOutcomeLabel(outcome: DecisionOutcome): string {
  switch (outcome) {
    case 'pending':
      return 'Pending';
    case 'successful':
      return 'Successful';
    case 'partially_successful':
      return 'Partially Successful';
    case 'unsuccessful':
      return 'Unsuccessful';
    case 'inconclusive':
      return 'Inconclusive';
    default:
      return outcome;
  }
}

/**
 * Get display label for a decision status.
 */
export function getStatusLabel(status: DecisionStatus): string {
  switch (status) {
    case 'proposed':
      return 'Proposed';
    case 'approved':
      return 'Approved';
    case 'implemented':
      return 'Implemented';
    case 'revisited':
      return 'Revisited';
    case 'reversed':
      return 'Reversed';
    default:
      return status;
  }
}
