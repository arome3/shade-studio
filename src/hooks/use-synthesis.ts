'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet } from './use-wallet';
import {
  useSynthesisStore,
  useSynthesesRecord,
  useSelectedWeekStart,
  useSynthesisGenerating,
  useSynthesisProgress,
  useSynthesisStage,
  useSynthesisError,
  type GenerationStage,
} from '@/stores/synthesis-store';
import {
  useIntelligenceStore,
  useBriefingHistoryRecord,
} from '@/stores/intelligence-store';
import { useDecisionStore, useDecisionsRecord } from '@/stores/decision-store';
import { useMeetingStore, useMeetingsRecord } from '@/stores/meeting-store';
import {
  useCompetitiveStore,
  useEntriesRecord,
} from '@/stores/competitive-store';
import { useCurrentProject } from '@/stores/projects-store';
import {
  getWeekBounds,
  gatherWeeklyData,
  generateWeeklySynthesis,
  exportSynthesisToMarkdown,
  validateSynthesisImport,
  type WeekBounds,
} from '@/lib/intelligence/synthesis';
import type { WeeklySynthesis } from '@/types/intelligence';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

/** Return type for the useSynthesis hook. */
export interface UseSynthesisReturn {
  // State
  syntheses: WeeklySynthesis[];
  currentWeekBounds: WeekBounds;
  selectedWeekStart: string | null;
  currentSynthesis: WeeklySynthesis | null;
  previousSynthesis: WeeklySynthesis | null;
  availableWeeks: WeekBounds[];
  isGenerating: boolean;
  generationProgress: number;
  generationStage: GenerationStage;
  error: string | null;
  isConnected: boolean;
  hasAnyData: boolean;

