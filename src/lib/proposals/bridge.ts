/**
 * Proposal Bridge
 *
 * Bidirectional mapping between the named-field ProposalContent model
 * and the flexible ProposalSection[] model used by the workflow editor.
 */

import type {
  Proposal,
  ProposalContent,
  ProposalSection,
  ProposalWorkflow,
} from '@/types/proposal';
import { getTemplate } from './templates';
import { countWords, isSectionComplete } from './validation';

/**
 * Convert an existing Proposal into a ProposalWorkflow.
 *
 * Uses the specified template to determine section structure.
 * Pre-fills section content from ProposalContent fields where mapped.
 */
export function proposalToWorkflow(
  proposal: Proposal,
  templateId: string,
  existingUnmapped?: Record<string, string>
): ProposalWorkflow {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const unmappedSectionContent: Record<string, string> = existingUnmapped ? { ...existingUnmapped } : {};

  const sections: ProposalSection[] = template.sections.map((templateSection) => {
    // Pull existing content from the proposal's named fields
    let content = '';
    if (templateSection.contentFieldKey) {
      const fieldValue = proposal.content[templateSection.contentFieldKey];
      content = fieldValue ?? '';
    } else if (unmappedSectionContent[templateSection.id]) {
      // Restore previously saved unmapped content
      content = unmappedSectionContent[templateSection.id]!;
    }

    const section: ProposalSection = {
      ...templateSection,
      content,
      wordCount: countWords(content),
      isComplete: false,
    };
    section.isComplete = isSectionComplete(section);

    return section;
  });

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
    unmappedSectionContent,
  };
}

/**
 * Sync section content back to ProposalContent fields.
 *
 * Iterates over sections with contentFieldKey and updates the proposal's
 * content object. Returns a new Proposal with updated content + updatedAt.
 */
export function workflowToProposal(workflow: ProposalWorkflow): Proposal {
  const updatedContent: ProposalContent = { ...workflow.proposal.content };

  for (const section of workflow.sections) {
    if (section.contentFieldKey) {
      (updatedContent[section.contentFieldKey] as string) = section.content;
    }
  }

  return {
    ...workflow.proposal,
    content: updatedContent,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sync a single section's content to the proposal's content field.
 *
 * Used for incremental updates when a section is edited, avoiding
 * the cost of iterating all sections.
 */
export function syncSectionToProposal(
  proposal: Proposal,
  section: ProposalSection
): Proposal {
  if (!section.contentFieldKey) return proposal;

  return {
    ...proposal,
    content: {
      ...proposal.content,
      [section.contentFieldKey]: section.content,
    },
    updatedAt: new Date().toISOString(),
  };
}
