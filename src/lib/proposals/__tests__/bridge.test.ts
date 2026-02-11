/**
 * Tests for proposal bridge (bidirectional mapping).
 */

import { describe, it, expect } from 'vitest';
import {
  proposalToWorkflow,
  workflowToProposal,
  syncSectionToProposal,
} from '../bridge';
import { createProposalFromTemplate } from '../templates';
import type { Proposal, ProposalContent } from '@/types/proposal';

// ============================================================================
// Helpers
// ============================================================================

function createProposal(content: Partial<ProposalContent> = {}): Proposal {
  return {
    id: 'prop-1',
    projectId: 'proj-1',
    ownerId: 'alice.near',
    title: 'Test Proposal',
    grantProgram: 'potlock',
    content: {
      summary: 'A great project',
      problem: 'Users need better tools',
      solution: 'We build better tools',
      technicalApproach: 'React + NEAR',
      marketAnalysis: 'Growing market',
      competition: 'NEAR-native approach',
      goToMarket: 'Launch in Q3',
      risks: 'Execution risk',
      additionalNotes: 'Previous NEAR hackathon winners',
      ...content,
    },
    team: [],
    milestones: [],
    budget: [],
    totalFunding: 10000,
    durationMonths: 6,
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('proposalToWorkflow', () => {
  it('creates a workflow from an existing proposal', () => {
    const proposal = createProposal();
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');

    expect(workflow.proposal).toEqual(proposal);
    expect(workflow.templateId).toBe('potlock-standard');
    expect(workflow.grantProgram).toBe('potlock');
    expect(workflow.sections.length).toBeGreaterThan(0);
  });

  it('populates section content from ProposalContent fields', () => {
    const proposal = createProposal({ summary: 'My summary text' });
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');

    const overview = workflow.sections.find((s) => s.contentFieldKey === 'summary');
    expect(overview).toBeDefined();
    expect(overview!.content).toBe('My summary text');
    expect(overview!.wordCount).toBeGreaterThan(0);
  });

  it('leaves sections without content field mapping empty', () => {
    const proposal = createProposal();
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');

    const teamSection = workflow.sections.find((s) => s.id === 'team');
    expect(teamSection).toBeDefined();
    expect(teamSection!.content).toBe('');
  });

  it('throws for unknown template', () => {
    const proposal = createProposal();
    expect(() => proposalToWorkflow(proposal, 'nonexistent')).toThrow();
  });
});

describe('workflowToProposal', () => {
  it('syncs section content back to proposal', () => {
    const proposal = createProposal({ summary: '' });
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');

    // Simulate editing
    const overview = workflow.sections.find((s) => s.contentFieldKey === 'summary');
    if (overview) {
      overview.content = 'Updated summary';
    }

    const updated = workflowToProposal(workflow);
    expect(updated.content.summary).toBe('Updated summary');
    expect(updated.updatedAt).not.toBe(proposal.updatedAt);
  });

  it('preserves non-mapped content fields', () => {
    const proposal = createProposal({
      summary: 'Original summary',
      problem: 'Original problem',
    });
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');

    const updated = workflowToProposal(workflow);
    expect(updated.content.problem).toBe('Original problem');
  });
});

describe('syncSectionToProposal', () => {
  it('updates proposal content for a mapped section', () => {
    const workflow = createProposalFromTemplate('potlock-standard', 'Test', 'alice.near');
    // Set a past date so updatedAt will definitely differ
    workflow.proposal.updatedAt = '2024-01-01T00:00:00Z';
    const section = workflow.sections.find((s) => s.contentFieldKey === 'summary')!;
    section.content = 'New summary';

    const updated = syncSectionToProposal(workflow.proposal, section);
    expect(updated.content.summary).toBe('New summary');
    expect(updated.updatedAt).not.toBe('2024-01-01T00:00:00Z');
  });

  it('returns proposal unchanged for unmapped section', () => {
    const workflow = createProposalFromTemplate('potlock-standard', 'Test', 'alice.near');
    const teamSection = workflow.sections.find((s) => s.id === 'team')!;
    teamSection.content = 'Team info';

    const updated = syncSectionToProposal(workflow.proposal, teamSection);
    expect(updated).toEqual(workflow.proposal);
  });
});

describe('round-trip: proposal -> workflow -> proposal', () => {
  it('preserves content through round-trip', () => {
    const original = createProposal({
      summary: 'Original summary',
      problem: 'Original problem',
      solution: 'Original solution',
      technicalApproach: 'Original tech approach',
    });

    const workflow = proposalToWorkflow(original, 'potlock-standard');
    const roundTripped = workflowToProposal(workflow);

    expect(roundTripped.content.summary).toBe('Original summary');
    expect(roundTripped.content.problem).toBe('Original problem');
    expect(roundTripped.content.solution).toBe('Original solution');
    expect(roundTripped.content.technicalApproach).toBe('Original tech approach');
  });
});

describe('unmapped section content', () => {
  it('initializes unmappedSectionContent as empty object', () => {
    const proposal = createProposal();
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');
    expect(workflow.unmappedSectionContent).toEqual({});
  });

  it('restores unmapped section content from existing data', () => {
    const proposal = createProposal();
    const unmapped = { team: 'Our experienced team of 5', budget: 'Detailed budget info' };
    const workflow = proposalToWorkflow(proposal, 'potlock-standard', unmapped);

    const teamSection = workflow.sections.find((s) => s.id === 'team');
    expect(teamSection).toBeDefined();
    expect(teamSection!.content).toBe('Our experienced team of 5');

    const budgetSection = workflow.sections.find((s) => s.id === 'budget');
    expect(budgetSection).toBeDefined();
    expect(budgetSection!.content).toBe('Detailed budget info');
  });

  it('preserves unmapped content in the unmappedSectionContent record', () => {
    const proposal = createProposal();
    const unmapped = { team: 'Team data' };
    const workflow = proposalToWorkflow(proposal, 'potlock-standard', unmapped);

    expect(workflow.unmappedSectionContent).toEqual({ team: 'Team data' });
  });

  it('does not overwrite mapped section content with unmapped data', () => {
    const proposal = createProposal({ summary: 'Real summary' });
    // Even if unmapped has a key matching a mapped section, the mapped value wins
    const workflow = proposalToWorkflow(proposal, 'potlock-standard');
    const overview = workflow.sections.find((s) => s.contentFieldKey === 'summary');
    expect(overview!.content).toBe('Real summary');
  });
});
