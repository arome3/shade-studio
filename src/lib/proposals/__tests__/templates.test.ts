/**
 * Tests for proposal templates.
 */

import { describe, it, expect } from 'vitest';
import {
  POTLOCK_TEMPLATE,
  PROPOSAL_TEMPLATES,
  getTemplate,
  getTemplatesForProgram,
  getGrantProgramLabel,
  createProposalFromTemplate,
} from '../templates';

describe('PROPOSAL_TEMPLATES', () => {
  it('contains at least 2 templates', () => {
    expect(PROPOSAL_TEMPLATES.length).toBeGreaterThanOrEqual(2);
  });

  it('PotLock template has required sections', () => {
    const required = POTLOCK_TEMPLATE.sections.filter((s) => s.required);
    expect(required.length).toBeGreaterThan(0);
  });

  it('templates have unique IDs', () => {
    const ids = PROPOSAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template section has a unique ID within the template', () => {
    for (const template of PROPOSAL_TEMPLATES) {
      const sectionIds = template.sections.map((s) => s.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
    }
  });
});

describe('getTemplate', () => {
  it('returns PotLock template by ID', () => {
    const template = getTemplate('potlock-standard');
    expect(template).toBeDefined();
    expect(template!.grantProgram).toBe('potlock');
  });

  it('returns custom template by ID', () => {
    const template = getTemplate('custom-proposal');
    expect(template).toBeDefined();
    expect(template!.grantProgram).toBe('custom');
  });

  it('returns undefined for unknown ID', () => {
    expect(getTemplate('nonexistent')).toBeUndefined();
  });
});

describe('getTemplatesForProgram', () => {
  it('returns PotLock templates', () => {
    const templates = getTemplatesForProgram('potlock');
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.grantProgram === 'potlock')).toBe(true);
  });

  it('returns empty array for program with no templates', () => {
    const templates = getTemplatesForProgram('gitcoin');
    expect(templates).toEqual([]);
  });
});

describe('getGrantProgramLabel', () => {
  it('returns human-readable labels', () => {
    expect(getGrantProgramLabel('potlock')).toBe('PotLock');
    expect(getGrantProgramLabel('gitcoin')).toBe('Gitcoin');
    expect(getGrantProgramLabel('optimism_rpgf')).toBe('Optimism RPGF');
    expect(getGrantProgramLabel('custom')).toBe('Custom');
  });
});

describe('createProposalFromTemplate', () => {
  it('creates a workflow from PotLock template', () => {
    const workflow = createProposalFromTemplate(
      'potlock-standard',
      'My Proposal',
      'alice.near',
      'project-1'
    );

    expect(workflow.proposal.title).toBe('My Proposal');
    expect(workflow.proposal.ownerId).toBe('alice.near');
    expect(workflow.proposal.projectId).toBe('project-1');
    expect(workflow.proposal.status).toBe('draft');
    expect(workflow.grantProgram).toBe('potlock');
    expect(workflow.templateId).toBe('potlock-standard');
    expect(workflow.version).toBe(1);
    expect(workflow.versionHistory).toEqual([]);
    expect(workflow.sections.length).toBe(POTLOCK_TEMPLATE.sections.length);
  });

  it('creates sections with empty content', () => {
    const workflow = createProposalFromTemplate(
      'potlock-standard',
      'Test',
      'alice.near'
    );

    for (const section of workflow.sections) {
      expect(section.content).toBe('');
      expect(section.wordCount).toBe(0);
      expect(section.isComplete).toBe(false);
    }
  });

  it('preserves section metadata from template', () => {
    const workflow = createProposalFromTemplate(
      'potlock-standard',
      'Test',
      'alice.near'
    );

    const overview = workflow.sections.find((s) => s.id === 'project-overview');
    expect(overview).toBeDefined();
    expect(overview!.required).toBe(true);
    expect(overview!.wordLimit).toBe(500);
    expect(overview!.contentFieldKey).toBe('summary');
  });

  it('sets activeSectionId to first section', () => {
    const workflow = createProposalFromTemplate(
      'potlock-standard',
      'Test',
      'alice.near'
    );

    expect(workflow.activeSectionId).toBe(workflow.sections[0].id);
  });

  it('throws for unknown template', () => {
    expect(() =>
      createProposalFromTemplate('nonexistent', 'Test', 'alice.near')
    ).toThrow('Template not found');
  });

  it('generates unique proposal IDs', () => {
    const w1 = createProposalFromTemplate('potlock-standard', 'A', 'alice.near');
    const w2 = createProposalFromTemplate('potlock-standard', 'B', 'alice.near');
    expect(w1.proposal.id).not.toBe(w2.proposal.id);
  });
});
