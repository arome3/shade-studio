/**
 * Proposal Validation Utilities
 *
 * Pure functions for section completeness checking, word counting,
 * and full proposal validation.
 */

import type {
  ProposalSection,
  ProposalWorkflow,
  CompletenessResult,
  GrantProgram,
} from '@/types/proposal';

/**
 * Count words in a string.
 * Splits on whitespace, filters empty strings.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Check whether a single section is complete.
 * A section is complete if:
 * - It has non-empty trimmed content
 * - If required, the content is non-empty
 * - If wordLimit is set, the word count does not exceed it
 */
export function isSectionComplete(section: ProposalSection): boolean {
  if (section.required && !section.content.trim()) return false;
  if (!section.required && !section.content.trim()) return true;
  if (section.wordLimit && countWords(section.content) > section.wordLimit) return false;
  return true;
}

/**
 * Get specific issues for a section.
 */
export function getSectionIssues(section: ProposalSection): string[] {
  const issues: string[] = [];

  if (section.required && !section.content.trim()) {
    issues.push(`"${section.title}" is required but empty`);
  }

  if (section.wordLimit) {
    const wc = countWords(section.content);
    if (wc > section.wordLimit) {
      issues.push(
        `"${section.title}" exceeds word limit (${wc}/${section.wordLimit})`
      );
    }
  }

  return issues;
}

/**
 * Run full completeness check across all sections.
 */
export function checkCompleteness(workflow: ProposalWorkflow): CompletenessResult {
  const { sections } = workflow;
  const missingItems: string[] = [];
  const warnings: string[] = [];

  const sectionStatuses = sections.map((section) => {
    const issues = getSectionIssues(section);
    const isComplete = issues.length === 0 && (section.required ? !!section.content.trim() : true);

    if (section.required && !section.content.trim()) {
      missingItems.push(`${section.title} is required`);
    }

    if (section.wordLimit) {
      const wc = countWords(section.content);
      if (wc > section.wordLimit) {
        warnings.push(`${section.title}: ${wc}/${section.wordLimit} words (over limit)`);
      }
    }

    return {
      sectionId: section.id,
      title: section.title,
      isComplete,
      issues,
    };
  });

  const completeSections = sectionStatuses.filter((s) => s.isComplete).length;
  const totalSections = sectionStatuses.length;
  const percentage = totalSections > 0
    ? Math.round((completeSections / totalSections) * 100)
    : 0;

  // Add warnings for proposal-level issues
  if (!workflow.proposal.title.trim()) {
    missingItems.push('Proposal title is required');
  }

  return {
    isComplete: missingItems.length === 0 && warnings.length === 0,
    percentage,
    missingItems,
    warnings,
    sectionStatuses,
  };
}

// ============================================================================
// Import Validation
// ============================================================================

const VALID_GRANT_PROGRAMS: GrantProgram[] = [
  'potlock',
  'gitcoin',
  'optimism_rpgf',
  'arbitrum',
  'custom',
];

/**
 * Validate a single workflow entry from imported data.
 * Returns an error message string or null if valid.
 */
function validateWorkflowEntry(id: string, entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') {
    return `Proposal "${id}": not a valid object`;
  }

  const wf = entry as Record<string, unknown>;

  // proposal sub-object
  if (!wf.proposal || typeof wf.proposal !== 'object') {
    return `Proposal "${id}": missing or invalid "proposal" field`;
  }
  const proposal = wf.proposal as Record<string, unknown>;
  if (typeof proposal.id !== 'string' || !proposal.id) {
    return `Proposal "${id}": proposal.id must be a non-empty string`;
  }
  if (typeof proposal.title !== 'string') {
    return `Proposal "${id}": proposal.title must be a string`;
  }

  // sections
  if (!Array.isArray(wf.sections)) {
    return `Proposal "${id}": "sections" must be an array`;
  }
  for (let i = 0; i < wf.sections.length; i++) {
    const s = wf.sections[i] as Record<string, unknown> | undefined;
    if (!s || typeof s !== 'object') {
      return `Proposal "${id}": sections[${i}] is not a valid object`;
    }
    if (typeof s.id !== 'string' || !s.id) {
      return `Proposal "${id}": sections[${i}].id must be a non-empty string`;
    }
    if (typeof s.title !== 'string') {
      return `Proposal "${id}": sections[${i}].title must be a string`;
    }
    if (typeof s.content !== 'string') {
      return `Proposal "${id}": sections[${i}].content must be a string`;
    }
  }

  // templateId
  if (typeof wf.templateId !== 'string' || !wf.templateId) {
    return `Proposal "${id}": templateId must be a non-empty string`;
  }

  // grantProgram
  if (
    typeof wf.grantProgram !== 'string' ||
    !VALID_GRANT_PROGRAMS.includes(wf.grantProgram as GrantProgram)
  ) {
    return `Proposal "${id}": grantProgram must be one of ${VALID_GRANT_PROGRAMS.join(', ')}`;
  }

  // version
  if (typeof wf.version !== 'number' || wf.version < 1) {
    return `Proposal "${id}": version must be a positive number`;
  }

  // versionHistory (optional but must be array if present)
  if (wf.versionHistory !== undefined && !Array.isArray(wf.versionHistory)) {
    return `Proposal "${id}": versionHistory must be an array`;
  }

  return null;
}

/** Result of import validation */
export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  validCount: number;
}

/**
 * Validate the shape of imported data before passing to the store.
 * Checks structural integrity without being overly strict about optional fields.
 */
export function validateImportData(data: unknown): ImportValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Import data must be a JSON object'], validCount: 0 };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.proposals || typeof obj.proposals !== 'object' || Array.isArray(obj.proposals)) {
    return {
      valid: false,
      errors: ['Import data must contain a "proposals" object (not array)'],
      validCount: 0,
    };
  }

  const proposals = obj.proposals as Record<string, unknown>;
  const entries = Object.entries(proposals);

  if (entries.length === 0) {
    return { valid: false, errors: ['Import file contains no proposals'], validCount: 0 };
  }

  // Cap at a reasonable limit to prevent memory abuse
  if (entries.length > 500) {
    return {
      valid: false,
      errors: [`Import contains ${entries.length} proposals (maximum is 500)`],
      validCount: 0,
    };
  }

  let validCount = 0;
  for (const [id, entry] of entries) {
    const error = validateWorkflowEntry(id, entry);
    if (error) {
      errors.push(error);
    } else {
      validCount++;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validCount,
  };
}