  // Actions
  generateSynthesis: (weekStart?: string) => Promise<void>;
  selectWeek: (weekStart: string | null) => void;
  navigateWeek: (direction: 'prev' | 'next') => void;
  exportToMarkdown: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<{ syntheses: number; skipped: number; errors: string[] }>;
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for weekly synthesis operations.
 * Composes wallet state, 5 stores, and AI generation.
 */
export function useSynthesis(): UseSynthesisReturn {
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Wallet
  const { isConnected } = useWallet();

  // Project context for AI prompts
  const currentProject = useCurrentProject();

  // Synthesis store (read + write)
  const synthesesRecord = useSynthesesRecord();
  const selectedWeekStart = useSelectedWeekStart();
  const isGenerating = useSynthesisGenerating();
  const generationProgress = useSynthesisProgress();
  const generationStage = useSynthesisStage();
  const error = useSynthesisError();

  // Other stores (read-only — used for reactive derived state)
  const briefingHistoryRecord = useBriefingHistoryRecord();
  const decisionsRecord = useDecisionsRecord();
  const meetingsRecord = useMeetingsRecord();
  const entriesRecord = useEntriesRecord();

  // Store actions
  const addSynthesis = useSynthesisStore((s) => s.addSynthesis);
  const setSelectedWeek = useSynthesisStore((s) => s.setSelectedWeek);
  const setGenerating = useSynthesisStore((s) => s.setGenerating);
  const setGenerationProgress = useSynthesisStore((s) => s.setGenerationProgress);
  const setGenerationStage = useSynthesisStore((s) => s.setGenerationStage);
  const setError = useSynthesisStore((s) => s.setError);
  const clearErrorAction = useSynthesisStore((s) => s.clearError);
  const storeImportData = useSynthesisStore((s) => s.importData);

  // Current week bounds
  const currentWeekBounds = useMemo(() => getWeekBounds(), []);

  // Sorted syntheses array (newest first)
  const syntheses = useMemo(
    () =>
      Object.values(synthesesRecord).sort(
        (a, b) => b.weekStart.localeCompare(a.weekStart)
      ),
    [synthesesRecord]
  );

  // Current synthesis = synthesis for selected week (or current week)
  const currentSynthesis = useMemo(() => {
    const targetWeek = selectedWeekStart ?? currentWeekBounds.weekStart;
    return synthesesRecord[targetWeek] ?? null;
  }, [synthesesRecord, selectedWeekStart, currentWeekBounds.weekStart]);

  // Previous week's synthesis (for week-over-week stat comparison)
  const previousSynthesis = useMemo(() => {
    const targetWeek = selectedWeekStart ?? currentWeekBounds.weekStart;
    try {
      const prevWeekDate = subWeeks(parseISO(targetWeek), 1);
      const prevBounds = getWeekBounds(prevWeekDate);
      return synthesesRecord[prevBounds.weekStart] ?? null;
    } catch {
      return null;
    }
  }, [synthesesRecord, selectedWeekStart, currentWeekBounds.weekStart]);

  // Check if any module has data
  const hasAnyData = useMemo(() => {
    return (
      Object.keys(briefingHistoryRecord).length > 0 ||
      Object.keys(decisionsRecord).length > 0 ||
      Object.keys(meetingsRecord).length > 0 ||
      Object.keys(entriesRecord).length > 0
    );
  }, [briefingHistoryRecord, decisionsRecord, meetingsRecord, entriesRecord]);

  // Compute available weeks that have data across any store
  const availableWeeks = useMemo((): WeekBounds[] => {
    const weekSet = new Set<string>();

    // Collect dates from all stores (using reactive subscriptions)
    for (const b of Object.values(briefingHistoryRecord)) {
      try {
        const bounds = getWeekBounds(parseISO(b.date));
        weekSet.add(bounds.weekStart);
      } catch { /* skip invalid */ }
    }

    for (const d of Object.values(decisionsRecord)) {
      try {
        const bounds = getWeekBounds(parseISO(d.decisionDate));
        weekSet.add(bounds.weekStart);
      } catch { /* skip invalid */ }
    }

    for (const m of Object.values(meetingsRecord)) {
      try {
        const bounds = getWeekBounds(parseISO(m.date));
        weekSet.add(bounds.weekStart);
      } catch { /* skip invalid */ }
    }

    for (const e of Object.values(entriesRecord)) {
      const bounds = getWeekBounds(new Date(e.createdAt));
      weekSet.add(bounds.weekStart);
    }

    // Always include the current week
    weekSet.add(currentWeekBounds.weekStart);

    // Convert to sorted array of WeekBounds (newest first)
    return Array.from(weekSet)
      .sort((a, b) => b.localeCompare(a))
      .map((ws) => {
        const bounds = getWeekBounds(parseISO(ws));
        return bounds;
      });
  }, [briefingHistoryRecord, decisionsRecord, meetingsRecord, entriesRecord, currentWeekBounds]);

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
   * Generate a synthesis for a given week (defaults to selected or current).
   */
  const generateSynthesis = useCallback(
    async (weekStart?: string) => {
      const targetWeekStart = weekStart ?? selectedWeekStart ?? currentWeekBounds.weekStart;
      const targetBounds = getWeekBounds(parseISO(targetWeekStart));

      // Abort any existing generation
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGenerating(true);
      setGenerationStage('gathering');
      setGenerationProgress(10);

      try {
        // Stage 1: Gather data from all stores
        const briefingHistory = useIntelligenceStore.getState().briefingHistory;
        const allBriefings = Object.values(briefingHistory);
        const allDecisions = Object.values(useDecisionStore.getState().decisions);
        const allMeetings = Object.values(useMeetingStore.getState().meetings);
        const allEntries = Object.values(useCompetitiveStore.getState().entries);
        const allCompetitors = Object.values(useCompetitiveStore.getState().competitors);

        setGenerationProgress(20);

        // Stage 2: Analyze patterns
        if (controller.signal.aborted) return;
        setGenerationStage('analyzing');
        setGenerationProgress(30);

        const context = gatherWeeklyData(
          targetBounds.weekStart,
          targetBounds.weekEnd,
          allBriefings,
          allDecisions,
          allMeetings,
          allEntries,
          allCompetitors
        );

        if (controller.signal.aborted) return;

        // Stage 3: AI generation
        setGenerationStage('generating');
        setGenerationProgress(40);

        const synthesis = await generateWeeklySynthesis(
          context,
          { abortController: controller },
          projectContext
        );

        if (controller.signal.aborted) return;

        // Stage 4: Finalize
        setGenerationStage('finalizing');
        setGenerationProgress(90);

        addSynthesis(synthesis);

        // Guard against post-abort state updates (e.g., unmount during generation)
        if (controller.signal.aborted) return;
        setSelectedWeek(targetBounds.weekStart);
        setGenerating(false);
        setGenerationProgress(100);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        console.warn('[useSynthesis] Generation failed:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to generate weekly synthesis.'
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      selectedWeekStart,
      currentWeekBounds,
      projectContext,
      addSynthesis,
      setSelectedWeek,
      setGenerating,
      setGenerationProgress,
      setGenerationStage,
      setError,
    ]
  );

  /**
   * Select a week to view.
   */
  const selectWeek = useCallback(
    (weekStart: string | null) => {
      setSelectedWeek(weekStart);
    },
    [setSelectedWeek]
  );

  /**
   * Navigate to the previous or next week.
   */
  const navigateWeek = useCallback(
    (direction: 'prev' | 'next') => {
      const current = selectedWeekStart ?? currentWeekBounds.weekStart;
      const currentDate = parseISO(current);
      const newDate = direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1);
      const newWeekStart = format(newDate, 'yyyy-MM-dd');

      // Don't navigate beyond the current week
      if (newWeekStart > currentWeekBounds.weekStart) return;

      setSelectedWeek(newWeekStart);
    },
    [selectedWeekStart, currentWeekBounds.weekStart, setSelectedWeek]
  );

  /**
   * Export current synthesis as Markdown file download.
   */
  const exportToMarkdown = useCallback(() => {
    if (!currentSynthesis) return;
    const markdown = exportSynthesisToMarkdown(currentSynthesis);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-synthesis-${currentSynthesis.weekStart}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentSynthesis]);

  /**
   * Export synthesis data as JSON file download.
   */
  const exportData = useCallback(() => {
    const data = useSynthesisStore.getState().exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthesis-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Import synthesis data from a JSON file with schema validation.
   * Only imports records that pass validation; reports skipped entries.
   */
  const importData = useCallback(
    async (file: File): Promise<{ syntheses: number; skipped: number; errors: string[] }> => {
      let data: unknown;
      try {
        const text = await file.text();
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid file: could not parse as JSON.');
      }

      const validation = validateSynthesisImport(data);

      if (validation.validCount === 0) {
        throw new Error(
          validation.errors.length > 0
            ? `No valid syntheses found: ${validation.errors[0]}`
            : 'No valid syntheses found in import file.'
        );
      }

      const existingState = useSynthesisStore.getState();
      const newKeys = Object.keys(validation.validSyntheses).filter(
        (key) => !existingState.syntheses[key]
      );

      if (newKeys.length > 0) {
        storeImportData({ syntheses: validation.validSyntheses });
      }

      return {
        syntheses: newKeys.length,
        skipped: validation.invalidCount,
        errors: validation.errors,
      };
    },
    [storeImportData]
  );

  /**
   * Clear the current error.
   */
  const clearError = useCallback(() => {
    clearErrorAction();
  }, [clearErrorAction]);

  return {
    // State
    syntheses,
    currentWeekBounds,
    selectedWeekStart,
    currentSynthesis,
    previousSynthesis,
    availableWeeks,
    isGenerating,
    generationProgress,
    generationStage,
    error,
    isConnected,
    hasAnyData,

    // Actions
    generateSynthesis,
    selectWeek,
    navigateWeek,
    exportToMarkdown,
    exportData,
    importData,
    clearError,
  };
}
