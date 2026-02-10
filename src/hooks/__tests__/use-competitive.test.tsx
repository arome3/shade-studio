/**
 * Tests for the useCompetitive hook.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitive } from '../use-competitive';
import { useCompetitiveStore } from '@/stores/competitive-store';
import type { ThreatLevel } from '@/types/intelligence';

// Mock wallet hook
vi.mock('../use-wallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    accountId: 'test.near',
  })),
}));

// Mock projects store
vi.mock('@/stores/projects-store', () => ({
  useCurrentProject: vi.fn(() => null),
}));

// Mock AI analysis functions
vi.mock('@/lib/intelligence/competitive', () => ({
  analyzeCompetitiveEntry: vi.fn().mockResolvedValue('AI-generated insight'),
  generateCompetitiveSummary: vi.fn().mockResolvedValue({
    totalCompetitors: 1,
    recentEntries: 0,
    totalFundingTracked: 0,
    trends: ['Test trend'],
    generatedAt: Date.now(),
  }),
  getThreatLevelColor: vi.fn(() => 'text-near-cyan-500'),
  getThreatLevelBgColor: vi.fn(() => 'bg-near-cyan-500/10'),
  getThreatLevelLabel: vi.fn(() => 'Medium'),
  getEntryTypeIcon: vi.fn(() => 'DollarSign'),
  getEntryTypeBadgeVariant: vi.fn(() => 'success'),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-01'),
}));

describe('useCompetitive', () => {
  beforeEach(() => {
    useCompetitiveStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return empty state initially', () => {
      const { result } = renderHook(() => useCompetitive());

      expect(result.current.competitors).toEqual([]);
      expect(result.current.entries).toEqual([]);
      expect(result.current.summary).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('addCompetitor', () => {
    it('should add a competitor to the store', () => {
      const { result } = renderHook(() => useCompetitive());

      act(() => {
        result.current.addCompetitor({
          name: 'New Competitor',
          description: 'Test description',
          categories: ['DeFi'],
          threatLevel: 3 as ThreatLevel,
        });
      });

      expect(result.current.competitors).toHaveLength(1);
      expect(result.current.competitors[0]?.name).toBe('New Competitor');
      expect(result.current.competitors[0]?.id).toBe('test-id-01');
    });
  });

  describe('removeCompetitor', () => {
    it('should remove a competitor', () => {
      const { result } = renderHook(() => useCompetitive());

      act(() => {
        result.current.addCompetitor({
          name: 'To Remove',
          description: 'Will be removed',
          categories: [],
          threatLevel: 1 as ThreatLevel,
        });
      });

      const competitorId = result.current.competitors[0]?.id;

      act(() => {
        if (competitorId) {
          result.current.removeCompetitor(competitorId);
        }
      });

      expect(result.current.competitors).toHaveLength(0);
    });
  });

  describe('addEntry', () => {
    it('should add an entry and trigger AI analysis', async () => {
      const { analyzeCompetitiveEntry } = await import(
        '@/lib/intelligence/competitive'
      );

      // Pre-populate a competitor
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-1',
          name: 'Test Corp',
          description: 'Rival',
          categories: ['DeFi'],
          threatLevel: 3,
          addedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      await act(async () => {
        await result.current.addEntry({
          competitorId: 'comp-1',
          type: 'funding',
          title: 'Series A',
          description: 'Raised $10M',
          date: '2024-01-15',
          relevance: 85,
        });
      });

      expect(result.current.entries).toHaveLength(1);
      expect(analyzeCompetitiveEntry).toHaveBeenCalled();
    });

    it('should pass amount field for funding entries', async () => {
      // Pre-populate a competitor
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-1',
          name: 'Test Corp',
          description: 'Rival',
          categories: ['DeFi'],
          threatLevel: 3,
          addedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      await act(async () => {
        await result.current.addEntry({
          competitorId: 'comp-1',
          type: 'funding',
          title: 'Series B',
          description: 'Raised $50M',
          date: '2024-06-15',
          relevance: 90,
          amount: 50_000_000,
        });
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]?.amount).toBe(50_000_000);
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry', () => {
      // Pre-populate an entry
      act(() => {
        useCompetitiveStore.getState().addEntry({
          id: 'entry-1',
          competitorId: 'comp-1',
          type: 'funding',
          title: 'Original Title',
          description: 'Desc',
          date: '2024-01-15',
          relevance: 50,
          isManual: true,
          createdAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      act(() => {
        result.current.updateEntry('entry-1', { title: 'Updated Title' });
      });

      expect(result.current.entries[0]?.title).toBe('Updated Title');
    });
  });

  describe('getCompetitorEntries', () => {
    it('should filter entries by competitor ID', () => {
      // Pre-populate entries
      act(() => {
        useCompetitiveStore.getState().addEntry({
          id: 'entry-1',
          competitorId: 'comp-1',
          type: 'funding',
          title: 'Entry 1',
          description: 'Desc',
          date: '2024-01-15',
          relevance: 50,
          isManual: true,
          createdAt: Date.now(),
        });
        useCompetitiveStore.getState().addEntry({
          id: 'entry-2',
          competitorId: 'comp-2',
          type: 'news',
          title: 'Entry 2',
          description: 'Desc',
          date: '2024-01-16',
          relevance: 40,
          isManual: true,
          createdAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      const comp1Entries = result.current.getCompetitorEntries('comp-1');
      expect(comp1Entries).toHaveLength(1);
      expect(comp1Entries[0]?.id).toBe('entry-1');
    });
  });

  describe('refreshSummary', () => {
    it('should generate and store summary', async () => {
      // Pre-populate a competitor
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-1',
          name: 'Test Corp',
          description: 'Rival',
          categories: ['DeFi'],
          threatLevel: 3,
          addedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      await act(async () => {
        await result.current.refreshSummary();
      });

      expect(result.current.summary).toBeDefined();
      expect(result.current.summary?.totalCompetitors).toBe(1);
      expect(result.current.summary?.trends).toContain('Test trend');
    });

    it('should set error when no competitors exist', async () => {
      const { result } = renderHook(() => useCompetitive());

      await act(async () => {
        await result.current.refreshSummary();
      });

      expect(result.current.error).toBe(
        'Add competitors before generating a summary.'
      );
    });

    it('should handle AI failure gracefully', async () => {
      const { generateCompetitiveSummary } = await import(
        '@/lib/intelligence/competitive'
      );
      vi.mocked(generateCompetitiveSummary).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      // Pre-populate a competitor
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-1',
          name: 'Test Corp',
          description: 'Rival',
          categories: ['DeFi'],
          threatLevel: 3,
          addedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      await act(async () => {
        await result.current.refreshSummary();
      });

      expect(result.current.error).toBe('AI service unavailable');
    });
  });

  describe('exportData', () => {
    it('should return valid export data shape from store', () => {
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-1',
          name: 'Test',
          description: 'Test',
          categories: [],
          threatLevel: 1,
          addedAt: Date.now(),
        });
      });

      const exported = useCompetitiveStore.getState().exportData();
      expect(exported).toHaveProperty('competitors');
      expect(exported).toHaveProperty('entries');
      expect(exported).toHaveProperty('summary');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported.competitors['comp-1']).toBeDefined();
    });
  });

  describe('importData', () => {
    it('should merge imported data without overwriting existing entries', async () => {
      // Pre-populate an existing competitor
      act(() => {
        useCompetitiveStore.getState().addCompetitor({
          id: 'comp-existing',
          name: 'Existing Comp',
          description: 'Already here',
          categories: ['DAO'],
          threatLevel: 2,
          addedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useCompetitive());

      const importJson = JSON.stringify({
        competitors: {
          'comp-existing': {
            id: 'comp-existing',
            name: 'Should Not Overwrite',
            description: 'Nope',
            categories: [],
            threatLevel: 5,
            addedAt: Date.now(),
          },
          'comp-new': {
            id: 'comp-new',
            name: 'New Import',
            description: 'Fresh import',
            categories: ['DeFi'],
            threatLevel: 3,
            addedAt: Date.now(),
          },
        },
        entries: {
          'entry-new': {
            id: 'entry-new',
            competitorId: 'comp-new',
            type: 'funding',
            title: 'Imported Entry',
            description: 'Imported',
            date: '2024-01-01',
            relevance: 50,
            isManual: true,
            createdAt: Date.now(),
          },
        },
      });

      const file = new File([importJson], 'data.json', {
        type: 'application/json',
      });
      // jsdom File doesn't have .text() — polyfill it
      file.text = () => Promise.resolve(importJson);

      let counts: { competitors: number; entries: number } | undefined;
      await act(async () => {
        counts = await result.current.importData(file);
      });

      // Should have added 1 new competitor (not overwritten the existing one)
      expect(counts?.competitors).toBe(1);
      expect(counts?.entries).toBe(1);

      // Existing competitor should keep original name
      const state = useCompetitiveStore.getState();
      expect(state.competitors['comp-existing']?.name).toBe('Existing Comp');
      expect(state.competitors['comp-new']?.name).toBe('New Import');
    });

    it('should reject invalid import data', async () => {
      const { result } = renderHook(() => useCompetitive());

      const badJson = '{"invalid": true}';
      const badFile = new File([badJson], 'bad.json', {
        type: 'application/json',
      });
      badFile.text = () => Promise.resolve(badJson);

      await expect(
        act(async () => {
          await result.current.importData(badFile);
        })
      ).rejects.toThrow('Invalid import file');
    });
  });
});
