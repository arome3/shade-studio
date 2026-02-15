/**
 * Tests for proposal validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  countWords,
  isSectionComplete,
  getSectionIssues,
  checkCompleteness,
  validateImportData,
} from '../validation';
import type { ProposalSection, ProposalWorkflow, Proposal } from '@/types/proposal';

// ============================================================================
// Helpers
// ============================================================================

function createSection(overrides: Partial<ProposalSection> = {}): ProposalSection {
  return {
    id: 'section-1',
    title: 'Test Section',
    description: 'A test section',
    content: '',
    required: true,
    wordCount: 0,
    isComplete: false,
    ...overrides,
  };
}

function createWorkflow(sections: ProposalSection[]): ProposalWorkflow {
  const proposal: Proposal = {
    id: 'proposal-1',
    projectId: 'project-1',
    ownerId: 'alice.near',
    title: 'Test Proposal',
    grantProgram: 'potlock',
    content: {
      summary: '',
      problem: '',
      solution: '',
      technicalApproach: '',
    },
    team: [],
    milestones: [],
    budget: [],
    totalFunding: 0,
    durationMonths: 3,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    proposal,
    sections,
    templateId: 'test-template',
    grantProgram: 'potlock',
    version: 1,
    versionHistory: [],
    activeSectionId: null,
    showAIPanel: false,
    sectionCids: {},
    unmappedSectionContent: {},
  };
}

/** Create a minimal valid workflow object for import validation tests */
function createValidImportWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    proposal: {
      id: 'prop-1',
      projectId: 'proj-1',
      ownerId: 'alice.near',
      title: 'Test Proposal',
      grantProgram: 'potlock',
      content: { summary: '', problem: '', solution: '', technicalApproach: '' },
      team: [],
      milestones: [],
      budget: [],
      totalFunding: 0,
      durationMonths: 3,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sections: [
      { id: 's1', title: 'Section 1', description: 'Desc', content: '', required: true, wordCount: 0, isComplete: false },
    ],
    templateId: 'potlock-standard',
    grantProgram: 'potlock',
    version: 1,
    versionHistory: [],
    activeSectionId: null,
    showAIPanel: false,
    sectionCids: {},
    unmappedSectionContent: {},
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('countWords', () => {
  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one two three four five')).toBe(5);
  });

  it('handles multiple whitespace between words', () => {
    expect(countWords('hello   world   foo')).toBe(3);
  });

  it('handles newlines and tabs', () => {
    expect(countWords('hello\nworld\tfoo')).toBe(3);
  });
});

describe('isSectionComplete', () => {
  it('returns false for required section with no content', () => {
    const section = createSection({ required: true, content: '' });
    expect(isSectionComplete(section)).toBe(false);
  });

  it('returns true for required section with content', () => {
    const section = createSection({ required: true, content: 'Some content here' });
    expect(isSectionComplete(section)).toBe(true);
  });

  it('returns true for optional section with no content', () => {
    const section = createSection({ required: false, content: '' });
    expect(isSectionComplete(section)).toBe(true);
  });

  it('returns false when over word limit', () => {
    const longContent = Array(101).fill('word').join(' ');
    const section = createSection({
      required: true,
      content: longContent,
      wordLimit: 100,
    });
    expect(isSectionComplete(section)).toBe(false);
  });

  it('returns true when at word limit', () => {
    const content = Array(100).fill('word').join(' ');
    const section = createSection({
      required: true,
      content,
      wordLimit: 100,
    });
    expect(isSectionComplete(section)).toBe(true);
  });
});

describe('getSectionIssues', () => {
  it('returns empty array for complete section', () => {
    const section = createSection({ required: true, content: 'Some content' });
    expect(getSectionIssues(section)).toEqual([]);
  });

  it('reports empty required section', () => {
    const section = createSection({ required: true, content: '' });
    const issues = getSectionIssues(section);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('required but empty');
  });

  it('reports word limit exceeded', () => {
    const longContent = Array(501).fill('word').join(' ');
    const section = createSection({
      required: true,
      content: longContent,
      wordLimit: 500,
    });
    const issues = getSectionIssues(section);
    expect(issues.some((i) => i.includes('exceeds word limit'))).toBe(true);
  });

  it('returns multiple issues when applicable', () => {
    const section = createSection({
      required: true,
      content: '',
      wordLimit: 500,
    });
    const issues = getSectionIssues(section);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });
});

