'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useWallet } from './use-wallet';
import {
  useDecisionStore,
  useDecisionsRecord,
  useDecisionFilter,
  useDecisionLoading,
  useDecisionAnalyzing,
  useDecisionError,
} from '@/stores/decision-store';
import { useCurrentProject } from '@/stores/projects-store';
import {
  analyzeDecision,
  filterDecisions,
  exportDecisionsToMarkdown,
} from '@/lib/intelligence/decisions';
import type {
  Decision,
  DecisionFilter,
  DecisionCategory,
  DecisionStatus,
  DecisionOutcome,
} from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Input for adding a new decision. */
export interface AddDecisionInput {
  title: string;
  description: string;
  category: DecisionCategory;
  status?: DecisionStatus;
  outcome?: DecisionOutcome;
  context: string;
  rationale: string;
  alternatives?: Decision['alternatives'];
  expectedImpact: string;
  actualImpact?: string;
  decisionMakers?: string[];
  relatedDocuments?: string[];
  tags?: string[];
  decisionDate?: string;
  reviewDate?: string;
}

/** Return type for the useDecisions hook. */
export interface UseDecisionsReturn {
  // State
  decisions: Decision[];
  filteredDecisions: Decision[];
  filter: DecisionFilter;
  isLoading: boolean;
  isAnalyzing: boolean;
  analyzingId: string | null;
  error: string | null;
  isConnected: boolean;

