/**
 * Proposal utilities barrel exports
 */

export {
  countWords,
  isSectionComplete,
  getSectionIssues,
  checkCompleteness,
  validateImportData,
} from './validation';
export type { ImportValidationResult } from './validation';

export {
  POTLOCK_TEMPLATE,
  CUSTOM_TEMPLATE,
  PROPOSAL_TEMPLATES,
  getTemplate,
  getTemplatesForProgram,
  getGrantProgramLabel,
  createProposalFromTemplate,
} from './templates';

export {
  proposalToWorkflow,
  workflowToProposal,
  syncSectionToProposal,
} from './bridge';

export {
  exportProposalToMarkdown,
  exportProposalToJSON,
} from './export';
