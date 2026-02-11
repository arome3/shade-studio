/**
 * Proposal Templates
 *
 * Pre-defined templates for grant programs. Each template defines
 * the sections required for that program, with optional content
 * field mappings back to ProposalContent.
 */

import { nanoid } from 'nanoid';
import type {
  GrantProgram,
  Proposal,
  ProposalContent,
  ProposalSection,
  ProposalTemplate,
  ProposalWorkflow,
} from '@/types/proposal';

// ============================================================================
// Template Definitions
// ============================================================================

export const POTLOCK_TEMPLATE: ProposalTemplate = {
  id: 'potlock-standard',
  grantProgram: 'potlock',
  name: 'PotLock Grant',
  description: 'Standard template for PotLock / NEAR ecosystem grants',
  amountRange: { min: 5000, max: 50000 },
  applicationUrl: 'https://app.potlock.org',
  sections: [
    {
      id: 'project-overview',
      title: 'Project Overview',
      description: 'A concise summary of your project, its goals, and expected impact on the NEAR ecosystem.',
      required: true,
      wordLimit: 500,
      contentFieldKey: 'summary',
    },
    {
      id: 'problem-statement',
      title: 'Problem Statement',
      description: 'What problem does your project solve? Why is it important for the NEAR ecosystem?',
      required: true,
      wordLimit: 400,
      contentFieldKey: 'problem',
    },
    {
      id: 'solution',
      title: 'Proposed Solution',
      description: 'Describe your solution and how it addresses the problem. Include key features and user benefits.',
      required: true,
      wordLimit: 600,
      contentFieldKey: 'solution',
    },
    {
      id: 'technical-approach',
      title: 'Technical Approach',
      description: 'Outline your technical architecture, stack, and implementation strategy.',
      required: true,
      wordLimit: 800,
      contentFieldKey: 'technicalApproach',
    },
    {
      id: 'near-integration',
      title: 'NEAR Integration',
      description: 'How does your project leverage NEAR Protocol? Detail smart contracts, SDKs, or ecosystem tools used.',
      required: true,
      wordLimit: 500,
      contentFieldKey: 'competition',
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Introduce your team members, their roles, and relevant experience.',
      required: true,
      wordLimit: 600,
    },
    {
      id: 'roadmap',
      title: 'Roadmap & Milestones',
      description: 'Define your project timeline with clear milestones and deliverables.',
      required: true,
      wordLimit: 600,
      contentFieldKey: 'goToMarket',
    },
    {
      id: 'budget',
      title: 'Budget Breakdown',
      description: 'Provide a detailed budget with categories, amounts, and justifications.',
      required: true,
      wordLimit: 500,
    },
    {
      id: 'success-metrics',
      title: 'Success Metrics',
      description: 'Define measurable KPIs and success criteria for your project.',
      required: true,
      wordLimit: 400,
      contentFieldKey: 'marketAnalysis',
    },
    {
      id: 'risks',
      title: 'Risks & Mitigation',
      description: 'Identify key risks and your strategies to mitigate them.',
      required: false,
      wordLimit: 400,
      contentFieldKey: 'risks',
    },
    {
      id: 'previous-work',
      title: 'Previous Work',
      description: 'Describe relevant past projects, contributions, or experience that supports your ability to deliver.',
      required: false,
      wordLimit: 400,
      contentFieldKey: 'additionalNotes',
    },
  ],
};

export const CUSTOM_TEMPLATE: ProposalTemplate = {
  id: 'custom-proposal',
  grantProgram: 'custom',
  name: 'Custom Proposal',
  description: 'A flexible template for any grant program or custom proposals',
  sections: [
    {
      id: 'summary',
      title: 'Executive Summary',
      description: 'A brief overview of your project and funding request.',
      required: true,
      wordLimit: 500,
      contentFieldKey: 'summary',
    },
    {
      id: 'problem',
      title: 'Problem Statement',
      description: 'The problem your project addresses.',
      required: true,
      wordLimit: 500,
      contentFieldKey: 'problem',
    },
    {
      id: 'solution',
      title: 'Solution',
      description: 'Your proposed solution.',
      required: true,
      wordLimit: 600,
      contentFieldKey: 'solution',
    },
    {
      id: 'technical',
      title: 'Technical Details',
      description: 'Technical approach and architecture.',
      required: false,
      wordLimit: 800,
      contentFieldKey: 'technicalApproach',
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Team members and qualifications.',
      required: false,
      wordLimit: 500,
    },
    {
      id: 'budget',
      title: 'Budget',
      description: 'Funding breakdown and justification.',
      required: false,
      wordLimit: 500,
    },
    {
      id: 'timeline',
      title: 'Timeline',
      description: 'Project milestones and schedule.',
      required: false,
      wordLimit: 400,
      contentFieldKey: 'goToMarket',
    },
  ],
};

/** All available templates */
export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  POTLOCK_TEMPLATE,
  CUSTOM_TEMPLATE,
];

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Get a template by ID.
 */
export function getTemplate(templateId: string): ProposalTemplate | undefined {
  return PROPOSAL_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Get all templates for a grant program.
 */
export function getTemplatesForProgram(program: GrantProgram): ProposalTemplate[] {
  return PROPOSAL_TEMPLATES.filter((t) => t.grantProgram === program);
}

/**
 * Get the display label for a grant program.
 */
export function getGrantProgramLabel(program: GrantProgram): string {
  const labels: Record<GrantProgram, string> = {
    potlock: 'PotLock',
    gitcoin: 'Gitcoin',
    optimism_rpgf: 'Optimism RPGF',
    arbitrum: 'Arbitrum',
    custom: 'Custom',
  };
  return labels[program] ?? program;
}

/**
 * Create a new ProposalWorkflow from a template.
 */
export function createProposalFromTemplate(
  templateId: string,
  title: string,
  ownerId: string,
  projectId: string = 'default'
): ProposalWorkflow {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const now = new Date().toISOString();
  const proposalId = nanoid(10);

  // Build empty content from template sections
  const content: ProposalContent = {
    summary: '',
    problem: '',
    solution: '',
    technicalApproach: '',
  };

  // Build sections from template
  const sections: ProposalSection[] = template.sections.map((templateSection) => ({
    ...templateSection,
    content: '',
    wordCount: 0,
    isComplete: false,
  }));

  const proposal: Proposal = {
    id: proposalId,
    projectId,
    ownerId,
    title,
    grantProgram: template.grantProgram,
    content,
    team: [],
    milestones: [],
    budget: [],
    totalFunding: 0,
    durationMonths: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  return {
    proposal,
    sections,
    templateId,
    grantProgram: template.grantProgram,
    version: 1,
    versionHistory: [],
    activeSectionId: sections[0]?.id ?? null,
    showAIPanel: false,
    sectionCids: {},
    unmappedSectionContent: {},
  };
}
