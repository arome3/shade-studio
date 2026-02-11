/**
 * Proposal AI Prompts
 *
 * Direct AI client calls for section-level writing assistance.
 * Uses getAIClient().chat() with withRetry() following the established
 * pattern from competitive.ts and decisions.ts.
 */

import { getAIClient, type ChatOptions } from '@/lib/ai/client';
import { SYSTEM_PROMPTS } from '@/lib/ai/prompts';
import { withRetry } from '@/lib/intelligence/competitive';
import type { ProposalSection } from '@/types/proposal';

// ============================================================================
// Helpers
// ============================================================================

function stripMarkdownCodeBlocks(text: string): string {
  return text
    .replace(/^```(?:json|markdown|md)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();
}

function buildSectionContext(section: ProposalSection, proposalTitle: string): string {
  return [
    `Proposal: "${proposalTitle}"`,
    `Section: "${section.title}"`,
    `Description: ${section.description}`,
    section.wordLimit ? `Word limit: ${section.wordLimit} words` : '',
    section.required ? 'This section is required.' : 'This section is optional.',
    section.content.trim() ? `\nCurrent content:\n${section.content}` : '\nNo content yet.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ============================================================================
// AI Functions
// ============================================================================

/**
 * Improve existing section content.
 * Returns improved text preserving the author's voice.
 */
export async function improveSection(
  section: ProposalSection,
  proposalTitle: string,
  options: ChatOptions = {}
): Promise<string> {
  if (!section.content.trim()) {
    throw new Error('Section has no content to improve');
  }

  const context = buildSectionContext(section, proposalTitle);

  return withRetry(async () => {
    const { content } = await getAIClient().chat(
      [
        { role: 'system', content: SYSTEM_PROMPTS.grantWriter },
        {
          role: 'user',
          content: `Improve the following proposal section. Make it more compelling, clear, and professional while preserving the author's voice and key points.${section.wordLimit ? ` Stay within ${section.wordLimit} words.` : ''}\n\n${context}\n\nReturn only the improved text, no explanations.`,
        },
      ],
      { ...options, temperature: 0.7 }
    );
    return stripMarkdownCodeBlocks(content);
  }, 3, 1000, options.abortController?.signal);
}

/**
 * Generate content for an empty or sparse section.
 * Returns draft text based on the section description and proposal context.
 */
export async function generateSectionContent(
  section: ProposalSection,
  proposalTitle: string,
  allSections: ProposalSection[],
  options: ChatOptions = {}
): Promise<string> {
  const context = buildSectionContext(section, proposalTitle);

  // Include content from other sections for coherence
  const otherContent = allSections
    .filter((s) => s.id !== section.id && s.content.trim())
    .map((s) => `### ${s.title}\n${s.content.trim().slice(0, 300)}...`)
    .join('\n\n');

  const contextWithOthers = otherContent
    ? `${context}\n\n## Other sections for context:\n${otherContent}`
    : context;

  return withRetry(async () => {
    const { content } = await getAIClient().chat(
      [
        { role: 'system', content: SYSTEM_PROMPTS.grantWriter },
        {
          role: 'user',
          content: `Write compelling content for this proposal section.${section.wordLimit ? ` Target around ${Math.round(section.wordLimit * 0.8)} words (limit: ${section.wordLimit}).` : ''}\n\n${contextWithOthers}\n\nReturn only the section content, no explanations or headers.`,
        },
      ],
      { ...options, temperature: 0.7 }
    );
    return stripMarkdownCodeBlocks(content);
  }, 3, 1000, options.abortController?.signal);
}

/**
 * Review a single section and provide feedback.
 * Returns structured review comments.
 */
export async function reviewSection(
  section: ProposalSection,
  proposalTitle: string,
  options: ChatOptions = {}
): Promise<string> {
  if (!section.content.trim()) {
    throw new Error('Section has no content to review');
  }

  const context = buildSectionContext(section, proposalTitle);

  return withRetry(async () => {
    const { content } = await getAIClient().chat(
      [
        { role: 'system', content: SYSTEM_PROMPTS.documentReviewer },
        {
          role: 'user',
          content: `Review this proposal section and provide actionable feedback.\n\n${context}\n\nProvide:\n1. Strengths (2-3 points)\n2. Areas for improvement (2-3 specific suggestions)\n3. Overall assessment (1 sentence)`,
        },
      ],
      { ...options, temperature: 0.5 }
    );
    return content;
  }, 3, 1000, options.abortController?.signal);
}

/**
 * Review the full proposal across all sections.
 * Returns a comprehensive review with cross-section analysis.
 */
export async function reviewFullProposal(
  sections: ProposalSection[],
  proposalTitle: string,
  options: ChatOptions = {}
): Promise<string> {
  const sectionContent = sections
    .map((s) => `## ${s.title}${s.required ? ' (Required)' : ''}\n${s.content.trim() || '*Empty*'}`)
    .join('\n\n');

  return withRetry(async () => {
    const { content } = await getAIClient().chat(
      [
        { role: 'system', content: SYSTEM_PROMPTS.documentReviewer },
        {
          role: 'user',
          content: `Review this complete grant proposal "${proposalTitle}" and provide comprehensive feedback.\n\n${sectionContent}\n\nProvide:\n1. Overall strength assessment\n2. Narrative coherence across sections\n3. Top 3 areas for improvement\n4. Missing elements or gaps\n5. Readiness score (1-10) with justification`,
        },
      ],
      { ...options, temperature: 0.5, maxTokens: 2000 }
    );
    return content;
  }, 3, 1000, options.abortController?.signal);
}

/**
 * Execute a custom AI prompt for a section.
 * User provides their own instruction.
 */
export async function customSectionPrompt(
  section: ProposalSection,
  proposalTitle: string,
  userPrompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const context = buildSectionContext(section, proposalTitle);

  return withRetry(async () => {
    const { content } = await getAIClient().chat(
      [
        { role: 'system', content: SYSTEM_PROMPTS.grantWriter },
        {
          role: 'user',
          content: `Context:\n${context}\n\nUser request: ${userPrompt}`,
        },
      ],
      { ...options, temperature: 0.7 }
    );
    return content;
  }, 3, 1000, options.abortController?.signal);
}
