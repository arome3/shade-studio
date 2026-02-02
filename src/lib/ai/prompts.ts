/**
 * System Prompts for AI Personas
 *
 * Defines specialized system prompts for different AI assistant roles
 * in the grant writing process. Each persona has specific expertise
 * and communication style.
 */

import type { SystemPromptType, PromptSuggestion } from '@/types/ai';

/** Project context for prompt customization */
export interface ProjectContext {
  projectName?: string;
  projectDescription?: string;
  grantProgram?: string;
  teamSize?: number;
  deadline?: string;
}

/** Document context for AI */
export interface DocumentContext {
  title?: string;
  content?: string;
  type?: string;
}

/** System prompts for each persona */
export const SYSTEM_PROMPTS: Record<SystemPromptType, string> = {
  grantWriter: `You are an expert grant writer assistant helping users craft compelling grant proposals. You are running in a Trusted Execution Environment (TEE) to ensure user privacy.

Your expertise includes:
- Writing persuasive narratives that highlight project impact
- Structuring proposals according to grant program requirements
- Translating technical concepts for diverse audiences
- Crafting clear budget justifications
- Meeting word limits while maximizing content value

Guidelines:
- Be concise but compelling
- Use active voice and strong verbs
- Quantify impact whenever possible
- Structure content with clear headers and bullet points
- Tailor language to the specific grant program
- Always maintain confidentiality of user data

When given context about a project, incorporate it naturally into your responses.`,

  documentReviewer: `You are a meticulous document reviewer specializing in grant proposals. You are running in a Trusted Execution Environment (TEE) to ensure user privacy.

Your expertise includes:
- Identifying gaps in proposal arguments
- Checking alignment with grant requirements
- Improving clarity and readability
- Ensuring consistency across sections
- Verifying budget-narrative alignment

Review approach:
- Start with overall impressions
- Provide specific, actionable feedback
- Prioritize issues by importance
- Suggest concrete improvements
- Be constructive and encouraging
- Reference specific sections when giving feedback

Format your reviews with clear categories: Strengths, Areas for Improvement, and Specific Recommendations.`,

  technicalWriter: `You are a technical writing specialist helping users document complex projects clearly. You are running in a Trusted Execution Environment (TEE) to ensure user privacy.

Your expertise includes:
- Explaining technical concepts to non-technical audiences
- Creating clear system architecture descriptions
- Writing methodology sections
- Documenting technical milestones
- Creating technical diagrams (in text/ASCII format)

Writing guidelines:
- Use plain language without sacrificing accuracy
- Define technical terms on first use
- Structure content logically with progressive complexity
- Include examples to illustrate concepts
- Use diagrams and visual aids where helpful

Always adapt technical depth to the intended audience.`,

  dailyBriefing: `You are an intelligence analyst providing daily briefings on grant opportunities and deadlines. You are running in a Trusted Execution Environment (TEE) to ensure user privacy.

Your role includes:
- Summarizing relevant grant opportunities
- Highlighting approaching deadlines
- Tracking project milestone status
- Identifying potential funding matches
- Providing strategic recommendations

Briefing format:
- Start with urgent items requiring immediate attention
- Summarize key opportunities with relevance scores
- Note upcoming deadlines with time remaining
- Provide 2-3 actionable recommendations
- Keep briefings concise and scannable

Use bullet points, bold for emphasis, and clear section headers.`,

  competitiveAnalysis: `You are a competitive analysis specialist for grant applications. You are running in a Trusted Execution Environment (TEE) to ensure user privacy.

Your expertise includes:
- Analyzing grant program priorities
- Identifying competitive advantages
- Understanding reviewer perspectives
- Benchmarking against successful proposals
- Strategic positioning recommendations

Analysis approach:
- Identify key evaluation criteria
- Assess project alignment with funder priorities
- Highlight unique differentiators
- Suggest strategic improvements
- Provide competitive positioning advice

Be specific about how to stand out while maintaining authenticity.`,
};

/**
 * Get system prompt for a persona
 */
export function getSystemPrompt(persona: SystemPromptType): string {
  return SYSTEM_PROMPTS[persona] || SYSTEM_PROMPTS.grantWriter;
}

/**
 * Create a contextualized system prompt
 *
 * Injects project and document context into the base system prompt
 * for more relevant AI responses.
 */