describe('checkCompleteness', () => {
  it('returns 0% for empty workflow', () => {
    const sections = [
      createSection({ id: 's1', required: true, content: '' }),
      createSection({ id: 's2', required: true, content: '' }),
    ];
    const workflow = createWorkflow(sections);
    const result = checkCompleteness(workflow);

    expect(result.percentage).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.missingItems.length).toBeGreaterThan(0);
  });

  it('returns 100% for fully complete workflow', () => {
    const sections = [
      createSection({ id: 's1', required: true, content: 'Content 1' }),
      createSection({ id: 's2', required: false, content: '' }),
    ];
    const workflow = createWorkflow(sections);
    const result = checkCompleteness(workflow);

    expect(result.percentage).toBe(100);
    expect(result.missingItems).toEqual([]);
  });

  it('calculates partial progress correctly', () => {
    const sections = [
      createSection({ id: 's1', required: true, content: 'Content 1' }),
      createSection({ id: 's2', required: true, content: '' }),
    ];
    const workflow = createWorkflow(sections);
    const result = checkCompleteness(workflow);

    expect(result.percentage).toBe(50);
    expect(result.isComplete).toBe(false);
  });

  it('includes section statuses', () => {
    const sections = [
      createSection({ id: 's1', title: 'Section A', required: true, content: 'Done' }),
      createSection({ id: 's2', title: 'Section B', required: true, content: '' }),
    ];
    const workflow = createWorkflow(sections);
    const result = checkCompleteness(workflow);

    expect(result.sectionStatuses).toHaveLength(2);
    expect(result.sectionStatuses[0]!.isComplete).toBe(true);
    expect(result.sectionStatuses[1]!.isComplete).toBe(false);
  });

  it('warns about word limit violations', () => {
    const longContent = Array(501).fill('word').join(' ');
    const sections = [
      createSection({ id: 's1', required: true, content: longContent, wordLimit: 500 }),
    ];
    const workflow = createWorkflow(sections);
    const result = checkCompleteness(workflow);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
  });
});

// ============================================================================
// Import Validation Tests
// ============================================================================

describe('validateImportData', () => {
  it('accepts valid import data', () => {
    const data = {
      proposals: {
        'p1': createValidImportWorkflow(),
      },
    };
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.validCount).toBe(1);
  });

  it('rejects null or non-object data', () => {
    expect(validateImportData(null).valid).toBe(false);
    expect(validateImportData('string').valid).toBe(false);
    expect(validateImportData(42).valid).toBe(false);
  });

  it('rejects data without proposals field', () => {
    const result = validateImportData({ filter: {} });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('"proposals"');
  });

  it('rejects proposals as array instead of object', () => {
    const result = validateImportData({ proposals: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not array');
  });

  it('rejects empty proposals object', () => {
    const result = validateImportData({ proposals: {} });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no proposals');
  });

  it('rejects workflow missing proposal sub-object', () => {
    const data = {
      proposals: {
        'p1': { ...createValidImportWorkflow(), proposal: null },
      },
    };
    const result = validateImportData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('proposal');
  });

  it('rejects workflow missing proposal.id', () => {
    const wf = createValidImportWorkflow();
    (wf.proposal as Record<string, unknown>).id = '';
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('proposal.id');
  });

  it('rejects workflow with non-array sections', () => {
    const wf = createValidImportWorkflow({ sections: 'not an array' });
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('sections');
  });

  it('rejects workflow with invalid section entry', () => {
    const wf = createValidImportWorkflow({
      sections: [{ id: '', title: 'Missing ID', content: 'test' }],
    });
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('sections[0].id');
  });

  it('rejects workflow with missing templateId', () => {
    const wf = createValidImportWorkflow({ templateId: '' });
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('templateId');
  });

  it('rejects workflow with invalid grantProgram', () => {
    const wf = createValidImportWorkflow({ grantProgram: 'invalid_program' });
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('grantProgram');
  });

  it('rejects workflow with invalid version', () => {
    const wf = createValidImportWorkflow({ version: 0 });
    const result = validateImportData({ proposals: { 'p1': wf } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('version');
  });

  it('reports multiple errors for multiple invalid workflows', () => {
    const data = {
      proposals: {
        'p1': createValidImportWorkflow({ templateId: '' }),
        'p2': createValidImportWorkflow({ version: -1 }),
      },
    };
    const result = validateImportData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('rejects imports exceeding 500 proposals', () => {
    const proposals: Record<string, unknown> = {};
    for (let i = 0; i < 501; i++) {
      proposals[`p${i}`] = createValidImportWorkflow();
    }
    const result = validateImportData({ proposals });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('maximum is 500');
  });

  it('accepts all valid grant programs', () => {
    for (const program of ['potlock', 'gitcoin', 'optimism_rpgf', 'arbitrum', 'custom']) {
      const wf = createValidImportWorkflow({ grantProgram: program });
      const result = validateImportData({ proposals: { 'p1': wf } });
      expect(result.valid).toBe(true);
    }
  });
});
