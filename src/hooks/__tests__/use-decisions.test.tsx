/**
 * Tests for the useDecisions hook.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecisions } from '../use-decisions';
import { useDecisionStore } from '@/stores/decision-store';
import type { Decision } from '@/types/intelligence';

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
vi.mock('@/lib/intelligence/decisions', () => ({
  analyzeDecision: vi.fn().mockResolvedValue('AI-generated strategic analysis'),
  filterDecisions: vi.fn((decisions: Decision[], filter: any) => {
    // Simple filter implementation for testing
    return decisions.filter((d) => {
      if (filter.category && d.category !== filter.category) return false;
      if (filter.status && d.status !== filter.status) return false;
      if (filter.outcome && d.outcome !== filter.outcome) return false;
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchable = [d.title, d.description, d.context, ...d.tags]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }),
  exportDecisionsToMarkdown: vi.fn(() => '# Decision Journal\n'),
  getCategoryLabel: vi.fn((c: string) => c),
  getOutcomeLabel: vi.fn((o: string) => o),
  getStatusLabel: vi.fn((s: string) => s),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-01'),
}));

describe('useDecisions', () => {
  beforeEach(() => {
    useDecisionStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return empty state initially', () => {
      const { result } = renderHook(() => useDecisions());

      expect(result.current.decisions).toEqual([]);
      expect(result.current.filteredDecisions).toEqual([]);
      expect(result.current.filter).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.analyzingId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('addDecision', () => {
    it('should add a decision to the store', async () => {
      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        result.current.addDecision({
          title: 'New Decision',
          description: 'Test description',
          category: 'strategic',
          context: 'Some context',
          rationale: 'Some rationale',
          expectedImpact: 'High impact',
        });
        // Allow microtasks to settle for background AI analysis
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.decisions).toHaveLength(1);
      expect(result.current.decisions[0]?.title).toBe('New Decision');
      expect(result.current.decisions[0]?.id).toBe('test-id-01');
      expect(result.current.decisions[0]?.status).toBe('proposed');
      expect(result.current.decisions[0]?.outcome).toBe('pending');
    });

    it('should trigger AI analysis after adding', async () => {
      const { analyzeDecision } = await import(
        '@/lib/intelligence/decisions'
      );

      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        result.current.addDecision({
          title: 'AI Test',
          description: 'Test',
          category: 'technical',
          context: 'Context',
          rationale: 'Rationale',
          expectedImpact: 'Impact',
        });
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(analyzeDecision).toHaveBeenCalled();
    });

    it('should use defaults for optional fields', async () => {
      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        result.current.addDecision({
          title: 'Minimal',
          description: '',
          category: 'financial',
          context: 'Why',
          rationale: 'Because',
          expectedImpact: '',
        });
        await new Promise((r) => setTimeout(r, 10));
      });

      const decision = result.current.decisions[0];
      expect(decision?.alternatives).toEqual([]);
      expect(decision?.decisionMakers).toEqual([]);
      expect(decision?.tags).toEqual([]);
    });
  });

  describe('updateDecision', () => {
    it('should update an existing decision with new updatedAt', () => {
      // Pre-populate a decision
      const now = Date.now();
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Original Title',
          description: 'Desc',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: 'Impact',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: now,
          updatedAt: now,
        });
      });

      const { result } = renderHook(() => useDecisions());

      act(() => {
        result.current.updateDecision('dec-1', { title: 'Updated Title' });
      });

      expect(result.current.decisions[0]?.title).toBe('Updated Title');
      expect(result.current.decisions[0]?.updatedAt).toBeGreaterThanOrEqual(now);
    });
  });

  describe('removeDecision', () => {
    it('should remove a decision', async () => {
      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        result.current.addDecision({
          title: 'To Remove',
          description: '',
          category: 'team',
          context: 'Context',
          rationale: 'Rationale',
          expectedImpact: '',
        });
        await new Promise((r) => setTimeout(r, 10));
      });

      const decisionId = result.current.decisions[0]?.id;

      act(() => {
        if (decisionId) {
          result.current.removeDecision(decisionId);
        }
      });

      expect(result.current.decisions).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('should update decision status', () => {
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Test',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useDecisions());

      act(() => {
        result.current.updateStatus('dec-1', 'approved');
      });

      expect(result.current.decisions[0]?.status).toBe('approved');
    });
  });

  describe('updateOutcome', () => {
    it('should update outcome with actual impact', () => {
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Test',
          description: '',
          category: 'technical',
          status: 'implemented',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useDecisions());

      act(() => {
        result.current.updateOutcome('dec-1', 'successful', 'Great results!');
      });

      expect(result.current.decisions[0]?.outcome).toBe('successful');
      expect(result.current.decisions[0]?.actualImpact).toBe('Great results!');
    });
  });

  describe('filter', () => {
    it('should apply filters to decisions', () => {
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Technical',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        useDecisionStore.getState().addDecision({
          id: 'dec-2',
          title: 'Financial',
          description: '',
          category: 'financial',
          status: 'approved',
          outcome: 'successful',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-07-20',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useDecisions());

      // All decisions initially
      expect(result.current.filteredDecisions).toHaveLength(2);

      // Apply category filter
      act(() => {
        result.current.setFilter({ category: 'technical' });
      });

      expect(result.current.filteredDecisions).toHaveLength(1);
      expect(result.current.filteredDecisions[0]?.id).toBe('dec-1');
    });

    it('should clear filters', () => {
      act(() => {
        useDecisionStore.getState().setFilter({ category: 'technical' });
      });

      const { result } = renderHook(() => useDecisions());

      act(() => {
        result.current.clearFilter();
      });

      expect(result.current.filter).toEqual({});
    });
  });

  describe('sorted array derivation', () => {
    it('should sort decisions by createdAt descending', () => {
      const now = Date.now();

      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-old',
          title: 'Old Decision',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-01-01',
          createdAt: now - 1000,
          updatedAt: now - 1000,
        });
        useDecisionStore.getState().addDecision({
          id: 'dec-new',
          title: 'New Decision',
          description: '',
          category: 'strategic',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: now,
          updatedAt: now,
        });
      });

      const { result } = renderHook(() => useDecisions());

      expect(result.current.decisions[0]?.id).toBe('dec-new');
      expect(result.current.decisions[1]?.id).toBe('dec-old');
    });
  });

  describe('importData', () => {
    it('should merge imported data without overwriting existing entries', async () => {
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-existing',
          title: 'Existing Decision',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { result } = renderHook(() => useDecisions());

      const importJson = JSON.stringify({
        decisions: {
          'dec-existing': {
            id: 'dec-existing',
            title: 'Should Not Overwrite',
            description: '',
            category: 'technical',
            status: 'proposed',
            outcome: 'pending',
            context: 'Context',
            rationale: 'Rationale',
            alternatives: [],
            expectedImpact: '',
            decisionMakers: [],
            relatedDocuments: [],
            tags: [],
            decisionDate: '2024-06-15',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          'dec-new': {
            id: 'dec-new',
            title: 'New Import',
            description: '',
            category: 'financial',
            status: 'approved',
            outcome: 'successful',
            context: 'Context',
            rationale: 'Rationale',
            alternatives: [],
            expectedImpact: '',
            decisionMakers: [],
            relatedDocuments: [],
            tags: [],
            decisionDate: '2024-07-20',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });

      const file = new File([importJson], 'data.json', {
        type: 'application/json',
      });
      file.text = () => Promise.resolve(importJson);

      let counts: { decisions: number } | undefined;
      await act(async () => {
        counts = await result.current.importData(file);
      });

      expect(counts?.decisions).toBe(1);

      const state = useDecisionStore.getState();
      expect(state.decisions['dec-existing']?.title).toBe('Existing Decision');
      expect(state.decisions['dec-new']?.title).toBe('New Import');
    });

    it('should reject invalid import data', async () => {
      const { result } = renderHook(() => useDecisions());

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

  describe('reanalyze', () => {
    it('should re-run AI analysis for an existing decision', async () => {
      const { analyzeDecision } = await import(
        '@/lib/intelligence/decisions'
      );

      const now = Date.now();
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Reanalyze Me',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: now,
          updatedAt: now,
        });
      });

      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        await result.current.reanalyze('dec-1');
      });

      expect(analyzeDecision).toHaveBeenCalled();
      expect(useDecisionStore.getState().decisions['dec-1']?.aiAnalysis).toBe(
        'AI-generated strategic analysis'
      );
    });

    it('should set error on AI failure', async () => {
      const { analyzeDecision } = await import(
        '@/lib/intelligence/decisions'
      );
      vi.mocked(analyzeDecision).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const now = Date.now();
      act(() => {
        useDecisionStore.getState().addDecision({
          id: 'dec-1',
          title: 'Fail Analysis',
          description: '',
          category: 'technical',
          status: 'proposed',
          outcome: 'pending',
          context: 'Context',
          rationale: 'Rationale',
          alternatives: [],
          expectedImpact: '',
          decisionMakers: [],
          relatedDocuments: [],
          tags: [],
          decisionDate: '2024-06-15',
          createdAt: now,
          updatedAt: now,
        });
      });

      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        await result.current.reanalyze('dec-1');
      });

      expect(result.current.error).toBe('AI service unavailable');
    });

    it('should no-op for non-existent decision', async () => {
      const { analyzeDecision } = await import(
        '@/lib/intelligence/decisions'
      );

      const { result } = renderHook(() => useDecisions());

      await act(async () => {
        await result.current.reanalyze('non-existent');
      });

      expect(analyzeDecision).not.toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      act(() => {
        useDecisionStore.getState().setError('Some error');
      });

      const { result } = renderHook(() => useDecisions());
      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