  // Actions
  addDecision: (input: AddDecisionInput) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  removeDecision: (id: string) => void;
  updateStatus: (id: string, status: DecisionStatus) => void;
  updateOutcome: (id: string, outcome: DecisionOutcome, actualImpact?: string) => void;
  reanalyze: (id: string) => Promise<void>;
  setFilter: (filter: DecisionFilter) => void;
  clearFilter: () => void;
  clearError: () => void;
  setError: (error: string | null) => void;
  exportToMarkdown: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<{ decisions: number }>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for decision journal operations.
 * Composes wallet state, decision store, and AI analysis.
 */
export function useDecisions(): UseDecisionsReturn {
  const addAbortRef = useRef<AbortController | null>(null);
  const reanalyzeAbortRef = useRef<AbortController | null>(null);

  // Abort in-flight AI requests on unmount
  useEffect(() => {
    return () => {
      addAbortRef.current?.abort();
      reanalyzeAbortRef.current?.abort();
    };
  }, []);

  // Get wallet state
  const { isConnected } = useWallet();

  // Get current project for context-aware AI prompts
  const currentProject = useCurrentProject();

  // Get store state via selector hooks
  const decisionsRecord = useDecisionsRecord();
  const filter = useDecisionFilter();
  const isLoading = useDecisionLoading();
  const analyzingId = useDecisionAnalyzing();
  const error = useDecisionError();

  // Derive global analyzing flag from per-decision ID
  const isAnalyzing = analyzingId !== null;

  // Derive sorted decisions array from record
  const decisions = useMemo(
    () => Object.values(decisionsRecord).sort((a, b) => b.createdAt - a.createdAt),
    [decisionsRecord]
  );

  // Derive filtered decisions
  const filteredDecisions = useMemo(
    () => filterDecisions(decisions, filter),
    [decisions, filter]
  );

  // Get store actions
  const addDecisionAction = useDecisionStore((s) => s.addDecision);
  const updateDecisionAction = useDecisionStore((s) => s.updateDecision);
  const removeDecisionAction = useDecisionStore((s) => s.removeDecision);
  const setFilterAction = useDecisionStore((s) => s.setFilter);
  const clearFilterAction = useDecisionStore((s) => s.clearFilter);
  const setAnalyzingId = useDecisionStore((s) => s.setAnalyzingId);
  const setErrorAction = useDecisionStore((s) => s.setError);
  const clearErrorAction = useDecisionStore((s) => s.clearError);
  const storeImportData = useDecisionStore((s) => s.importData);

  // Build project context for AI prompts
  const projectContext = useMemo(
    () =>
      currentProject
        ? {
            projectName: currentProject.metadata.name,
            projectDescription: currentProject.metadata.description,
          }
        : undefined,
    [currentProject]
  );

  /**
   * Add a new decision with background AI analysis.
   */
  const addDecision = useCallback(
    (input: AddDecisionInput) => {
      // Cancel any existing add analysis
      if (addAbortRef.current) {
        addAbortRef.current.abort();
      }
      addAbortRef.current = new AbortController();

      const now = Date.now();
      const decision: Decision = {
        id: nanoid(10),
        title: input.title,
        description: input.description,
        category: input.category,
        status: input.status ?? 'proposed',
        outcome: input.outcome ?? 'pending',
        context: input.context,
        rationale: input.rationale,
        alternatives: input.alternatives ?? [],
        expectedImpact: input.expectedImpact,
        actualImpact: input.actualImpact,
        decisionMakers: input.decisionMakers ?? [],
        relatedDocuments: input.relatedDocuments ?? [],
        tags: input.tags ?? [],
        decisionDate: input.decisionDate ?? new Date().toISOString().slice(0, 10),
        reviewDate: input.reviewDate,
        createdAt: now,
        updatedAt: now,
      };

      addDecisionAction(decision);

      // Run AI analysis in the background (non-blocking)
      const controller = addAbortRef.current;
      setAnalyzingId(decision.id);
      analyzeDecision(
        decision,
        { abortController: controller },
        projectContext
      )
        .then((analysis) => {
          // Verify the decision still exists before updating
          const current = useDecisionStore.getState().decisions[decision.id];
          if (current) {
            updateDecisionAction(decision.id, { aiAnalysis: analysis });
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          console.warn('[useDecisions] AI analysis failed:', err);
        })
        .finally(() => {
          // Only clear if we're still the active analyzing operation
          if (useDecisionStore.getState().analyzingId === decision.id) {
            setAnalyzingId(null);
          }
          if (addAbortRef.current === controller) {
            addAbortRef.current = null;
          }
        });
    },
    [addDecisionAction, updateDecisionAction, setAnalyzingId, projectContext]
  );

  /**
   * Update an existing decision.
   */
  const updateDecision = useCallback(
    (id: string, updates: Partial<Decision>) => {
      updateDecisionAction(id, { ...updates, updatedAt: Date.now() });
    },
    [updateDecisionAction]
  );

  /**
   * Remove a decision.
   */
  const removeDecision = useCallback(
    (id: string) => {
      removeDecisionAction(id);
    },
    [removeDecisionAction]
  );

  /**
   * Update a decision's status.
   */
  const updateStatus = useCallback(
    (id: string, status: DecisionStatus) => {
      updateDecisionAction(id, { status, updatedAt: Date.now() });
    },
    [updateDecisionAction]
  );

  /**
   * Update a decision's outcome with optional actual impact.
   */
  const updateOutcome = useCallback(
    (id: string, outcome: DecisionOutcome, actualImpact?: string) => {
      updateDecisionAction(id, {
        outcome,
        ...(actualImpact !== undefined ? { actualImpact } : {}),
        updatedAt: Date.now(),
      });
    },
    [updateDecisionAction]
  );

  /**
   * Re-run AI analysis for an existing decision.
   */
  const reanalyze = useCallback(
    async (id: string) => {
      const decision = useDecisionStore.getState().decisions[id];
      if (!decision) return;

      if (reanalyzeAbortRef.current) {
        reanalyzeAbortRef.current.abort();
      }
      reanalyzeAbortRef.current = new AbortController();

      setAnalyzingId(id);
      try {
        const analysis = await analyzeDecision(
          decision,
          { abortController: reanalyzeAbortRef.current },
          projectContext
        );
        updateDecisionAction(id, { aiAnalysis: analysis, updatedAt: Date.now() });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorAction(
          err instanceof Error ? err.message : 'Failed to analyze decision.'
        );
      } finally {
        // Only clear if we're still the active analyzing operation
        if (useDecisionStore.getState().analyzingId === id) {
          setAnalyzingId(null);
        }
        reanalyzeAbortRef.current = null;
      }
    },
    [updateDecisionAction, setAnalyzingId, setErrorAction, projectContext]
  );

  /**
   * Set the filter criteria.
   */
  const setFilter = useCallback(
    (newFilter: DecisionFilter) => {
      setFilterAction(newFilter);
    },
    [setFilterAction]
  );

  /**
   * Clear all filter criteria.
   */
  const clearFilter = useCallback(() => {
    clearFilterAction();
  }, [clearFilterAction]);

  /**
   * Clear the current error.
   */
  const clearError = useCallback(() => {
    clearErrorAction();
  }, [clearErrorAction]);

  /**
   * Set an error message.
   */
  const setError = useCallback(
    (err: string | null) => {
      setErrorAction(err);
    },
    [setErrorAction]
  );

  /**
   * Export decisions as a Markdown file download.
   */
  const exportToMarkdown = useCallback(() => {
    const allDecisions = Object.values(useDecisionStore.getState().decisions)
      .sort((a, b) => b.createdAt - a.createdAt);
    const markdown = exportDecisionsToMarkdown(allDecisions);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-journal-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Export decision data as a JSON file download.
   */
  const exportData = useCallback(() => {
    const data = useDecisionStore.getState().exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Import decision data from a JSON file.
   * Merges without overwriting existing entries.
   */
  const importData = useCallback(
    async (file: File): Promise<{ decisions: number }> => {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data.decisions !== 'object') {
        throw new Error(
          'Invalid import file. Expected JSON with a "decisions" object.'
        );
      }

      const existingState = useDecisionStore.getState();
      const newDecisions = Object.keys(data.decisions).filter(
        (id) => !existingState.decisions[id]
      ).length;

      storeImportData({ decisions: data.decisions });

      return { decisions: newDecisions };
    },
    [storeImportData]
  );

  return {
    // State
    decisions,
    filteredDecisions,
    filter,
    isLoading,
    isAnalyzing,
    analyzingId,
    error,
    isConnected,

    // Actions
    addDecision,
    updateDecision,
    removeDecision,
    updateStatus,
    updateOutcome,
    reanalyze,
    setFilter,
    clearFilter,
    clearError,
    setError,
    exportToMarkdown,
    exportData,
    importData,
  };
}
