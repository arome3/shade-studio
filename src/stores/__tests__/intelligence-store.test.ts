/**
 * Tests for the intelligence store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useIntelligenceStore,
  useCurrentBriefing,
  useIsBriefingLoading,
  usePendingItemsCount,
} from '../intelligence-store';
import type { DailyBriefing } from '@/types/intelligence';

// Mock briefing for testing
const createMockBriefing = (overrides: Partial<DailyBriefing> = {}): DailyBriefing => ({
  id: 'test-briefing-123',
  accountId: 'test.near',
  date: new Date().toISOString().split('T')[0] ?? '2024-01-15',
  greeting: 'Good morning!',
  summary: 'Test summary',
  items: [
    {
      id: 'item-1',
      title: 'Test Item',
      description: 'Test description',
      type: 'action-required',
      priority: 'high',
      isRead: false,
      isDismissed: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ],
  metrics: {
    activeProjects: 1,
    pendingProposals: 2,
    upcomingDeadlines: 3,
    actionRequired: 1,
    totalFundingRequested: 10000,
    totalFundingReceived: 5000,
  },
  sentiment: 'neutral',
  generatedAt: new Date().toISOString(),
  ...overrides,
});

describe('useIntelligenceStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useIntelligenceStore.getState().reset();
  });

  describe('setBriefing', () => {
    it('should set the current briefing', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
      });

      const state = useIntelligenceStore.getState();
      expect(state.currentBriefing).toEqual(mockBriefing);
      expect(state.isLoading).toBe(false);
      expect(state.generationProgress).toBe(100);
    });

    it('should add briefing to history', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
      });

      const state = useIntelligenceStore.getState();
      expect(state.briefingHistory[mockBriefing.date]).toEqual(mockBriefing);
    });

    it('should update lastGeneratedAt timestamp', () => {
      const beforeTime = Date.now();
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
      });

      const state = useIntelligenceStore.getState();
      expect(state.lastGeneratedAt).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('updateItemStatus', () => {
    it('should update item status', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
        useIntelligenceStore.getState().updateItemStatus('item-1', 'completed');
      });

      const state = useIntelligenceStore.getState();
      const item = state.currentBriefing?.items.find((i) => i.id === 'item-1');
      expect(item?.status).toBe('completed');
      expect(item?.isRead).toBe(true);
    });

    it('should update briefing in history too', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
        useIntelligenceStore.getState().updateItemStatus('item-1', 'in_progress');
      });

      const state = useIntelligenceStore.getState();
      const historyItem = state.briefingHistory[mockBriefing.date]?.items.find(
        (i) => i.id === 'item-1'
      );
      expect(historyItem?.status).toBe('in_progress');
    });
  });

  describe('dismissItem', () => {
    it('should mark item as dismissed', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
        useIntelligenceStore.getState().dismissItem('item-1');
      });

      const state = useIntelligenceStore.getState();
      const item = state.currentBriefing?.items.find((i) => i.id === 'item-1');
      expect(item?.isDismissed).toBe(true);
    });
  });

  describe('isBriefingStale', () => {
    it('should return true when no briefing exists', () => {
      const result = useIntelligenceStore.getState().isBriefingStale();
      expect(result).toBe(true);
    });

    it('should return true when briefing is from different date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockBriefing = createMockBriefing({
        date: yesterday.toISOString().split('T')[0],
      });

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
      });

      const result = useIntelligenceStore.getState().isBriefingStale();
      expect(result).toBe(true);
    });

    it('should return false for fresh same-day briefing', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
      });

      const result = useIntelligenceStore.getState().isBriefingStale();
      expect(result).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should set loading state correctly', () => {
      act(() => {
        useIntelligenceStore.getState().setLoading(true);
      });

      expect(useIntelligenceStore.getState().isLoading).toBe(true);
      expect(useIntelligenceStore.getState().error).toBeNull();
      expect(useIntelligenceStore.getState().generationProgress).toBe(0);
    });

    it('should update generation progress', () => {
      act(() => {
        useIntelligenceStore.getState().setGenerationProgress(50);
      });

      expect(useIntelligenceStore.getState().generationProgress).toBe(50);
    });

    it('should clamp progress to 0-100', () => {
      act(() => {
        useIntelligenceStore.getState().setGenerationProgress(150);
      });
      expect(useIntelligenceStore.getState().generationProgress).toBe(100);

      act(() => {
        useIntelligenceStore.getState().setGenerationProgress(-10);
      });
      expect(useIntelligenceStore.getState().generationProgress).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should set error and clear loading', () => {
      act(() => {
        useIntelligenceStore.getState().setLoading(true);
        useIntelligenceStore.getState().setError('Test error');
      });

      const state = useIntelligenceStore.getState();
      expect(state.error).toBe('Test error');
      expect(state.isLoading).toBe(false);
    });

    it('should clear error', () => {
      act(() => {
        useIntelligenceStore.getState().setError('Test error');
        useIntelligenceStore.getState().clearError();
      });

      expect(useIntelligenceStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const mockBriefing = createMockBriefing();

      act(() => {
        useIntelligenceStore.getState().setBriefing(mockBriefing);
        useIntelligenceStore.getState().setError('Some error');
        useIntelligenceStore.getState().reset();
      });

      const state = useIntelligenceStore.getState();
      expect(state.currentBriefing).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});

describe('selector hooks', () => {
  beforeEach(() => {
    useIntelligenceStore.getState().reset();
  });

  it('useCurrentBriefing should return current briefing', () => {
    const mockBriefing = createMockBriefing();

    act(() => {
      useIntelligenceStore.getState().setBriefing(mockBriefing);
    });

    const { result } = renderHook(() => useCurrentBriefing());
    expect(result.current).toEqual(mockBriefing);
  });

  it('useIsBriefingLoading should return loading state', () => {
    act(() => {
      useIntelligenceStore.getState().setLoading(true);
    });

    const { result } = renderHook(() => useIsBriefingLoading());
    expect(result.current).toBe(true);
  });

  it('usePendingItemsCount should count pending non-dismissed items', () => {
    const mockBriefing = createMockBriefing({
      items: [
        {
          id: '1',
          title: 'Pending',
          description: 'Desc',
          type: 'action-required',
          priority: 'high',
          isRead: false,
          isDismissed: false,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Completed',
          description: 'Desc',
          type: 'update',
          priority: 'low',
          isRead: true,
          isDismissed: false,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'Dismissed',
          description: 'Desc',
          type: 'news',
          priority: 'medium',
          isRead: false,
          isDismissed: true,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    act(() => {
      useIntelligenceStore.getState().setBriefing(mockBriefing);
    });

    const { result } = renderHook(() => usePendingItemsCount());
    expect(result.current).toBe(1); // Only the first item is pending and not dismissed
  });
});
