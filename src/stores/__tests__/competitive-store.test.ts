/**
 * Tests for the competitive store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useCompetitiveStore,
  useCompetitorsRecord,
  useEntriesRecord,
  useCompetitiveSummary,
  useCompetitiveLoading,
  useCompetitiveError,
} from '../competitive-store';
import type {
  Competitor,
  CompetitiveEntry,
  CompetitiveSummary,
} from '@/types/intelligence';

// Mock competitor for testing
const createMockCompetitor = (
  overrides: Partial<Competitor> = {}
): Competitor => ({
  id: 'comp-1',
  name: 'Test Competitor',
  description: 'A test competitor',
  categories: ['DeFi', 'DAO'],
  threatLevel: 3,
  addedAt: Date.now(),
  ...overrides,
});

// Mock entry for testing
const createMockEntry = (
  overrides: Partial<CompetitiveEntry> = {}
): CompetitiveEntry => ({
  id: 'entry-1',
  competitorId: 'comp-1',
  type: 'funding',
  title: 'Test Funding Round',
  description: 'Raised $10M Series A',
  date: '2024-01-15',
  relevance: 85,
  isManual: true,
  createdAt: Date.now(),
  ...overrides,
});

describe('useCompetitiveStore', () => {
  beforeEach(() => {
    useCompetitiveStore.getState().reset();
  });

  describe('addCompetitor', () => {
    it('should add a competitor', () => {
      const competitor = createMockCompetitor();

      act(() => {
        useCompetitiveStore.getState().addCompetitor(competitor);
      });

      const state = useCompetitiveStore.getState();
      expect(state.competitors['comp-1']).toEqual(competitor);
    });

    it('should add multiple competitors', () => {
      const comp1 = createMockCompetitor({ id: 'comp-1', name: 'Competitor 1' });
      const comp2 = createMockCompetitor({ id: 'comp-2', name: 'Competitor 2' });

      act(() => {
        useCompetitiveStore.getState().addCompetitor(comp1);
        useCompetitiveStore.getState().addCompetitor(comp2);
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.competitors)).toHaveLength(2);
    });
  });

  describe('updateCompetitor', () => {
    it('should update an existing competitor', () => {
      const competitor = createMockCompetitor();

      act(() => {
        useCompetitiveStore.getState().addCompetitor(competitor);
        useCompetitiveStore.getState().updateCompetitor('comp-1', {
          name: 'Updated Name',
          threatLevel: 5,
        });
      });

      const state = useCompetitiveStore.getState();
      expect(state.competitors['comp-1']?.name).toBe('Updated Name');
      expect(state.competitors['comp-1']?.threatLevel).toBe(5);
      // Other fields should remain unchanged
      expect(state.competitors['comp-1']?.description).toBe('A test competitor');
    });

    it('should not modify state for non-existent competitor', () => {
      act(() => {
        useCompetitiveStore.getState().updateCompetitor('non-existent', {
          name: 'Nope',
        });
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.competitors)).toHaveLength(0);
    });
  });

  describe('removeCompetitor', () => {
    it('should remove a competitor', () => {
      const competitor = createMockCompetitor();

      act(() => {
        useCompetitiveStore.getState().addCompetitor(competitor);
        useCompetitiveStore.getState().removeCompetitor('comp-1');
      });

      const state = useCompetitiveStore.getState();
      expect(state.competitors['comp-1']).toBeUndefined();
    });

    it('should cascade delete associated entries', () => {
      const competitor = createMockCompetitor();
      const entry1 = createMockEntry({ id: 'entry-1', competitorId: 'comp-1' });
      const entry2 = createMockEntry({ id: 'entry-2', competitorId: 'comp-1' });
      const entry3 = createMockEntry({ id: 'entry-3', competitorId: 'comp-2' });

      act(() => {
        useCompetitiveStore.getState().addCompetitor(competitor);
        useCompetitiveStore.getState().addEntry(entry1);
        useCompetitiveStore.getState().addEntry(entry2);
        useCompetitiveStore.getState().addEntry(entry3);
        useCompetitiveStore.getState().removeCompetitor('comp-1');
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.entries)).toHaveLength(1);
      expect(state.entries['entry-3']).toBeDefined();
      expect(state.entries['entry-1']).toBeUndefined();
      expect(state.entries['entry-2']).toBeUndefined();
    });
  });

  describe('addEntry', () => {
    it('should add an entry', () => {
      const entry = createMockEntry();

      act(() => {
        useCompetitiveStore.getState().addEntry(entry);
      });

      const state = useCompetitiveStore.getState();
      expect(state.entries['entry-1']).toEqual(entry);
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry', () => {
      const entry = createMockEntry();

      act(() => {
        useCompetitiveStore.getState().addEntry(entry);
        useCompetitiveStore.getState().updateEntry('entry-1', {
          title: 'Updated Title',
          relevance: 95,
        });
      });

      const state = useCompetitiveStore.getState();
      expect(state.entries['entry-1']?.title).toBe('Updated Title');
      expect(state.entries['entry-1']?.relevance).toBe(95);
      // Other fields should remain unchanged
      expect(state.entries['entry-1']?.description).toBe('Raised $10M Series A');
    });

    it('should not modify state for non-existent entry', () => {
      act(() => {
        useCompetitiveStore.getState().updateEntry('non-existent', {
          title: 'Nope',
        });
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.entries)).toHaveLength(0);
    });
  });

  describe('removeEntry', () => {
    it('should remove an entry', () => {
      const entry = createMockEntry();

      act(() => {
        useCompetitiveStore.getState().addEntry(entry);
        useCompetitiveStore.getState().removeEntry('entry-1');
      });

      const state = useCompetitiveStore.getState();
      expect(state.entries['entry-1']).toBeUndefined();
    });
  });

  describe('exportData', () => {
    it('should return correct shape with competitors, entries, summary, and exportedAt', () => {
      const competitor = createMockCompetitor();
      const entry = createMockEntry();
      const summary: CompetitiveSummary = {
        totalCompetitors: 1,
        recentEntries: 1,
        totalFundingTracked: 10000000,
        trends: ['Trend 1'],
        generatedAt: Date.now(),
      };

      act(() => {
        useCompetitiveStore.getState().addCompetitor(competitor);
        useCompetitiveStore.getState().addEntry(entry);
        useCompetitiveStore.getState().setSummary(summary);
      });

      const exported = useCompetitiveStore.getState().exportData();

      expect(exported.competitors).toBeDefined();
      expect(exported.competitors['comp-1']).toEqual(competitor);
      expect(exported.entries).toBeDefined();
      expect(exported.entries['entry-1']).toEqual(entry);
      expect(exported.summary).toEqual(summary);
      expect(exported.exportedAt).toBeGreaterThan(0);
    });
  });

  describe('importData', () => {
    it('should merge new competitors and entries', () => {
      const existing = createMockCompetitor({ id: 'comp-existing' });

      act(() => {
        useCompetitiveStore.getState().addCompetitor(existing);
      });

      const importPayload = {
        competitors: {
          'comp-new': createMockCompetitor({ id: 'comp-new', name: 'New Comp' }),
        },
        entries: {
          'entry-new': createMockEntry({ id: 'entry-new', competitorId: 'comp-new' }),
        },
      };

      act(() => {
        useCompetitiveStore.getState().importData(importPayload);
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.competitors)).toHaveLength(2);
      expect(state.competitors['comp-existing']).toBeDefined();
      expect(state.competitors['comp-new']?.name).toBe('New Comp');
      expect(Object.keys(state.entries)).toHaveLength(1);
    });

    it('should skip competitors and entries with existing IDs', () => {
      const existing = createMockCompetitor({ id: 'comp-1', name: 'Original Name' });
      const existingEntry = createMockEntry({ id: 'entry-1', title: 'Original Title' });

      act(() => {
        useCompetitiveStore.getState().addCompetitor(existing);
        useCompetitiveStore.getState().addEntry(existingEntry);
      });

      const importPayload = {
        competitors: {
          'comp-1': createMockCompetitor({ id: 'comp-1', name: 'Overwritten Name' }),
        },
        entries: {
          'entry-1': createMockEntry({ id: 'entry-1', title: 'Overwritten Title' }),
        },
      };

      act(() => {
        useCompetitiveStore.getState().importData(importPayload);
      });

      const state = useCompetitiveStore.getState();
      // Should keep original values, not overwrite
      expect(state.competitors['comp-1']?.name).toBe('Original Name');
      expect(state.entries['entry-1']?.title).toBe('Original Title');
    });
  });

  describe('setSummary', () => {
    it('should set the summary', () => {
      const summary: CompetitiveSummary = {
        totalCompetitors: 5,
        recentEntries: 12,
        totalFundingTracked: 3,
        trends: ['Trend 1', 'Trend 2'],
        generatedAt: Date.now(),
      };

      act(() => {
        useCompetitiveStore.getState().setSummary(summary);
      });

      const state = useCompetitiveStore.getState();
      expect(state.summary).toEqual(summary);
    });
  });

  describe('loading state', () => {
    it('should set loading and clear error', () => {
      act(() => {
        useCompetitiveStore.getState().setError('Some error');
        useCompetitiveStore.getState().setLoading(true);
      });

      const state = useCompetitiveStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set analyzing state', () => {
      act(() => {
        useCompetitiveStore.getState().setAnalyzing(true);
      });

      expect(useCompetitiveStore.getState().isAnalyzing).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should set error and clear loading/analyzing', () => {
      act(() => {
        useCompetitiveStore.getState().setLoading(true);
        useCompetitiveStore.getState().setAnalyzing(true);
        useCompetitiveStore.getState().setError('Test error');
      });

      const state = useCompetitiveStore.getState();
      expect(state.error).toBe('Test error');
      expect(state.isLoading).toBe(false);
      expect(state.isAnalyzing).toBe(false);
    });

    it('should clear error', () => {
      act(() => {
        useCompetitiveStore.getState().setError('Test error');
        useCompetitiveStore.getState().clearError();
      });

      expect(useCompetitiveStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useCompetitiveStore.getState().addCompetitor(createMockCompetitor());
        useCompetitiveStore.getState().addEntry(createMockEntry());
        useCompetitiveStore.getState().setError('Error');
        useCompetitiveStore.getState().reset();
      });

      const state = useCompetitiveStore.getState();
      expect(Object.keys(state.competitors)).toHaveLength(0);
      expect(Object.keys(state.entries)).toHaveLength(0);
      expect(state.summary).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});

describe('selector hooks', () => {
  beforeEach(() => {
    useCompetitiveStore.getState().reset();
  });

  it('useCompetitorsRecord should return competitors record', () => {
    const comp1 = createMockCompetitor({ id: 'comp-1', addedAt: 100 });
    const comp2 = createMockCompetitor({ id: 'comp-2', addedAt: 200 });

    act(() => {
      useCompetitiveStore.getState().addCompetitor(comp1);
      useCompetitiveStore.getState().addCompetitor(comp2);
    });

    const { result } = renderHook(() => useCompetitorsRecord());
    expect(Object.keys(result.current)).toHaveLength(2);
    expect(result.current['comp-1']).toEqual(comp1);
    expect(result.current['comp-2']).toEqual(comp2);
  });

  it('useEntriesRecord should return entries record', () => {
    const entry1 = createMockEntry({ id: 'entry-1', createdAt: 100 });
    const entry2 = createMockEntry({ id: 'entry-2', createdAt: 200 });

    act(() => {
      useCompetitiveStore.getState().addEntry(entry1);
      useCompetitiveStore.getState().addEntry(entry2);
    });

    const { result } = renderHook(() => useEntriesRecord());
    expect(Object.keys(result.current)).toHaveLength(2);
    expect(result.current['entry-1']).toEqual(entry1);
  });

  it('useCompetitiveSummary should return summary', () => {
    const summary: CompetitiveSummary = {
      totalCompetitors: 3,
      recentEntries: 5,
      totalFundingTracked: 2,
      trends: ['Test trend'],
      generatedAt: Date.now(),
    };

    act(() => {
      useCompetitiveStore.getState().setSummary(summary);
    });

    const { result } = renderHook(() => useCompetitiveSummary());
    expect(result.current).toEqual(summary);
  });

  it('useCompetitiveLoading should return loading state', () => {
    act(() => {
      useCompetitiveStore.getState().setLoading(true);
    });

    const { result } = renderHook(() => useCompetitiveLoading());
    expect(result.current).toBe(true);
  });

  it('useCompetitiveError should return error', () => {
    act(() => {
      useCompetitiveStore.getState().setError('Test error');
    });

    const { result } = renderHook(() => useCompetitiveError());
    expect(result.current).toBe('Test error');
  });
});
