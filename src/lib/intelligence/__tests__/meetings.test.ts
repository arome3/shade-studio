/**
 * Tests for the meeting notes pipeline utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterMeetings,
  calculateMeetingStats,
  exportMeetingsToMarkdown,
  getMeetingTypeBadgeVariant,
  getMeetingTypeLabel,
  getActionPriorityBadgeVariant,
  getActionPriorityLabel,
  getActionStatusBadgeVariant,
  getActionStatusLabel,
} from '../meetings';
import type { Meeting } from '@/types/intelligence';

// Mock the AI client module
vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Test summary',
        actionItems: [
          {
            description: 'Follow up with team',
            assignee: 'Alice',
            dueDate: '2024-07-01',
            priority: 'high',
          },
        ],
        decisions: ['Approved new budget'],
        followUpNeeded: true,
        suggestedFollowUpDate: '2024-07-15',
      }),
    }),
  })),
}));

// Helper to create a mock meeting
const createMockMeeting = (
  overrides: Partial<Meeting> = {}
): Meeting => ({
  id: 'mtg-1',
  title: 'Sprint Planning',
  type: 'team',
  date: '2024-06-15',
  duration: 60,
  attendees: ['Alice', 'Bob'],
  rawNotes: 'Discussed sprint goals and task assignments for the upcoming sprint.',
  summary: 'Team discussed sprint goals.',
  actionItems: [
    {
      id: 'ai-1',
      description: 'Create sprint board',
      assignee: 'Alice',
      dueDate: '2024-06-17',
      priority: 'high',
      status: 'pending',
    },
    {
      id: 'ai-2',
      description: 'Review backlog',
      priority: 'medium',
      status: 'completed',
      completedAt: Date.now(),
    },
  ],
  decisions: ['Use two-week sprints'],
  followUpNeeded: true,
  followUpDate: '2024-06-22',
  tags: ['sprint', 'planning'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isProcessed: true,
  ...overrides,
});

// ============================================================================
// UI Helper Tests
// ============================================================================

describe('getMeetingTypeBadgeVariant', () => {
  it('should return correct variants for each type', () => {
    expect(getMeetingTypeBadgeVariant('team')).toBe('default');
    expect(getMeetingTypeBadgeVariant('funder')).toBe('success');
    expect(getMeetingTypeBadgeVariant('partner')).toBe('secondary');
    expect(getMeetingTypeBadgeVariant('advisor')).toBe('warning');
    expect(getMeetingTypeBadgeVariant('community')).toBe('outline');
    expect(getMeetingTypeBadgeVariant('other')).toBe('secondary');
  });
});

describe('getMeetingTypeLabel', () => {
  it('should return correct labels for each type', () => {
    expect(getMeetingTypeLabel('team')).toBe('Team');
    expect(getMeetingTypeLabel('funder')).toBe('Funder');
    expect(getMeetingTypeLabel('partner')).toBe('Partner');
    expect(getMeetingTypeLabel('advisor')).toBe('Advisor');
    expect(getMeetingTypeLabel('community')).toBe('Community');
    expect(getMeetingTypeLabel('other')).toBe('Other');
  });
});

describe('getActionPriorityBadgeVariant', () => {
  it('should return correct variants for each priority', () => {
    expect(getActionPriorityBadgeVariant('high')).toBe('error');
    expect(getActionPriorityBadgeVariant('medium')).toBe('warning');
    expect(getActionPriorityBadgeVariant('low')).toBe('outline');
  });
});

describe('getActionPriorityLabel', () => {
  it('should return correct labels for each priority', () => {
    expect(getActionPriorityLabel('high')).toBe('High');
    expect(getActionPriorityLabel('medium')).toBe('Medium');
    expect(getActionPriorityLabel('low')).toBe('Low');
  });
});

describe('getActionStatusBadgeVariant', () => {
  it('should return correct variants for each status', () => {
    expect(getActionStatusBadgeVariant('pending')).toBe('outline');
    expect(getActionStatusBadgeVariant('in_progress')).toBe('warning');
    expect(getActionStatusBadgeVariant('completed')).toBe('success');
  });
});

describe('getActionStatusLabel', () => {
  it('should return correct labels for each status', () => {
    expect(getActionStatusLabel('pending')).toBe('Pending');
    expect(getActionStatusLabel('in_progress')).toBe('In Progress');
    expect(getActionStatusLabel('completed')).toBe('Completed');
  });
});

// ============================================================================
// Filter Tests
// ============================================================================

describe('filterMeetings', () => {
  const meetings: Meeting[] = [
    createMockMeeting({
      id: 'mtg-1',
      type: 'team',
      date: '2024-06-15',
      isProcessed: true,
      tags: ['sprint'],
    }),
    createMockMeeting({
      id: 'mtg-2',
      title: 'Funder Call',
      type: 'funder',
      date: '2024-07-20',
      isProcessed: false,
      tags: ['funding'],
      attendees: ['Carol', 'Dave'],
    }),
    createMockMeeting({
      id: 'mtg-3',
      title: 'Advisory Session',
      type: 'advisor',
      date: '2024-08-10',
      isProcessed: true,
      tags: ['strategy'],
    }),
  ];

  it('should return all meetings when filter is empty', () => {
    const result = filterMeetings(meetings, {});
    expect(result).toHaveLength(3);
  });

  it('should filter by type', () => {
    const result = filterMeetings(meetings, { type: 'funder' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-2');
  });

  it('should filter by processed status', () => {
    const result = filterMeetings(meetings, { status: 'processed' });
    expect(result).toHaveLength(2);
  });

  it('should filter by unprocessed status', () => {
    const result = filterMeetings(meetings, { status: 'unprocessed' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-2');
  });

  it('should treat status "all" as no filter', () => {
    const result = filterMeetings(meetings, { status: 'all' });
    expect(result).toHaveLength(3);
  });

  it('should filter by date range', () => {
    const result = filterMeetings(meetings, {
      dateRange: { start: '2024-07-01', end: '2024-07-31' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-2');
  });

  it('should filter by search query matching title', () => {
    const result = filterMeetings(meetings, { searchQuery: 'Advisory' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-3');
  });

  it('should filter by search query matching attendees', () => {
    const result = filterMeetings(meetings, { searchQuery: 'Carol' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-2');
  });

  it('should filter by search query matching tags', () => {
    const result = filterMeetings(meetings, { searchQuery: 'strategy' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-3');
  });

  it('should apply multiple filters (AND logic)', () => {
    const result = filterMeetings(meetings, {
      type: 'team',
      status: 'processed',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('mtg-1');
  });

  it('should return empty array when no meetings match', () => {
    const result = filterMeetings(meetings, { type: 'community' });
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// Stats Tests
// ============================================================================

describe('calculateMeetingStats', () => {
  it('should calculate correct stats', () => {
    const meetings = [
      createMockMeeting({
        id: 'mtg-1',
        createdAt: Date.now(), // Recent
        actionItems: [
          {
            id: 'a1',
            description: 'Task 1',
            priority: 'high',
            status: 'pending',
          },
          {
            id: 'a2',
            description: 'Task 2',
            priority: 'medium',
            status: 'completed',
            completedAt: Date.now(),
          },
        ],
      }),
      createMockMeeting({
        id: 'mtg-2',
        createdAt: Date.now(), // Recent
        actionItems: [
          {
            id: 'a3',
            description: 'Task 3',
            priority: 'low',
            status: 'completed',
            completedAt: Date.now(),
          },
        ],
      }),
    ];

    const stats = calculateMeetingStats(meetings);

    expect(stats.recentCount).toBe(2);
    expect(stats.totalActionItems).toBe(3);
    expect(stats.pendingActionItems).toBe(1);
    expect(stats.completionRate).toBe(67); // 2/3 = 67%
  });

  it('should handle empty meetings array', () => {
    const stats = calculateMeetingStats([]);

    expect(stats.recentCount).toBe(0);
    expect(stats.totalActionItems).toBe(0);
    expect(stats.pendingActionItems).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('should handle meetings with no action items', () => {
    const meetings = [
      createMockMeeting({ actionItems: [] }),
    ];

    const stats = calculateMeetingStats(meetings);

    expect(stats.totalActionItems).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('should handle all completed action items', () => {
    const meetings = [
      createMockMeeting({
        actionItems: [
          {
            id: 'a1',
            description: 'Done',
            priority: 'high',
            status: 'completed',
            completedAt: Date.now(),
          },
        ],
      }),
    ];

    const stats = calculateMeetingStats(meetings);
    expect(stats.completionRate).toBe(100);
    expect(stats.pendingActionItems).toBe(0);
  });

  it('should not count old meetings in recentCount', () => {
    const oldTimestamp = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const meetings = [
      createMockMeeting({ createdAt: oldTimestamp, actionItems: [] }),
    ];

    const stats = calculateMeetingStats(meetings);
    expect(stats.recentCount).toBe(0);
  });
});

// ============================================================================
// Export Tests
// ============================================================================

describe('exportMeetingsToMarkdown', () => {
  it('should generate valid markdown with header and meeting details', () => {
    const meetings = [
      createMockMeeting({
        title: 'Test Meeting',
        type: 'team',
        date: '2024-06-15',
        duration: 60,
        attendees: ['Alice', 'Bob'],
        summary: 'Discussed important topics.',
        tags: ['important', 'q3'],
        isProcessed: true,
      }),
    ];

    const markdown = exportMeetingsToMarkdown(meetings);

    expect(markdown).toContain('# Meeting Notes');
    expect(markdown).toContain('Total Meetings: 1');
    expect(markdown).toContain('## Test Meeting');
    expect(markdown).toContain('**Type:** Team');
    expect(markdown).toContain('**Date:** 2024-06-15');
    expect(markdown).toContain('**Duration:** 60 min');
    expect(markdown).toContain('Alice, Bob');
    expect(markdown).toContain('important, q3');
    expect(markdown).toContain('### Summary');
    expect(markdown).toContain('Discussed important topics.');
  });

  it('should include action items with checkbox format', () => {
    const meetings = [
      createMockMeeting({
        actionItems: [
          {
            id: 'a1',
            description: 'Do the thing',
            assignee: 'Alice',
            dueDate: '2024-07-01',
            priority: 'high',
            status: 'pending',
          },
          {
            id: 'a2',
            description: 'Done thing',
            priority: 'low',
            status: 'completed',
            completedAt: Date.now(),
          },
        ],
      }),
    ];

    const markdown = exportMeetingsToMarkdown(meetings);

    expect(markdown).toContain('### Action Items');
    expect(markdown).toContain('[ ] [HIGH] Do the thing (@Alice) — due 2024-07-01');
    expect(markdown).toContain('[x] [LOW] Done thing');
  });

  it('should include decisions', () => {
    const meetings = [
      createMockMeeting({
        decisions: ['Adopted new process', 'Hired contractor'],
      }),
    ];

    const markdown = exportMeetingsToMarkdown(meetings);

    expect(markdown).toContain('### Decisions');
    expect(markdown).toContain('- Adopted new process');
    expect(markdown).toContain('- Hired contractor');
  });

  it('should include follow-up indicator', () => {
    const meetings = [
      createMockMeeting({
        followUpNeeded: true,
        followUpDate: '2024-07-01',
      }),
    ];

    const markdown = exportMeetingsToMarkdown(meetings);
    expect(markdown).toContain('**Follow-up needed**');
    expect(markdown).toContain('by 2024-07-01');
  });

  it('should handle empty meetings array', () => {
    const markdown = exportMeetingsToMarkdown([]);

    expect(markdown).toContain('# Meeting Notes');
    expect(markdown).toContain('Total Meetings: 0');
  });
});

// ============================================================================
// AI Processing Tests
// ============================================================================

describe('processMeetingNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call AI client and return structured result', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Sprint planning discussion.',
        actionItems: [
          {
            description: 'Set up board',
            assignee: 'Alice',
            dueDate: '2024-07-01',
            priority: 'high',
          },
        ],
        decisions: ['Two-week sprints'],
        followUpNeeded: true,
        suggestedFollowUpDate: '2024-07-15',
      }),
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { processMeetingNotes } = await import('../meetings');

    const result = await processMeetingNotes(
      'We discussed sprint goals and assigned tasks.',
      'team',
      ['Alice', 'Bob']
    );

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('Sprint planning discussion.');
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0]?.description).toBe('Set up board');
    expect(result.actionItems[0]?.priority).toBe('high');
    expect(result.decisions).toEqual(['Two-week sprints']);
    expect(result.followUpNeeded).toBe(true);
    expect(result.suggestedFollowUpDate).toBe('2024-07-15');
  });

  it('should include project context in prompt when provided', async () => {
    const { getAIClient } = await import('@/lib/ai/client');
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Summary',
        actionItems: [],
        decisions: [],
        followUpNeeded: false,
      }),
    });
    vi.mocked(getAIClient).mockReturnValue({
      chat: mockChat,
    } as any);

    const { processMeetingNotes } = await import('../meetings');

    await processMeetingNotes(
      'Meeting notes here',
      'funder',
      [],
      {},
      { projectName: 'DeFi Project', projectDescription: 'A lending protocol' }
    );

    const systemMessage = mockChat.mock.calls[0]?.[0]?.[0]?.content as string;
    expect(systemMessage).toContain('DeFi Project');
  });
});
