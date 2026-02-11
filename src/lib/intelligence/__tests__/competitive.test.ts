/**
 * Tests for the competitive analysis utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getThreatLevelColor,
  getThreatLevelBgColor,
  getThreatLevelLabel,
  getEntryTypeIcon,
  getEntryTypeBadgeVariant,
  withRetry,
} from '../competitive';
import type { ThreatLevel, CompetitiveEntryType } from '@/types/intelligence';

// Mock the AI client module
vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({ content: '["Trend 1", "Trend 2"]' }),
  })),
}));

describe('getThreatLevelColor', () => {
  it('should return correct colors for each threat level', () => {
    expect(getThreatLevelColor(5)).toBe('text-error');
    expect(getThreatLevelColor(4)).toBe('text-warning');
    expect(getThreatLevelColor(3)).toBe('text-near-cyan-500');
    expect(getThreatLevelColor(2)).toBe('text-success');
    expect(getThreatLevelColor(1)).toBe('text-text-muted');
  });
});

describe('getThreatLevelBgColor', () => {
  it('should return correct background colors for each threat level', () => {
    expect(getThreatLevelBgColor(5)).toBe('bg-error/10');
    expect(getThreatLevelBgColor(4)).toBe('bg-warning/10');
    expect(getThreatLevelBgColor(3)).toBe('bg-near-cyan-500/10');
    expect(getThreatLevelBgColor(2)).toBe('bg-success/10');
    expect(getThreatLevelBgColor(1)).toBe('bg-surface');
  });
});

describe('getThreatLevelLabel', () => {
  it('should return correct labels for each threat level', () => {
    expect(getThreatLevelLabel(5)).toBe('Critical');
    expect(getThreatLevelLabel(4)).toBe('High');
    expect(getThreatLevelLabel(3)).toBe('Medium');
    expect(getThreatLevelLabel(2)).toBe('Low');
    expect(getThreatLevelLabel(1)).toBe('Minimal');
  });
});

describe('getEntryTypeIcon', () => {
  it('should return correct icon names for each entry type', () => {
    expect(getEntryTypeIcon('funding')).toBe('DollarSign');
    expect(getEntryTypeIcon('launch')).toBe('Rocket');
    expect(getEntryTypeIcon('partnership')).toBe('Handshake');
    expect(getEntryTypeIcon('news')).toBe('Newspaper');
    expect(getEntryTypeIcon('grant')).toBe('Award');
  });
});

describe('getEntryTypeBadgeVariant', () => {
  it('should return correct badge variants for each entry type', () => {
    expect(getEntryTypeBadgeVariant('funding')).toBe('success');
    expect(getEntryTypeBadgeVariant('launch')).toBe('default');
    expect(getEntryTypeBadgeVariant('partnership')).toBe('secondary');
    expect(getEntryTypeBadgeVariant('news')).toBe('outline');
    expect(getEntryTypeBadgeVariant('grant')).toBe('warning');
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, 3, 1);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(withRetry(fn, 3, 1)).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const fn = vi.fn().mockRejectedValue(abortError);

    await expect(withRetry(fn, 3, 1)).rejects.toThrow('Aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately with an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('should not run');

    await expect(withRetry(fn, 3, 1, controller.signal)).rejects.toThrow('Aborted');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should accept optional signal parameter without breaking existing calls', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 1, undefined);
    expect(result).toBe('ok');
  });
});

describe('analyzeCompetitiveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call AI client with correct parameters', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: 'This is a strategic insight about the competitor.',
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { analyzeCompetitiveEntry } = await import('../competitive');

    const entry = {
      competitorId: 'comp-1',
      type: 'funding' as CompetitiveEntryType,
      title: 'Series A',
      description: 'Raised $10M',
      date: '2024-01-15',
      relevance: 85,
      isManual: true,
    };

    const competitor = {
      id: 'comp-1',
      name: 'Test Corp',
      description: 'A rival project',
      categories: ['DeFi'],
      threatLevel: 4 as ThreatLevel,
      addedAt: Date.now(),
    };

    const result = await analyzeCompetitiveEntry(entry, competitor);

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result).toBe('This is a strategic insight about the competitor.');
  });

  it('should include project context in prompt when provided', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: 'Insight with project context.',
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { analyzeCompetitiveEntry } = await import('../competitive');

    const entry = {
      competitorId: 'comp-1',
      type: 'funding' as CompetitiveEntryType,
      title: 'Series A',
      description: 'Raised $10M',
      date: '2024-01-15',
      relevance: 85,
      isManual: true,
    };

    const competitor = {
      id: 'comp-1',
      name: 'Test Corp',
      description: 'A rival',
      categories: ['DeFi'],
      threatLevel: 3 as ThreatLevel,
      addedAt: Date.now(),
    };

    await analyzeCompetitiveEntry(entry, competitor, {}, {
      projectName: 'My Project',
      projectDescription: 'A DeFi platform',
    });

    // The system message should contain the project name
    const systemMessage = mockChat.mock.calls[0]?.[0]?.[0]?.content as string;
    expect(systemMessage).toContain('My Project');
  });
});

describe('generateCompetitiveSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate summary with correct structure', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: '["Increasing DeFi competition", "New funding rounds detected"]',
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { generateCompetitiveSummary } = await import('../competitive');

    const competitors = [
      {
        id: 'comp-1',
        name: 'Test Corp',
        description: 'A rival',
        categories: ['DeFi'],
        threatLevel: 3 as ThreatLevel,
        addedAt: Date.now(),
      },
    ];

    const entries = [
      {
        id: 'entry-1',
        competitorId: 'comp-1',
        type: 'funding' as CompetitiveEntryType,
        title: 'Series A',
        description: 'Raised $10M',
        date: '2024-01-15',
        relevance: 85,
        amount: 10_000_000,
        isManual: true,
        createdAt: Date.now(), // Recent
      },
    ];

    const summary = await generateCompetitiveSummary(competitors, entries);

    expect(summary.totalCompetitors).toBe(1);
    expect(summary.recentEntries).toBe(1);
    // Now sums amounts instead of counting
    expect(summary.totalFundingTracked).toBe(10_000_000);
    expect(summary.trends).toBeInstanceOf(Array);
    expect(summary.generatedAt).toBeGreaterThan(0);
  });

  it('should sum funding amounts from entries with amount field', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    vi.mocked(getAIClient).mockReturnValue({
      chat: vi.fn().mockResolvedValue({ content: '["Trend"]' }),
    } as any);

    const { generateCompetitiveSummary } = await import('../competitive');

    const competitors = [
      {
        id: 'comp-1',
        name: 'Test',
        description: 'Test',
        categories: [],
        threatLevel: 1 as ThreatLevel,
        addedAt: Date.now(),
      },
    ];

    const entries = [
      {
        id: 'entry-1',
        competitorId: 'comp-1',
        type: 'funding' as CompetitiveEntryType,
        title: 'Round A',
        description: 'A round',
        date: '2024-01-15',
        relevance: 50,
        amount: 5_000_000,
        isManual: true,
        createdAt: Date.now(),
      },
      {
        id: 'entry-2',
        competitorId: 'comp-1',
        type: 'funding' as CompetitiveEntryType,
        title: 'Round B',
        description: 'B round',
        date: '2024-02-15',
        relevance: 60,
        amount: 15_000_000,
        isManual: true,
        createdAt: Date.now(),
      },
      {
        id: 'entry-3',
        competitorId: 'comp-1',
        type: 'news' as CompetitiveEntryType,
        title: 'News item',
        description: 'Not funding',
        date: '2024-03-01',
        relevance: 30,
        isManual: true,
        createdAt: Date.now(),
      },
    ];

    const summary = await generateCompetitiveSummary(competitors, entries);

    // Should sum only funding entries: 5M + 15M = 20M
    expect(summary.totalFundingTracked).toBe(20_000_000);
  });

  it('should handle empty entries', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    vi.mocked(getAIClient).mockReturnValue({
      chat: vi.fn().mockResolvedValue({ content: '[]' }),
    } as any);

    const { generateCompetitiveSummary } = await import('../competitive');

    const competitors = [
      {
        id: 'comp-1',
        name: 'Test',
        description: 'Test',
        categories: [],
        threatLevel: 1 as ThreatLevel,
        addedAt: Date.now(),
      },
    ];

    const summary = await generateCompetitiveSummary(competitors, []);

    expect(summary.totalCompetitors).toBe(1);
    expect(summary.recentEntries).toBe(0);
    expect(summary.totalFundingTracked).toBe(0);
    expect(summary.trends).toContain('No recent competitive activity to analyze.');
  });
});
