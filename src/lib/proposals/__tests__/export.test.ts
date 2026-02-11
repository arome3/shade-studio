/**
 * Tests for proposal export utilities.
 */

import { describe, it, expect } from 'vitest';
import { exportProposalToMarkdown, exportProposalToJSON } from '../export';
import { createProposalFromTemplate } from '../templates';
import type { ProposalWorkflow } from '@/types/proposal';

// ============================================================================
// Helpers
// ============================================================================

function createTestWorkflow(overrides: Partial<{ title: string }> = {}): ProposalWorkflow {
  const workflow = createProposalFromTemplate(
    'potlock-standard',
    overrides.title ?? 'Test Grant Proposal',
    'alice.near'
  );
  return workflow;
}

// ============================================================================
// Markdown Export Tests
// ============================================================================

describe('exportProposalToMarkdown', () => {
  it('includes proposal title as H1', () => {
    const workflow = createTestWorkflow({ title: 'My NEAR Grant' });
    const md = exportProposalToMarkdown(workflow);
    expect(md).toContain('# My NEAR Grant');
  });

  it('includes all section titles as H2', () => {
    const workflow = createTestWorkflow();
    const md = exportProposalToMarkdown(workflow);
    for (const section of workflow.sections) {
      expect(md).toContain(`## ${section.title}`);
    }
  });

  it('shows section content or "No content yet" for empty sections', () => {
    const workflow = createTestWorkflow();
    // Set content on first section
    workflow.sections[0]!.content = 'This is the project overview.';
    const md = exportProposalToMarkdown(workflow);

    expect(md).toContain('This is the project overview.');
    expect(md).toContain('*No content yet*');
  });

  it('includes word count info per section', () => {
    const workflow = createTestWorkflow();
    workflow.sections[0]!.content = 'Hello world test content here';
    const md = exportProposalToMarkdown(workflow);

    // Should have word count info like "5/500 words"
    expect(md).toMatch(/\d+.*words/);
  });

  it('includes team members when present', () => {
    const workflow = createTestWorkflow();
    workflow.proposal.team = [
      {
        accountId: 'alice.near',
        name: 'Alice Developer',
        role: 'Lead Engineer',
        background: 'NEAR core contributor',
      },
    ];
    const md = exportProposalToMarkdown(workflow);

    expect(md).toContain('Alice Developer');
    expect(md).toContain('Lead Engineer');
  });

  it('includes budget table when present', () => {
    const workflow = createTestWorkflow();
    workflow.proposal.budget = [
      {
        id: 'b1',
        category: 'development',
        description: 'Smart contract development',
        amount: 15000,
      },
    ];
    workflow.proposal.totalFunding = 15000;
    const md = exportProposalToMarkdown(workflow);

    expect(md).toContain('Budget Details');
    expect(md).toContain('Smart contract development');
    expect(md).toContain('Category');
    expect(md).toContain('Amount');
  });

  it('includes milestones when present', () => {
    const workflow = createTestWorkflow();
    workflow.proposal.milestones = [
      {
        id: 'm1',
        title: 'Alpha Launch',
        description: 'Launch alpha version',
        deliverables: ['Working prototype', 'Documentation'],
        targetDate: '2025-06-01',
        fundingAmount: 5000,
        status: 'pending',
        order: 1,
      },
    ];
    const md = exportProposalToMarkdown(workflow);

    expect(md).toContain('Alpha Launch');
    expect(md).toContain('Working prototype');
    expect(md).toContain('Milestones');
  });

  it('shows grant program label and status', () => {
    const workflow = createTestWorkflow();
    const md = exportProposalToMarkdown(workflow);

    expect(md).toContain('PotLock');
    expect(md).toContain('draft');
  });
});

// ============================================================================
// JSON Export Tests
// ============================================================================

describe('exportProposalToJSON', () => {
  it('produces valid JSON', () => {
    const workflow = createTestWorkflow();
    const json = exportProposalToJSON(workflow);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('strips aiSuggestions from sections', () => {
    const workflow = createTestWorkflow();
    workflow.sections[0]!.aiSuggestions = ['suggestion 1', 'suggestion 2'];

    const json = exportProposalToJSON(workflow);
    const parsed = JSON.parse(json);

    for (const section of parsed.sections) {
      expect(section).not.toHaveProperty('aiSuggestions');
    }
  });

  it('includes exportedAt timestamp', () => {
    const workflow = createTestWorkflow();
    const beforeExport = Date.now();
    const json = exportProposalToJSON(workflow);
    const parsed = JSON.parse(json);

    expect(parsed.exportedAt).toBeGreaterThanOrEqual(beforeExport);
  });

  it('includes unmappedSectionContent', () => {
    const workflow = createTestWorkflow();
    workflow.unmappedSectionContent = { team: 'Our amazing team', budget: 'Detailed costs' };

    const json = exportProposalToJSON(workflow);
    const parsed = JSON.parse(json);

    expect(parsed.unmappedSectionContent).toEqual({
      team: 'Our amazing team',
      budget: 'Detailed costs',
    });
  });

  it('defaults unmappedSectionContent to empty object when missing', () => {
    const workflow = createTestWorkflow();
    // Simulate a legacy workflow without the field
    const legacyWorkflow = { ...workflow } as Record<string, unknown>;
    delete legacyWorkflow.unmappedSectionContent;

    const json = exportProposalToJSON(legacyWorkflow as unknown as ProposalWorkflow);
    const parsed = JSON.parse(json);

    expect(parsed.unmappedSectionContent).toEqual({});
  });

  it('includes version and versionHistory', () => {
    const workflow = createTestWorkflow();
    workflow.version = 3;
    workflow.versionHistory = [
      {
        version: 1,
        timestamp: Date.now() - 10000,
        changeSummary: 'Initial draft',
        sections: [],
      },
      {
        version: 2,
        timestamp: Date.now(),
        changeSummary: 'Added solution section',
        sections: [],
      },
    ];

    const json = exportProposalToJSON(workflow);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(3);
    expect(parsed.versionHistory).toHaveLength(2);
  });
});
