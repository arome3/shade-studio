/**
 * Proposal Export Utilities
 *
 * Export proposals as Markdown or JSON for sharing and backup.
 */

import type { ProposalWorkflow } from '@/types/proposal';
import { getGrantProgramLabel } from './templates';
import { countWords } from './validation';

/**
 * Export a proposal workflow as formatted Markdown.
 */
export function exportProposalToMarkdown(workflow: ProposalWorkflow): string {
  const { proposal, sections, grantProgram, version } = workflow;
  const lines: string[] = [];

  lines.push(`# ${proposal.title}`);
  lines.push('');
  lines.push(`**Grant Program:** ${getGrantProgramLabel(grantProgram)}`);
  lines.push(`**Status:** ${proposal.status}`);
  lines.push(`**Version:** ${version}`);
  lines.push(`**Last Updated:** ${proposal.updatedAt}`);

  if (proposal.totalFunding > 0) {
    lines.push(`**Requested Funding:** $${proposal.totalFunding.toLocaleString()}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');

    if (section.content.trim()) {
      lines.push(section.content.trim());
    } else {
      lines.push('*No content yet*');
    }

    const wc = countWords(section.content);
    const limitInfo = section.wordLimit ? `/${section.wordLimit}` : '';
    lines.push('');
    lines.push(`> ${wc}${limitInfo} words${section.required ? ' | Required' : ''}`);
    lines.push('');
  }

  // Team section
  if (proposal.team.length > 0) {
    lines.push('## Team');
    lines.push('');
    for (const member of proposal.team) {
      lines.push(`- **${member.name}** — ${member.role}`);
      if (member.background) {
        lines.push(`  ${member.background}`);
      }
    }
    lines.push('');
  }

  // Budget section
  if (proposal.budget.length > 0) {
    lines.push('## Budget Details');
    lines.push('');
    lines.push('| Category | Description | Amount |');
    lines.push('|----------|-------------|--------|');
    for (const item of proposal.budget) {
      lines.push(`| ${item.category} | ${item.description} | $${item.amount.toLocaleString()} |`);
    }
    lines.push('');
    lines.push(`**Total:** $${proposal.totalFunding.toLocaleString()}`);
    lines.push('');
  }

  // Milestones section
  if (proposal.milestones.length > 0) {
    lines.push('## Milestones');
    lines.push('');
    for (const milestone of proposal.milestones) {
      lines.push(`### ${milestone.order}. ${milestone.title}`);
      lines.push('');
      lines.push(milestone.description);
      lines.push('');
      if (milestone.deliverables.length > 0) {
        lines.push('**Deliverables:**');
        for (const d of milestone.deliverables) {
          lines.push(`- ${d}`);
        }
      }
      lines.push(`**Target Date:** ${milestone.targetDate}`);
      lines.push(`**Funding:** $${milestone.fundingAmount.toLocaleString()}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Exported from Shade Studio on ${new Date().toISOString().slice(0, 10)}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Export a proposal workflow as a JSON string.
 */
export function exportProposalToJSON(workflow: ProposalWorkflow): string {
  return JSON.stringify(
    {
      proposal: workflow.proposal,
      sections: workflow.sections.map(({ aiSuggestions: _, ...rest }) => rest),
      templateId: workflow.templateId,
      grantProgram: workflow.grantProgram,
      version: workflow.version,
      versionHistory: workflow.versionHistory,
      unmappedSectionContent: workflow.unmappedSectionContent ?? {},
      exportedAt: Date.now(),
    },
    null,
    2
  );
}
