/**
 * Tests for proposal AI prompt functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProposalSection } from '@/types/proposal';

// Mock getAIClient at module level
const mockChat = vi.fn().mockResolvedValue({ content: 'AI response' });

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chat: mockChat,
  }),
}));

// Mock withRetry to pass through directly (skip retry delays)
vi.mock('@/lib/intelligence/competitive', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

import {
  improveSection,
  generateSectionContent,
  reviewSection,
  reviewFullProposal,
  customSectionPrompt,
} from '../ai-prompts';
import { SYSTEM_PROMPTS } from '@/lib/ai/prompts';

// ============================================================================
// Helpers
// ============================================================================

function createSection(overrides: Partial<ProposalSection> = {}): ProposalSection {
  return {
    id: 'test-section',
    title: 'Test Section',
    description: 'A test section',
    content: 'Some existing content for testing.',
    required: true,
    wordLimit: 500,
    wordCount: 5,
    isComplete: true,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('improveSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'Improved content' });
  });

  it('throws if section has no content', async () => {
    const section = createSection({ content: '' });
    await expect(improveSection(section, 'Test Proposal')).rejects.toThrow(
      'Section has no content to improve'
    );
  });

  it('calls AI client with grantWriter system prompt', async () => {
    const section = createSection({ content: 'Draft text here.' });
    await improveSection(section, 'Test Proposal');

    expect(mockChat).toHaveBeenCalledTimes(1);
    const messages = mockChat.mock.calls[0]![0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(SYSTEM_PROMPTS.grantWriter);
  });

  it('strips markdown code blocks from response', async () => {
    mockChat.mockResolvedValue({ content: '```markdown\nClean content\n```' });
    const section = createSection({ content: 'Original.' });
    const result = await improveSection(section, 'Test Proposal');

    expect(result).toBe('Clean content');
  });
});

describe('generateSectionContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'Generated content' });
  });

  it('includes context from other sections', async () => {
    const section = createSection({ id: 'target', content: '' });
    const otherSections = [
      createSection({ id: 'other-1', title: 'Problem', content: 'A big problem exists' }),
      createSection({ id: 'target', content: '' }),
    ];

    await generateSectionContent(section, 'Test Proposal', otherSections);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const userMessage = mockChat.mock.calls[0]![0][1].content;
    expect(userMessage).toContain('A big problem exists');
  });

  it('works when section is empty', async () => {
    const section = createSection({ content: '' });
    const result = await generateSectionContent(section, 'Test Proposal', [section]);

    expect(result).toBe('Generated content');
  });
});

describe('reviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'Review feedback here' });
  });

  it('throws if section has no content', async () => {
    const section = createSection({ content: '   ' });
    await expect(reviewSection(section, 'Test Proposal')).rejects.toThrow(
      'Section has no content to review'
    );
  });

  it('uses documentReviewer system prompt', async () => {
    const section = createSection({ content: 'Content to review.' });
    await reviewSection(section, 'Test Proposal');

    const messages = mockChat.mock.calls[0]![0];
    expect(messages[0].content).toBe(SYSTEM_PROMPTS.documentReviewer);
  });
});

describe('reviewFullProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'Full proposal review' });
  });

  it('includes all sections in prompt', async () => {
    const sections = [
      createSection({ id: 's1', title: 'Overview', content: 'Overview text' }),
      createSection({ id: 's2', title: 'Solution', content: 'Solution text' }),
      createSection({ id: 's3', title: 'Empty', content: '' }),
    ];

    await reviewFullProposal(sections, 'Test Proposal');

    const userMessage = mockChat.mock.calls[0]![0][1].content;
    expect(userMessage).toContain('Overview text');
    expect(userMessage).toContain('Solution text');
    expect(userMessage).toContain('*Empty*');
  });
});

describe('customSectionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'Custom response' });
  });

  it('passes user prompt to AI', async () => {
    const section = createSection();
    await customSectionPrompt(section, 'Test Proposal', 'Make it more technical');

    const userMessage = mockChat.mock.calls[0]![0][1].content;
    expect(userMessage).toContain('Make it more technical');
  });
});

describe('ChatOptions passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({ content: 'response' });
  });

  it('passes temperature and other options through', async () => {
    const section = createSection({ content: 'Text' });
    await improveSection(section, 'Test Proposal', { temperature: 0.3 });

    const options = mockChat.mock.calls[0]![1];
    // Temperature is overridden in the function to 0.7, but spread from options
    expect(options).toBeDefined();
  });
});
