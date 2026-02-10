'use client';

import { useCallback, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useWallet } from './use-wallet';
import {
  useCompetitiveStore,
  useCompetitorsRecord,
  useEntriesRecord,
  useCompetitiveSummary,
  useCompetitiveLoading,
  useCompetitiveError,
} from '@/stores/competitive-store';
import { useCurrentProject } from '@/stores/projects-store';
import {
  analyzeCompetitiveEntry,
  generateCompetitiveSummary,
} from '@/lib/intelligence/competitive';
import type {
  Competitor,
  CompetitiveEntry,
  CompetitiveSummary,
  ThreatLevel,
} from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Input for adding a new competitor. */
export interface AddCompetitorInput {
  name: string;
  description: string;
  website?: string;
  twitter?: string;
  github?: string;
  categories: string[];
  threatLevel: ThreatLevel;
  notes?: string;
}

/** Input for adding a new entry. */
export interface AddEntryInput {
  competitorId: string;
  type: CompetitiveEntry['type'];
  title: string;
  description: string;
  sourceUrl?: string;
  date: string;
  relevance: number;
  amount?: number;
}

/** Return type for the useCompetitive hook. */
export interface UseCompetitiveReturn {
  // State
  competitors: Competitor[];
  entries: CompetitiveEntry[];
  summary: CompetitiveSummary | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  isConnected: boolean;

