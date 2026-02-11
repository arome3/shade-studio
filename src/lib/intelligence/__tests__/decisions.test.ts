/**
 * Tests for the decision journal utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterDecisions,
  exportDecisionsToMarkdown,
  getCategoryBadgeVariant,
  getStatusBadgeVariant,
  getOutcomeBadgeVariant,
  getOutcomeColor,
  getOutcomeBgColor,
  getCategoryLabel,
  getOutcomeLabel,
  getStatusLabel,
} from '../decisions';
import type { Decision } from '@/types/intelligence';

// Mock the AI client module
vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'This is a strategic analysis of the decision.',
    }),
  })),
}));

// Helper to create a mock decision
const createMockDecision = (
  overrides: Partial<Decision> = {}
): Decision => ({
  id: 'dec-1',
  title: 'Adopt TypeScript',
  description: 'Migrate codebase to TypeScript',
  category: 'technical',
  status: 'proposed',
  outcome: 'pending',
  context: 'Growing codebase needs type safety',
  rationale: 'TypeScript reduces runtime errors',
  alternatives: [],
  expectedImpact: 'Fewer bugs, better DX',
  decisionMakers: ['Alice'],
  relatedDocuments: [],
  tags: ['typescript', 'dx'],
  decisionDate: '2024-06-15',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('getCategoryBadgeVariant', () => {
  it('should return correct variants for each category', () => {
    expect(getCategoryBadgeVariant('strategic')).toBe('default');
    expect(getCategoryBadgeVariant('technical')).toBe('secondary');
    expect(getCategoryBadgeVariant('financial')).toBe('success');
    expect(getCategoryBadgeVariant('team')).toBe('warning');
    expect(getCategoryBadgeVariant('partnership')).toBe('outline');
    expect(getCategoryBadgeVariant('product')).toBe('default');
    expect(getCategoryBadgeVariant('marketing')).toBe('error');
  });
});

describe('getStatusBadgeVariant', () => {
  it('should return correct variants for each status', () => {
    expect(getStatusBadgeVariant('proposed')).toBe('outline');
    expect(getStatusBadgeVariant('approved')).toBe('success');
    expect(getStatusBadgeVariant('implemented')).toBe('default');
    expect(getStatusBadgeVariant('revisited')).toBe('warning');
    expect(getStatusBadgeVariant('reversed')).toBe('error');
  });
});

describe('getOutcomeBadgeVariant', () => {
  it('should return correct variants for each outcome', () => {
    expect(getOutcomeBadgeVariant('pending')).toBe('outline');
    expect(getOutcomeBadgeVariant('successful')).toBe('success');
    expect(getOutcomeBadgeVariant('partially_successful')).toBe('warning');
    expect(getOutcomeBadgeVariant('unsuccessful')).toBe('error');
    expect(getOutcomeBadgeVariant('inconclusive')).toBe('secondary');
  });
});

describe('getOutcomeColor', () => {
  it('should return correct text color classes for each outcome', () => {
    expect(getOutcomeColor('successful')).toBe('text-success');
    expect(getOutcomeColor('partially_successful')).toBe('text-warning');
    expect(getOutcomeColor('unsuccessful')).toBe('text-error');
    expect(getOutcomeColor('inconclusive')).toBe('text-near-cyan-500');
    expect(getOutcomeColor('pending')).toBe('text-text-muted');
  });
});

describe('getOutcomeBgColor', () => {
  it('should return correct bg color classes for each outcome', () => {
    expect(getOutcomeBgColor('successful')).toBe('bg-success');
    expect(getOutcomeBgColor('partially_successful')).toBe('bg-warning');
    expect(getOutcomeBgColor('unsuccessful')).toBe('bg-error');
    expect(getOutcomeBgColor('inconclusive')).toBe('bg-near-cyan-500');
    expect(getOutcomeBgColor('pending')).toBe('bg-text-muted');
  });
});

describe('getCategoryLabel', () => {
  it('should return capitalized labels for each category', () => {
    expect(getCategoryLabel('strategic')).toBe('Strategic');
    expect(getCategoryLabel('technical')).toBe('Technical');
    expect(getCategoryLabel('financial')).toBe('Financial');
    expect(getCategoryLabel('team')).toBe('Team');
    expect(getCategoryLabel('partnership')).toBe('Partnership');
    expect(getCategoryLabel('product')).toBe('Product');
    expect(getCategoryLabel('marketing')).toBe('Marketing');
  });
});

describe('getOutcomeLabel', () => {
  it('should return formatted labels for each outcome', () => {
    expect(getOutcomeLabel('pending')).toBe('Pending');
    expect(getOutcomeLabel('successful')).toBe('Successful');
    expect(getOutcomeLabel('partially_successful')).toBe('Partially Successful');
    expect(getOutcomeLabel('unsuccessful')).toBe('Unsuccessful');
    expect(getOutcomeLabel('inconclusive')).toBe('Inconclusive');
  });
});

describe('getStatusLabel', () => {
  it('should return formatted labels for each status', () => {
    expect(getStatusLabel('proposed')).toBe('Proposed');
    expect(getStatusLabel('approved')).toBe('Approved');
    expect(getStatusLabel('implemented')).toBe('Implemented');
    expect(getStatusLabel('revisited')).toBe('Revisited');
    expect(getStatusLabel('reversed')).toBe('Reversed');
  });
});

describe('filterDecisions', () => {
  const decisions: Decision[] = [
    createMockDecision({
      id: 'dec-1',
      category: 'technical',
      status: 'proposed',
      outcome: 'pending',
      decisionDate: '2024-06-15',
      tags: ['typescript'],
    }),
    createMockDecision({
      id: 'dec-2',
      title: 'Partner with DAO',
      category: 'partnership',
      status: 'approved',
      outcome: 'successful',
      context: 'Need governance expertise',
      decisionDate: '2024-07-20',
      tags: ['dao', 'governance'],
    }),
    createMockDecision({
      id: 'dec-3',
      title: 'Reduce budget',
      category: 'financial',
      status: 'implemented',
      outcome: 'unsuccessful',
      context: 'Runway getting short',
      decisionDate: '2024-08-10',
      tags: ['budget'],
    }),
  ];

  it('should return all decisions when filter is empty', () => {
    const result = filterDecisions(decisions, {});
    expect(result).toHaveLength(3);
  });

  it('should filter by category', () => {
    const result = filterDecisions(decisions, { category: 'technical' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-1');
  });

  it('should filter by status', () => {
    const result = filterDecisions(decisions, { status: 'approved' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-2');
  });

  it('should filter by outcome', () => {
    const result = filterDecisions(decisions, { outcome: 'unsuccessful' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-3');
  });

  it('should filter by date range', () => {
    const result = filterDecisions(decisions, {
      dateRange: { start: '2024-07-01', end: '2024-07-31' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-2');
  });

  it('should filter by search query matching title', () => {
    const result = filterDecisions(decisions, { searchQuery: 'Partner' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-2');
  });

  it('should filter by search query matching tags', () => {
    const result = filterDecisions(decisions, { searchQuery: 'governance' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-2');
  });

  it('should filter by search query matching context', () => {
    const result = filterDecisions(decisions, { searchQuery: 'type safety' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-1');
  });

  it('should apply multiple filters (AND logic)', () => {
    const result = filterDecisions(decisions, {
      category: 'technical',
      outcome: 'pending',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dec-1');
  });

  it('should return empty array when no decisions match', () => {
    const result = filterDecisions(decisions, {
      category: 'marketing',
    });
    expect(result).toHaveLength(0);
  });
});

describe('exportDecisionsToMarkdown', () => {
  it('should generate valid markdown with header and decision details', () => {
    const decisions: Decision[] = [
      createMockDecision({
        title: 'Test Decision',
        category: 'strategic',
        status: 'approved',
        outcome: 'successful',
        context: 'Some context',
        rationale: 'Some rationale',
        expectedImpact: 'High impact',
        actualImpact: 'Very high impact',
        decisionMakers: ['Alice', 'Bob'],
        tags: ['important', 'q3'],
      }),
    ];

    const markdown = exportDecisionsToMarkdown(decisions);

    expect(markdown).toContain('# Decision Journal');
    expect(markdown).toContain('Total Decisions: 1');
    expect(markdown).toContain('## Test Decision');
    expect(markdown).toContain('**Category:** Strategic');
    expect(markdown).toContain('**Status:** approved');
    expect(markdown).toContain('**Outcome:** Successful');
    expect(markdown).toContain('Some context');
    expect(markdown).toContain('Some rationale');
    expect(markdown).toContain('High impact');
    expect(markdown).toContain('Very high impact');
    expect(markdown).toContain('Alice, Bob');
    expect(markdown).toContain('important, q3');
  });

  it('should include alternatives when present', () => {
    const decisions: Decision[] = [
      createMockDecision({
        title: 'With Alternatives',
        alternatives: [
          {
            title: 'Option B',
            description: 'Alternative approach',
            pros: ['Fast', 'Cheap'],
            cons: ['Risky'],
            whyNotChosen: 'Too risky',
          },
        ],
      }),
    ];

    const markdown = exportDecisionsToMarkdown(decisions);

    expect(markdown).toContain('### Alternatives Considered');
    expect(markdown).toContain('#### Option B');
    expect(markdown).toContain('Alternative approach');
    expect(markdown).toContain('**Pros:**');
    expect(markdown).toContain('- Fast');
    expect(markdown).toContain('**Cons:**');
    expect(markdown).toContain('- Risky');
    expect(markdown).toContain('**Why not chosen:** Too risky');
  });

  it('should include AI analysis when present', () => {
    const decisions: Decision[] = [
      createMockDecision({
        aiAnalysis: 'AI says this is a good decision.',
      }),
    ];

    const markdown = exportDecisionsToMarkdown(decisions);

    expect(markdown).toContain('### AI Analysis');
    expect(markdown).toContain('AI says this is a good decision.');
  });

  it('should handle empty decisions array', () => {
    const markdown = exportDecisionsToMarkdown([]);

    expect(markdown).toContain('# Decision Journal');
    expect(markdown).toContain('Total Decisions: 0');
  });
});

describe('analyzeDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call AI client with correct parameters', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: 'This is a strategic analysis.',
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { analyzeDecision } = await import('../decisions');

    const decision = createMockDecision();
    const result = await analyzeDecision(decision);

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result).toBe('This is a strategic analysis.');
  });

  it('should include project context in prompt when provided', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: 'Analysis with context.',
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { analyzeDecision } = await import('../decisions');

    const decision = createMockDecision();
    await analyzeDecision(decision, {}, {
      projectName: 'My Project',
      projectDescription: 'A DeFi platform',
    });

    const systemMessage = mockChat.mock.calls[0]?.[0]?.[0]?.content as string;
    expect(systemMessage).toContain('My Project');
  });
});