export function createContextualPrompt(
  persona: SystemPromptType,
  projectContext?: ProjectContext,
  documentContext?: DocumentContext
): string {
  let prompt = getSystemPrompt(persona);

  // Add project context if available
  if (projectContext) {
    const contextParts: string[] = [];

    if (projectContext.projectName) {
      contextParts.push(`Project: ${projectContext.projectName}`);
    }
    if (projectContext.projectDescription) {
      contextParts.push(`Description: ${projectContext.projectDescription}`);
    }
    if (projectContext.grantProgram) {
      contextParts.push(`Target Grant Program: ${projectContext.grantProgram}`);
    }
    if (projectContext.deadline) {
      contextParts.push(`Deadline: ${projectContext.deadline}`);
    }
    if (projectContext.teamSize) {
      contextParts.push(`Team Size: ${projectContext.teamSize} members`);
    }

    if (contextParts.length > 0) {
      prompt += `\n\n## Current Project Context\n${contextParts.join('\n')}`;
    }
  }

  // Add document context if available
  if (documentContext) {
    const docParts: string[] = [];

    if (documentContext.title) {
      docParts.push(`Document: ${documentContext.title}`);
    }
    if (documentContext.type) {
      docParts.push(`Type: ${documentContext.type}`);
    }

    if (docParts.length > 0) {
      prompt += `\n\n## Active Document\n${docParts.join('\n')}`;
    }

    // Include document content if provided (truncate if too long)
    if (documentContext.content) {
      const maxContentLength = 4000;
      const content = documentContext.content.length > maxContentLength
        ? documentContext.content.slice(0, maxContentLength) + '\n...[content truncated]'
        : documentContext.content;

      prompt += `\n\nDocument Content:\n\`\`\`\n${content}\n\`\`\``;
    }
  }

  return prompt;
}

/** Quick action prompt suggestions organized by category */
export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  // Writing assistance
  {
    id: 'write-executive-summary',
    label: 'Write Executive Summary',
    prompt: 'Help me write a compelling executive summary for my grant proposal. Focus on the problem, solution, impact, and team qualifications.',
    icon: 'FileText',
    category: 'writing',
  },
  {
    id: 'improve-impact-statement',
    label: 'Improve Impact Statement',
    prompt: 'Review and improve the impact statement in my proposal. Make it more compelling with specific metrics and outcomes.',
    icon: 'TrendingUp',
    category: 'writing',
  },
  {
    id: 'write-budget-justification',
    label: 'Budget Justification',
    prompt: 'Help me write a clear and compelling budget justification that explains how funds will be used effectively.',
    icon: 'DollarSign',
    category: 'writing',
  },
  {
    id: 'simplify-technical',
    label: 'Simplify Technical Language',
    prompt: 'Simplify the technical language in my proposal to make it accessible to non-technical reviewers while maintaining accuracy.',
    icon: 'Sparkles',
    category: 'writing',
  },

  // Analysis
  {
    id: 'review-proposal',
    label: 'Review My Proposal',
    prompt: 'Review my proposal and provide detailed feedback on strengths, weaknesses, and specific improvements I should make.',
    icon: 'Search',
    category: 'analysis',
  },
  {
    id: 'check-alignment',
    label: 'Check Grant Alignment',
    prompt: 'Analyze how well my proposal aligns with the grant program requirements. Identify gaps and suggest improvements.',
    icon: 'Target',
    category: 'analysis',
  },
  {
    id: 'competitive-position',
    label: 'Competitive Analysis',
    prompt: 'Analyze my competitive position for this grant. What makes my proposal stand out? What weaknesses should I address?',
    icon: 'BarChart3',
    category: 'analysis',
  },

  // Research
  {
    id: 'milestone-planning',
    label: 'Plan Milestones',
    prompt: 'Help me create realistic milestones for my project. Consider dependencies, resources, and measurable deliverables.',
    icon: 'Flag',
    category: 'research',
  },
  {
    id: 'risk-assessment',
    label: 'Risk Assessment',
    prompt: 'Identify potential risks in my project plan and suggest mitigation strategies for each risk.',
    icon: 'AlertTriangle',
    category: 'research',
  },

  // General
  {
    id: 'brainstorm-ideas',
    label: 'Brainstorm Ideas',
    prompt: 'Help me brainstorm ideas for improving my grant proposal. What innovative approaches could strengthen my application?',
    icon: 'Lightbulb',
    category: 'general',
  },
  {
    id: 'ask-question',
    label: 'Ask a Question',
    prompt: '',
    icon: 'HelpCircle',
    category: 'general',
  },
];

/**
 * Get prompt suggestions filtered by category
 */
export function getPromptSuggestionsByCategory(
  category?: PromptSuggestion['category']
): PromptSuggestion[] {
  if (!category) return PROMPT_SUGGESTIONS;
  return PROMPT_SUGGESTIONS.filter((s) => s.category === category);
}

/**
 * Get persona display name
 */
export function getPersonaDisplayName(persona: SystemPromptType): string {
  const names: Record<SystemPromptType, string> = {
    grantWriter: 'Grant Writer',
    documentReviewer: 'Document Reviewer',
    technicalWriter: 'Technical Writer',
    dailyBriefing: 'Intelligence Analyst',
    competitiveAnalysis: 'Competitive Analyst',
  };
  return names[persona] || 'AI Assistant';
}

/**
 * Get persona description
 */
export function getPersonaDescription(persona: SystemPromptType): string {
  const descriptions: Record<SystemPromptType, string> = {
    grantWriter: 'Expert in crafting compelling grant proposals',
    documentReviewer: 'Provides detailed feedback on proposal quality',
    technicalWriter: 'Specializes in clear technical documentation',
    dailyBriefing: 'Delivers intelligence on opportunities and deadlines',
    competitiveAnalysis: 'Analyzes competitive positioning for grants',
  };
  return descriptions[persona] || 'General-purpose AI assistant';
}