  // Actions
  addCompetitor: (input: AddCompetitorInput) => void;
  updateCompetitor: (id: string, updates: Partial<Competitor>) => void;
  removeCompetitor: (id: string) => void;
  addEntry: (input: AddEntryInput) => Promise<void>;
  updateEntry: (id: string, updates: Partial<CompetitiveEntry>) => void;
  removeEntry: (id: string) => void;
  refreshSummary: () => Promise<void>;
  getCompetitorEntries: (competitorId: string) => CompetitiveEntry[];
  exportData: () => void;
  importData: (file: File) => Promise<{ competitors: number; entries: number }>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for competitive tracker operations.
 * Composes wallet state, competitive store, and AI analysis.
 */
export function useCompetitive(): UseCompetitiveReturn {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get wallet state
  const { isConnected } = useWallet();

  // Get current project for context-aware AI prompts
  const currentProject = useCurrentProject();

  // Get store state via selector hooks — Records are stable references,
  // sorted arrays are derived via useMemo to prevent infinite re-render loops
  const competitorsRecord = useCompetitorsRecord();
  const entriesRecord = useEntriesRecord();
  const summary = useCompetitiveSummary();

  const competitors = useMemo(
    () => Object.values(competitorsRecord).sort((a, b) => b.addedAt - a.addedAt),
    [competitorsRecord]
  );
  const entries = useMemo(
    () => Object.values(entriesRecord).sort((a, b) => b.createdAt - a.createdAt),
    [entriesRecord]
  );
  const isLoading = useCompetitiveLoading();
  const error = useCompetitiveError();

  // Get store actions
  const addCompetitorAction = useCompetitiveStore((s) => s.addCompetitor);
  const updateCompetitorAction = useCompetitiveStore((s) => s.updateCompetitor);
  const removeCompetitorAction = useCompetitiveStore((s) => s.removeCompetitor);
  const addEntryAction = useCompetitiveStore((s) => s.addEntry);
  const updateEntryAction = useCompetitiveStore((s) => s.updateEntry);
  const removeEntryAction = useCompetitiveStore((s) => s.removeEntry);
  const setSummary = useCompetitiveStore((s) => s.setSummary);
  const setAnalyzing = useCompetitiveStore((s) => s.setAnalyzing);
  const setError = useCompetitiveStore((s) => s.setError);
  const isAnalyzing = useCompetitiveStore((s) => s.isAnalyzing);
  const storeImportData = useCompetitiveStore((s) => s.importData);

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
   * Add a new competitor.
   */
  const addCompetitor = useCallback(
    (input: AddCompetitorInput) => {
      const competitor: Competitor = {
        id: nanoid(10),
        name: input.name,
        description: input.description,
        website: input.website,
        twitter: input.twitter,
        github: input.github,
        categories: input.categories,
        threatLevel: input.threatLevel,
        notes: input.notes,
        addedAt: Date.now(),
      };
      addCompetitorAction(competitor);
    },
    [addCompetitorAction]
  );

  /**
   * Update an existing competitor.
   */
  const updateCompetitor = useCallback(
    (id: string, updates: Partial<Competitor>) => {
      updateCompetitorAction(id, updates);
    },
    [updateCompetitorAction]
  );

  /**
   * Remove a competitor (cascades entry deletion).
   */
  const removeCompetitor = useCallback(
    (id: string) => {
      removeCompetitorAction(id);
    },
    [removeCompetitorAction]
  );

  /**
   * Add a new entry with AI analysis for insight generation.
   */
  const addEntry = useCallback(
    async (input: AddEntryInput) => {
      // Cancel any existing analysis
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const entryId = nanoid(10);
      const competitor = useCompetitiveStore.getState().competitors[input.competitorId];

      // Create entry immediately (without insight)
      const entry: CompetitiveEntry = {
        id: entryId,
        competitorId: input.competitorId,
        type: input.type,
        title: input.title,
        description: input.description,
        sourceUrl: input.sourceUrl,
        date: input.date,
        relevance: input.relevance,
        amount: input.amount,
        isManual: true,
        createdAt: Date.now(),
      };

      addEntryAction(entry);

      // Generate AI insight in the background
      if (competitor) {
        setAnalyzing(true);
        try {
          const insight = await analyzeCompetitiveEntry(
            entry,
            competitor,
            { abortController: abortControllerRef.current },
            projectContext
          );

          // Update entry with insight
          const currentEntries = useCompetitiveStore.getState().entries;
          if (currentEntries[entryId]) {
            addEntryAction({ ...currentEntries[entryId], insight });
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          console.warn('[useCompetitive] AI analysis failed:', err);
          // Entry is already saved without insight — non-critical failure
        } finally {
          setAnalyzing(false);
          abortControllerRef.current = null;
        }
      }
    },
    [addEntryAction, setAnalyzing, projectContext]
  );

  /**
   * Update an existing entry.
   */
  const updateEntry = useCallback(
    (id: string, updates: Partial<CompetitiveEntry>) => {
      updateEntryAction(id, updates);
    },
    [updateEntryAction]
  );

  /**
   * Remove an entry.
   */
  const removeEntry = useCallback(
    (id: string) => {
      removeEntryAction(id);
    },
    [removeEntryAction]
  );

  /**
   * Refresh the competitive summary with AI analysis.
   * Includes retry logic for transient AI failures.
   */
  const refreshSummary = useCallback(async () => {
    const state = useCompetitiveStore.getState();
    const allCompetitors = Object.values(state.competitors);
    const allEntries = Object.values(state.entries);

    if (allCompetitors.length === 0) {
      setError('Add competitors before generating a summary.');
      return;
    }

    setAnalyzing(true);
    try {
      const newSummary = await generateCompetitiveSummary(
        allCompetitors,
        allEntries,
        {},
        projectContext
      );
      setSummary(newSummary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate competitive summary.'
      );
    } finally {
      setAnalyzing(false);
    }
  }, [setSummary, setAnalyzing, setError, projectContext]);

  /**
   * Get entries for a specific competitor.
   */
  const getCompetitorEntries = useCallback(
    (competitorId: string): CompetitiveEntry[] => {
      return entries.filter((e) => e.competitorId === competitorId);
    },
    [entries]
  );

  /**
   * Export competitive data as a JSON file download.
   */
  const exportData = useCallback(() => {
    const data = useCompetitiveStore.getState().exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competitive-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Import competitive data from a JSON file.
   * Merges without overwriting existing entries (ID-based dedup).
   */
  const importData = useCallback(
    async (file: File): Promise<{ competitors: number; entries: number }> => {
      const text = await file.text();
      const data = JSON.parse(text);

      if (
        !data ||
        typeof data.competitors !== 'object' ||
        typeof data.entries !== 'object'
      ) {
        throw new Error(
          'Invalid import file. Expected JSON with "competitors" and "entries" objects.'
        );
      }

      const existingState = useCompetitiveStore.getState();
      const newCompetitors = Object.keys(data.competitors).filter(
        (id) => !existingState.competitors[id]
      ).length;
      const newEntries = Object.keys(data.entries).filter(
        (id) => !existingState.entries[id]
      ).length;

      storeImportData({
        competitors: data.competitors,
        entries: data.entries,
      });

      return { competitors: newCompetitors, entries: newEntries };
    },
    [storeImportData]
  );

  return {
    // State
    competitors,
    entries,
    summary,
    isLoading,
    isAnalyzing,
    error,
    isConnected,

    // Actions
    addCompetitor,
    updateCompetitor,
    removeCompetitor,
    addEntry,
    updateEntry,
    removeEntry,
    refreshSummary,
    getCompetitorEntries,
    exportData,
    importData,
  };
}
