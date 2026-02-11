/**
 * Tests for the weekly synthesis utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWeekBounds,
  gatherWeeklyData,
  exportSynthesisToMarkdown,
  validateSynthesisImport,
  getTrendDirectionBadgeVariant,
  getRecommendationPriorityColor,
  getRecommendationPriorityBadgeVariant,
  getSynthesisStatusBadgeVariant,
  getEffortBadgeVariant,
} from '../synthesis';
import type {
  DailyBriefing,
  Decision,
  Meeting,
  CompetitiveEntry,
  Competitor,
  WeeklySynthesis,
} from '@/types/intelligence';

// Mock the AI client module
vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        executiveSummary: 'A productive week overall.',
        strategicAnalysis: 'Strong momentum in grant applications.',
        trends: [
          {
            title: 'Increased funding',
            description: 'More grants available',
            category: 'funding',
            direction: 'positive',
            confidence: 85,
          },
        ],
        grantProgress: [
          {
            program: 'NEAR Grants',
            previousStatus: 'drafting',
            currentStatus: 'submitted',
            milestones: ['Application submitted'],
            blockers: [],
            progressDelta: 30,
          },
        ],
        recommendations: [
          {
            title: 'Follow up on grant',
            description: 'Check status with grants team',
            priority: 'high',
            category: 'grants',
            effort: 'low',
          },
        ],
        highlights: ['Submitted grant application', 'Hired new developer'],
        risks: ['Tight deadline for milestone delivery'],
      }),
      attestation: { type: 'tee', data: 'mock-attestation' },
    }),
  })),
}));

// ============================================================================
// Mock Data Helpers
// ============================================================================

const createMockBriefing = (
  overrides: Partial<DailyBriefing> = {}
): DailyBriefing => ({
  id: 'brief-1',
  accountId: 'test.near',
  date: '2024-06-10',
  greeting: 'Good morning!',
  summary: 'Daily summary for the day.',
  items: [],
  metrics: {
    activeProjects: 2,
    pendingProposals: 1,
    upcomingDeadlines: 3,
    actionRequired: 2,
    totalFundingRequested: 50000,
    totalFundingReceived: 10000,
  },
  generatedAt: '2024-06-10T08:00:00.000Z',
  ...overrides,
});

const createMockDecision = (
  overrides: Partial<Decision> = {}
): Decision => ({
  id: 'dec-1',
  title: 'Adopt new tech stack',
  description: 'Decided to use Rust for smart contracts',
  category: 'technical',
  status: 'approved',
  outcome: 'pending',
  context: 'Need more performant contracts',
  rationale: 'Rust provides better security guarantees',
  alternatives: [],
  expectedImpact: 'Reduced gas costs',
  decisionMakers: ['Alice'],
  relatedDocuments: [],
  tags: ['technical'],
  decisionDate: '2024-06-12',
  createdAt: new Date('2024-06-12').getTime(),
  updatedAt: new Date('2024-06-12').getTime(),
  ...overrides,
});

const createMockMeeting = (
  overrides: Partial<Meeting> = {}
): Meeting => ({
  id: 'mtg-1',
  title: 'Team Sync',
  type: 'team',
  date: '2024-06-11',
  duration: 30,
  attendees: ['Alice', 'Bob'],
  rawNotes: 'Discussed project updates.',
  summary: 'Quick sync on milestones.',
  actionItems: [
    {
      id: 'ai-1',
      description: 'Update documentation',
      priority: 'medium',
      status: 'pending',
    },
    {
      id: 'ai-2',
      description: 'Deploy to testnet',
      priority: 'high',
      status: 'completed',
      completedAt: new Date('2024-06-12').getTime(),
    },
  ],
  decisions: ['Move to bi-weekly releases'],
  followUpNeeded: false,
  tags: ['sync'],
  createdAt: new Date('2024-06-11').getTime(),
  updatedAt: new Date('2024-06-11').getTime(),
  isProcessed: true,
  ...overrides,
});

const createMockEntry = (
  overrides: Partial<CompetitiveEntry> = {}
): CompetitiveEntry => ({
  id: 'entry-1',
  competitorId: 'comp-1',
  type: 'funding',
  title: 'Competitor raised Series A',
  description: 'Raised $5M for DeFi platform',
  date: '2024-06-13',
  relevance: 80,
  amount: 5000000,
  isManual: false,
  createdAt: new Date('2024-06-13').getTime(),
  ...overrides,
});

const createMockCompetitor = (
  overrides: Partial<Competitor> = {}
): Competitor => ({
  id: 'comp-1',
  name: 'DeFi Competitor',
  description: 'A competing DeFi platform',
  categories: ['defi'],
  threatLevel: 3,
  addedAt: Date.now(),
  ...overrides,
});

const createMockSynthesis = (
  overrides: Partial<WeeklySynthesis> = {}
): WeeklySynthesis => ({
  id: 'synth-2024-06-10',
  weekStart: '2024-06-10',
  weekEnd: '2024-06-16',
  executiveSummary: 'A productive week with key milestones achieved.',
  strategicAnalysis: 'Grant progress on track.',
  stats: {
    briefingsGenerated: 3,
    meetingsHeld: 2,
    decisionsMade: 1,
    competitiveEntries: 1,
    actionItemsCompleted: 1,
    actionItemsCreated: 2,
    totalFundingTracked: 5000000,
  },
  trends: [
    {
      title: 'DeFi Growth',
      description: 'Increasing adoption',
      category: 'market',
      direction: 'positive',
      confidence: 80,
    },
  ],
  grantProgress: [
    {
      program: 'NEAR Grants',
      previousStatus: 'drafting',
      currentStatus: 'submitted',
      milestones: ['Application submitted'],
      blockers: [],
      progressDelta: 30,
    },
  ],
  recommendations: [
    {
      title: 'Follow up',
      description: 'Check grant status',
      priority: 'high',
      category: 'grants',
      effort: 'low',
    },
  ],
  highlights: ['Submitted application'],
  risks: ['Tight deadline'],
  status: 'completed',
  generatedAt: '2024-06-16T12:00:00.000Z',
  ...overrides,
});

// ============================================================================
// getWeekBounds Tests
// ============================================================================

describe('getWeekBounds', () => {
  it('should return Monday-Sunday bounds for a given date', () => {
    // Wednesday June 12, 2024
    const bounds = getWeekBounds(new Date('2024-06-12'));
    expect(bounds.weekStart).toBe('2024-06-10'); // Monday
    expect(bounds.weekEnd).toBe('2024-06-16'); // Sunday
  });

  it('should return correct bounds when date is Monday', () => {
    const bounds = getWeekBounds(new Date('2024-06-10'));
    expect(bounds.weekStart).toBe('2024-06-10');
    expect(bounds.weekEnd).toBe('2024-06-16');
  });

  it('should return correct bounds when date is Sunday', () => {
    const bounds = getWeekBounds(new Date('2024-06-16'));
    expect(bounds.weekStart).toBe('2024-06-10');
    expect(bounds.weekEnd).toBe('2024-06-16');
  });

  it('should default to current date when no argument', () => {
    const bounds = getWeekBounds();
    expect(bounds.weekStart).toBeDefined();
    expect(bounds.weekEnd).toBeDefined();
    // weekStart should be a Monday
    const day = new Date(bounds.weekStart).getDay();
    expect(day).toBe(1); // Monday = 1
  });
});

// ============================================================================
// gatherWeeklyData Tests
// ============================================================================

describe('gatherWeeklyData', () => {
  const weekStart = '2024-06-10';
  const weekEnd = '2024-06-16';

  it('should filter data to the correct week', () => {
    const briefings = [
      createMockBriefing({ date: '2024-06-10' }), // In range
      createMockBriefing({ id: 'b2', date: '2024-06-15' }), // In range
      createMockBriefing({ id: 'b3', date: '2024-06-20' }), // Out of range
    ];
    const decisions = [
      createMockDecision({ decisionDate: '2024-06-12' }), // In range
      createMockDecision({ id: 'd2', decisionDate: '2024-06-01' }), // Out of range
    ];
    const meetings = [
      createMockMeeting({ date: '2024-06-11' }), // In range
      createMockMeeting({ id: 'm2', date: '2024-06-25' }), // Out of range
    ];
    const entries = [
      createMockEntry({ createdAt: new Date('2024-06-13').getTime() }), // In range
      createMockEntry({ id: 'e2', createdAt: new Date('2024-06-01').getTime() }), // Out of range
    ];
    const competitors = [createMockCompetitor()];

    const result = gatherWeeklyData(
      weekStart, weekEnd,
      briefings, decisions, meetings, entries, competitors
    );

    expect(result.briefings).toHaveLength(2);
    expect(result.decisions).toHaveLength(1);
    expect(result.meetings).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
    expect(result.competitors).toHaveLength(1);
  });

  it('should compute correct stats', () => {
    const meetings = [
      createMockMeeting({
        date: '2024-06-11',
        actionItems: [
          { id: 'a1', description: 'Task 1', priority: 'high', status: 'completed', completedAt: Date.now() },
          { id: 'a2', description: 'Task 2', priority: 'medium', status: 'pending' },
        ],
      }),
    ];
    const entries = [
      createMockEntry({
        type: 'funding',
        amount: 10000,
        createdAt: new Date('2024-06-13').getTime(),
      }),
    ];
    const briefings = [createMockBriefing({ date: '2024-06-10' })];
    const decisions = [createMockDecision({ decisionDate: '2024-06-12' })];

    const result = gatherWeeklyData(
      weekStart, weekEnd,
      briefings, decisions, meetings, entries, []
    );

    expect(result.stats.briefingsGenerated).toBe(1);
    expect(result.stats.meetingsHeld).toBe(1);
    expect(result.stats.decisionsMade).toBe(1);
    expect(result.stats.competitiveEntries).toBe(1);
    expect(result.stats.actionItemsCreated).toBe(2);
    expect(result.stats.actionItemsCompleted).toBe(1);
    expect(result.stats.totalFundingTracked).toBe(10000);
  });

  it('should handle empty data', () => {
    const result = gatherWeeklyData(
      weekStart, weekEnd,
      [], [], [], [], []
    );

    expect(result.briefings).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
    expect(result.meetings).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
    expect(result.stats.briefingsGenerated).toBe(0);
    expect(result.stats.totalFundingTracked).toBe(0);
  });

  it('should only sum funding amounts from funding-type entries', () => {
    const entries = [
      createMockEntry({
        type: 'funding',
        amount: 5000,
        createdAt: new Date('2024-06-13').getTime(),
      }),
      createMockEntry({
        id: 'e2',
        type: 'news',
        amount: 999999,
        createdAt: new Date('2024-06-14').getTime(),
      }),
    ];

    const result = gatherWeeklyData(
      weekStart, weekEnd,
      [], [], [], entries, []
    );

    expect(result.stats.totalFundingTracked).toBe(5000);
  });
});

// ============================================================================
// generateWeeklySynthesis Tests
// ============================================================================

describe('generateWeeklySynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call AI client and return structured synthesis', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        executiveSummary: 'Great week.',
        strategicAnalysis: 'On track for milestones.',
        trends: [
          {
            title: 'Growth',
            description: 'Positive growth',
            category: 'market',
            direction: 'positive',
            confidence: 90,
          },
        ],
        grantProgress: [],
        recommendations: [
          {
            title: 'Expand team',
            description: 'Hire more devs',
            priority: 'high',
            category: 'team',
            effort: 'high',
          },
        ],
        highlights: ['Launched v2'],
        risks: ['Budget constraints'],
      }),
      attestation: { type: 'tee', data: 'test' },
    });
    vi.mocked(getAIClient).mockReturnValue({ chat: mockChat } as any);

    const { generateWeeklySynthesis } = await import('../synthesis');

    const context = gatherWeeklyData(
      '2024-06-10', '2024-06-16',
      [], [], [], [], []
    );

    const result = await generateWeeklySynthesis(context);

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.executiveSummary).toBe('Great week.');
    expect(result.strategicAnalysis).toBe('On track for milestones.');
    expect(result.trends).toHaveLength(1);
    expect(result.trends[0]?.direction).toBe('positive');
    expect(result.recommendations).toHaveLength(1);
    expect(result.highlights).toContain('Launched v2');
    expect(result.risks).toContain('Budget constraints');
    expect(result.status).toBe('completed');
    expect(result.attestation).toBeDefined();
  });

  it('should include project context in prompt when provided', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        executiveSummary: 'Summary',
        strategicAnalysis: '',
        trends: [],
        grantProgress: [],
        recommendations: [],
        highlights: [],
        risks: [],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue({ chat: mockChat } as any);

    const { generateWeeklySynthesis } = await import('../synthesis');

    const context = gatherWeeklyData(
      '2024-06-10', '2024-06-16',
      [], [], [], [], []
    );

    await generateWeeklySynthesis(context, {}, {
      projectName: 'DeFi Protocol',
      projectDescription: 'A lending platform',
    });

    const systemMessage = mockChat.mock.calls[0]?.[0]?.[0]?.content as string;
    expect(systemMessage).toContain('DeFi Protocol');
  });

  it('should handle markdown-wrapped JSON from AI', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: '```json\n' + JSON.stringify({
        executiveSummary: 'Wrapped response',
        strategicAnalysis: '',
        trends: [],
        grantProgress: [],
        recommendations: [],
        highlights: [],
        risks: [],
      }) + '\n```',
    });
    vi.mocked(getAIClient).mockReturnValue({ chat: mockChat } as any);

    const { generateWeeklySynthesis } = await import('../synthesis');

    const context = gatherWeeklyData(
      '2024-06-10', '2024-06-16',
      [], [], [], [], []
    );

    const result = await generateWeeklySynthesis(context);
    expect(result.executiveSummary).toBe('Wrapped response');
  });

  it('should normalize invalid trend directions', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        executiveSummary: 'Test',
        strategicAnalysis: '',
        trends: [
          {
            title: 'Bad trend',
            description: 'Has invalid direction',
            category: 'test',
            direction: 'INVALID',
            confidence: 200,
          },
        ],
        grantProgress: [],
        recommendations: [],
        highlights: [],
        risks: [],
      }),
    });
    vi.mocked(getAIClient).mockReturnValue({ chat: mockChat } as any);

    const { generateWeeklySynthesis } = await import('../synthesis');

    const context = gatherWeeklyData(
      '2024-06-10', '2024-06-16',
      [], [], [], [], []
    );

    const result = await generateWeeklySynthesis(context);
    expect(result.trends[0]?.direction).toBe('neutral'); // Normalized from 'INVALID'
    expect(result.trends[0]?.confidence).toBe(100); // Clamped from 200
  });
});

// ============================================================================
// Export Tests
// ============================================================================

describe('exportSynthesisToMarkdown', () => {
  it('should generate valid markdown with all sections', () => {
    const synthesis = createMockSynthesis();
    const markdown = exportSynthesisToMarkdown(synthesis);

    expect(markdown).toContain('# Weekly Synthesis: 2024-06-10 – 2024-06-16');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).toContain('A productive week with key milestones achieved.');
    expect(markdown).toContain('## Weekly Stats');
    expect(markdown).toContain('| Briefings Generated | 3 |');
    expect(markdown).toContain('## Trends');
    expect(markdown).toContain('↑ DeFi Growth');
    expect(markdown).toContain('## Grant Progress');
    expect(markdown).toContain('NEAR Grants');
    expect(markdown).toContain('drafting → submitted');
    expect(markdown).toContain('## Key Highlights');
    expect(markdown).toContain('Submitted application');
    expect(markdown).toContain('## Risks & Concerns');
    expect(markdown).toContain('Tight deadline');
    expect(markdown).toContain('## Recommendations for Next Week');
    expect(markdown).toContain('[HIGH] Follow up');
  });

  it('should handle synthesis with empty arrays', () => {
    const synthesis = createMockSynthesis({
      trends: [],
      grantProgress: [],
      recommendations: [],
      highlights: [],
      risks: [],
    });
    const markdown = exportSynthesisToMarkdown(synthesis);

    expect(markdown).toContain('# Weekly Synthesis');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).not.toContain('## Trends');
    expect(markdown).not.toContain('## Grant Progress');
    expect(markdown).not.toContain('## Key Highlights');
    expect(markdown).not.toContain('## Risks');
    expect(markdown).not.toContain('## Recommendations');
  });

  it('should include attestation notice when present', () => {
    const synthesis = createMockSynthesis({
      attestation: { type: 'tee', data: 'mock' } as any,
    });
    const markdown = exportSynthesisToMarkdown(synthesis);
    expect(markdown).toContain('TEE attestation');
  });

  it('should show correct trend arrows', () => {
    const synthesis = createMockSynthesis({
      trends: [
        { title: 'Up', description: '', category: '', direction: 'positive', confidence: 80 },
        { title: 'Down', description: '', category: '', direction: 'negative', confidence: 60 },
        { title: 'Flat', description: '', category: '', direction: 'neutral', confidence: 50 },
      ],
    });
    const markdown = exportSynthesisToMarkdown(synthesis);

    expect(markdown).toContain('↑ Up');
    expect(markdown).toContain('↓ Down');
    expect(markdown).toContain('→ Flat');
  });
});

// ============================================================================
// UI Helper Tests
// ============================================================================

describe('getTrendDirectionBadgeVariant', () => {
  it('should return correct variants for each direction', () => {
    expect(getTrendDirectionBadgeVariant('positive')).toBe('success');
    expect(getTrendDirectionBadgeVariant('negative')).toBe('error');
    expect(getTrendDirectionBadgeVariant('neutral')).toBe('secondary');
  });
});

describe('getRecommendationPriorityColor', () => {
  it('should return correct colors for each priority', () => {
    expect(getRecommendationPriorityColor('critical')).toBe('text-error');
    expect(getRecommendationPriorityColor('high')).toBe('text-warning');
    expect(getRecommendationPriorityColor('medium')).toBe('text-near-cyan-500');
    expect(getRecommendationPriorityColor('low')).toBe('text-text-muted');
  });
});

describe('getRecommendationPriorityBadgeVariant', () => {
  it('should return correct variants for each priority', () => {
    expect(getRecommendationPriorityBadgeVariant('critical')).toBe('error');
    expect(getRecommendationPriorityBadgeVariant('high')).toBe('warning');
    expect(getRecommendationPriorityBadgeVariant('medium')).toBe('default');
    expect(getRecommendationPriorityBadgeVariant('low')).toBe('outline');
  });
});

describe('getSynthesisStatusBadgeVariant', () => {
  it('should return correct variants for each status', () => {
    expect(getSynthesisStatusBadgeVariant('completed')).toBe('success');
    expect(getSynthesisStatusBadgeVariant('generating')).toBe('warning');
    expect(getSynthesisStatusBadgeVariant('failed')).toBe('error');
  });
});

describe('getEffortBadgeVariant', () => {
  it('should return correct variants for each effort level', () => {
    expect(getEffortBadgeVariant('high')).toBe('error');
    expect(getEffortBadgeVariant('medium')).toBe('warning');
    expect(getEffortBadgeVariant('low')).toBe('outline');
  });
});

// ============================================================================
// Import Validation Tests
// ============================================================================

describe('validateSynthesisImport', () => {
  it('should accept a valid import payload', () => {
    const result = validateSynthesisImport({
      syntheses: {
        '2024-06-10': createMockSynthesis(),
      },
    });

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.validSyntheses)).toHaveLength(1);
  });

  it('should reject non-object input', () => {
    const result = validateSynthesisImport(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not an object');
  });

  it('should reject input without syntheses key', () => {
    const result = validateSynthesisImport({ data: {} });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Missing "syntheses"');
  });

  it('should skip records missing required string fields', () => {
    const result = validateSynthesisImport({
      syntheses: {
        bad: { id: 'x' }, // Missing weekStart, weekEnd, etc.
      },
    });

    expect(result.valid).toBe(false);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should skip records with invalid stats object', () => {
    const badSynthesis = { ...createMockSynthesis(), stats: 'not an object' };
    const result = validateSynthesisImport({
      syntheses: { '2024-06-10': badSynthesis },
    });

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.includes('stats'))).toBe(true);
  });

  it('should accept valid records and skip invalid ones in mixed payload', () => {
    const result = validateSynthesisImport({
      syntheses: {
        '2024-06-10': createMockSynthesis(),
        bad: { broken: true },
      },
    });

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(Object.keys(result.validSyntheses)).toEqual(['2024-06-10']);
  });

  it('should reject records with invalid status', () => {
    const badSynthesis = { ...createMockSynthesis(), status: 'unknown' };
    const result = validateSynthesisImport({
      syntheses: { '2024-06-10': badSynthesis },
    });

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.includes('status'))).toBe(true);
  });

  it('should reject records where arrays are not arrays', () => {
    const badSynthesis = { ...createMockSynthesis(), trends: 'not an array', risks: 42 };
    const result = validateSynthesisImport({
      syntheses: { '2024-06-10': badSynthesis },
    });

    expect(result.invalidCount).toBe(1);
    expect(result.errors.some((e) => e.includes('"trends" must be an array'))).toBe(true);
  });
});
