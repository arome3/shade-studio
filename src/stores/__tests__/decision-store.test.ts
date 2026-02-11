/**
 * Tests for the decision store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useDecisionStore,
  useDecisionsRecord,
  useDecisionById,
  useDecisionFilter,
  useDecisionLoading,
  useDecisionAnalyzing,
  useDecisionError,
} from '../decision-store';
import type { Decision, DecisionFilter } from '@/types/intelligence';

// Mock decision for testing
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

describe('useDecisionStore', () => {
  beforeEach(() => {
    useDecisionStore.getState().reset();
  });

  describe('addDecision', () => {
    it('should add a decision', () => {
      const decision = createMockDecision();

      act(() => {
        useDecisionStore.getState().addDecision(decision);
      });

      const state = useDecisionStore.getState();
      expect(state.decisions['dec-1']).toEqual(decision);
    });

    it('should add multiple decisions', () => {
      const dec1 = createMockDecision({ id: 'dec-1', title: 'Decision 1' });
      const dec2 = createMockDecision({ id: 'dec-2', title: 'Decision 2' });

      act(() => {
        useDecisionStore.getState().addDecision(dec1);
        useDecisionStore.getState().addDecision(dec2);
      });

      const state = useDecisionStore.getState();
      expect(Object.keys(state.decisions)).toHaveLength(2);
    });
  });

  describe('updateDecision', () => {
    it('should update an existing decision', () => {
      const decision = createMockDecision();

      act(() => {
        useDecisionStore.getState().addDecision(decision);
        useDecisionStore.getState().updateDecision('dec-1', {
          title: 'Updated Title',
          status: 'approved',
        });
      });

      const state = useDecisionStore.getState();
      expect(state.decisions['dec-1']?.title).toBe('Updated Title');
      expect(state.decisions['dec-1']?.status).toBe('approved');
      // Other fields should remain unchanged
      expect(state.decisions['dec-1']?.category).toBe('technical');
    });

    it('should not modify state for non-existent decision', () => {
      act(() => {
        useDecisionStore.getState().updateDecision('non-existent', {
          title: 'Nope',
        });
      });

      const state = useDecisionStore.getState();
      expect(Object.keys(state.decisions)).toHaveLength(0);
    });
  });

  describe('removeDecision', () => {
    it('should remove a decision', () => {
      const decision = createMockDecision();

      act(() => {
        useDecisionStore.getState().addDecision(decision);
        useDecisionStore.getState().removeDecision('dec-1');
      });

      const state = useDecisionStore.getState();
      expect(state.decisions['dec-1']).toBeUndefined();
    });
  });

  describe('filter', () => {
    it('should set filter', () => {
      const filter: DecisionFilter = { category: 'technical', status: 'proposed' };

      act(() => {
        useDecisionStore.getState().setFilter(filter);
      });

      expect(useDecisionStore.getState().filter).toEqual(filter);
    });

    it('should clear filter', () => {
      act(() => {
        useDecisionStore.getState().setFilter({ category: 'technical' });
        useDecisionStore.getState().clearFilter();
      });

      expect(useDecisionStore.getState().filter).toEqual({});
    });
  });

  describe('exportData', () => {
    it('should return correct shape with decisions, filter, and exportedAt', () => {
      const decision = createMockDecision();

      act(() => {
        useDecisionStore.getState().addDecision(decision);
        useDecisionStore.getState().setFilter({ category: 'technical' });
      });

      const exported = useDecisionStore.getState().exportData();

      expect(exported.decisions).toBeDefined();
      expect(exported.decisions['dec-1']).toEqual(decision);
      expect(exported.filter).toEqual({ category: 'technical' });
      expect(exported.exportedAt).toBeGreaterThan(0);
    });
  });

  describe('importData', () => {
    it('should merge new decisions', () => {
      const existing = createMockDecision({ id: 'dec-existing' });

      act(() => {
        useDecisionStore.getState().addDecision(existing);
      });

      const importPayload = {
        decisions: {
          'dec-new': createMockDecision({ id: 'dec-new', title: 'New Decision' }),
        },
      };

      act(() => {
        useDecisionStore.getState().importData(importPayload);
      });

      const state = useDecisionStore.getState();
      expect(Object.keys(state.decisions)).toHaveLength(2);
      expect(state.decisions['dec-existing']).toBeDefined();
      expect(state.decisions['dec-new']?.title).toBe('New Decision');
    });

    it('should skip decisions with existing IDs', () => {
      const existing = createMockDecision({ id: 'dec-1', title: 'Original Title' });

      act(() => {
        useDecisionStore.getState().addDecision(existing);
      });

      const importPayload = {
        decisions: {
          'dec-1': createMockDecision({ id: 'dec-1', title: 'Overwritten Title' }),
        },
      };

      act(() => {
        useDecisionStore.getState().importData(importPayload);
      });

      const state = useDecisionStore.getState();
      expect(state.decisions['dec-1']?.title).toBe('Original Title');
    });
  });

  describe('loading state', () => {
    it('should set loading and clear error', () => {
      act(() => {
        useDecisionStore.getState().setError('Some error');
        useDecisionStore.getState().setLoading(true);
      });

      const state = useDecisionStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set analyzingId', () => {
      act(() => {
        useDecisionStore.getState().setAnalyzingId('dec-1');
      });

      expect(useDecisionStore.getState().analyzingId).toBe('dec-1');
    });

    it('should clear analyzingId', () => {
      act(() => {
        useDecisionStore.getState().setAnalyzingId('dec-1');
        useDecisionStore.getState().setAnalyzingId(null);
      });

      expect(useDecisionStore.getState().analyzingId).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error and clear loading/analyzingId', () => {
      act(() => {
        useDecisionStore.getState().setLoading(true);
        useDecisionStore.getState().setAnalyzingId('dec-1');
        useDecisionStore.getState().setError('Test error');
      });

      const state = useDecisionStore.getState();
      expect(state.error).toBe('Test error');
      expect(state.isLoading).toBe(false);
      expect(state.analyzingId).toBeNull();
    });

    it('should clear error', () => {
      act(() => {
        useDecisionStore.getState().setError('Test error');
        useDecisionStore.getState().clearError();
      });

      expect(useDecisionStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useDecisionStore.getState().addDecision(createMockDecision());
        useDecisionStore.getState().setFilter({ category: 'technical' });
        useDecisionStore.getState().setError('Error');
        useDecisionStore.getState().reset();
      });

      const state = useDecisionStore.getState();
      expect(Object.keys(state.decisions)).toHaveLength(0);
      expect(state.filter).toEqual({});
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.analyzingId).toBeNull();
    });
  });
});

describe('selector hooks', () => {
  beforeEach(() => {
    useDecisionStore.getState().reset();
  });

  it('useDecisionsRecord should return decisions record', () => {
    const dec1 = createMockDecision({ id: 'dec-1', createdAt: 100, updatedAt: 100 });
    const dec2 = createMockDecision({ id: 'dec-2', createdAt: 200, updatedAt: 200 });

    act(() => {
      useDecisionStore.getState().addDecision(dec1);
      useDecisionStore.getState().addDecision(dec2);
    });

    const { result } = renderHook(() => useDecisionsRecord());
    expect(Object.keys(result.current)).toHaveLength(2);
    expect(result.current['dec-1']).toEqual(dec1);
    expect(result.current['dec-2']).toEqual(dec2);
  });

  it('useDecisionById should return a specific decision', () => {
    const decision = createMockDecision({ id: 'dec-1' });

    act(() => {
      useDecisionStore.getState().addDecision(decision);
    });

    const { result } = renderHook(() => useDecisionById('dec-1'));
    expect(result.current).toEqual(decision);
  });

  it('useDecisionById should return null for non-existent ID', () => {
    const { result } = renderHook(() => useDecisionById('non-existent'));
    expect(result.current).toBeNull();
  });

  it('useDecisionFilter should return filter', () => {
    act(() => {
      useDecisionStore.getState().setFilter({ category: 'financial' });
    });

    const { result } = renderHook(() => useDecisionFilter());
    expect(result.current).toEqual({ category: 'financial' });
  });

  it('useDecisionLoading should return loading state', () => {
    act(() => {
      useDecisionStore.getState().setLoading(true);
    });

    const { result } = renderHook(() => useDecisionLoading());
    expect(result.current).toBe(true);
  });

  it('useDecisionAnalyzing should return analyzingId', () => {
    act(() => {
      useDecisionStore.getState().setAnalyzingId('dec-1');
    });

    const { result } = renderHook(() => useDecisionAnalyzing());
    expect(result.current).toBe('dec-1');
  });

  it('useDecisionAnalyzing should return null when not analyzing', () => {
    const { result } = renderHook(() => useDecisionAnalyzing());
    expect(result.current).toBeNull();
  });

  it('useDecisionError should return error', () => {
    act(() => {
      useDecisionStore.getState().setError('Test error');
    });

    const { result } = renderHook(() => useDecisionError());
    expect(result.current).toBe('Test error');
  });
});
