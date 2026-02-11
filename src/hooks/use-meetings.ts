'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useWallet } from './use-wallet';
import {
  useMeetingStore,
  useMeetingsRecord,
  useMeetingFilter,
  useMeetingLoading,
  useMeetingProcessing,
  useMeetingError,
} from '@/stores/meeting-store';
import { useCurrentProject } from '@/stores/projects-store';
import {
  processMeetingNotes,
  filterMeetings,
  calculateMeetingStats,
  exportMeetingsToMarkdown,
} from '@/lib/intelligence/meetings';
import type {
  Meeting,
  MeetingFilter,
  MeetingType,
  ActionItem,
  ActionItemStatus,
} from '@/types/intelligence';
import type { MeetingStats } from '@/lib/intelligence/meetings';

// ============================================================================
// Types
// ============================================================================

/** Input for adding a new meeting. */
export interface AddMeetingInput {
  title: string;
  type: MeetingType;
  date?: string;
  duration?: number;
  attendees?: string[];
  rawNotes: string;
  relatedProject?: string;
  tags?: string[];
  followUpNeeded?: boolean;
  followUpDate?: string;
}

/** A pending action item with its source meeting info. */
export interface PendingActionItem {
  meetingId: string;
  meetingTitle: string;
  item: ActionItem;
}

/** Return type for the useMeetings hook. */
export interface UseMeetingsReturn {
  // State
  meetings: Meeting[];
  filteredMeetings: Meeting[];
  filter: MeetingFilter;
  stats: MeetingStats;
  isLoading: boolean;
  isProcessing: boolean;
  processingId: string | null;
  error: string | null;
  isConnected: boolean;

  // Actions
  addMeeting: (input: AddMeetingInput) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeMeeting: (id: string) => void;
  processMeeting: (id: string) => Promise<void>;
  updateActionItem: (
    meetingId: string,
    itemId: string,
    updates: Partial<ActionItem>
  ) => void;
  completeActionItem: (meetingId: string, itemId: string) => void;
  pendingActionItems: PendingActionItem[];
  setFilter: (filter: MeetingFilter) => void;
  clearFilter: () => void;
  clearError: () => void;
  setError: (error: string | null) => void;
  exportToMarkdown: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<{ meetings: number }>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for meeting notes operations.
 * Composes wallet state, meeting store, and AI processing.
 */
export function useMeetings(): UseMeetingsReturn {
  // Per-meeting abort controllers — allows concurrent processing without interference
  const processingAbortMap = useRef<Map<string, AbortController>>(new Map());

  // Abort all in-flight AI requests on unmount
  useEffect(() => {
    return () => {
      for (const controller of processingAbortMap.current.values()) {
        controller.abort();
      }
      processingAbortMap.current.clear();
    };
  }, []);

  // Get wallet state
  const { isConnected } = useWallet();

  // Get current project for context-aware AI prompts
  const currentProject = useCurrentProject();

  // Get store state via selector hooks
  const meetingsRecord = useMeetingsRecord();
  const filter = useMeetingFilter();
  const isLoading = useMeetingLoading();
  const processingId = useMeetingProcessing();
  const error = useMeetingError();

  // Derive global processing flag
  const isProcessing = processingId !== null;

  // Derive sorted meetings array from record
  const meetings = useMemo(
    () => Object.values(meetingsRecord).sort((a, b) => b.createdAt - a.createdAt),
    [meetingsRecord]
  );

  // Derive filtered meetings
  const filteredMeetings = useMemo(
    () => filterMeetings(meetings, filter),
    [meetings, filter]
  );

  // Derive stats
  const stats = useMemo(
    () => calculateMeetingStats(meetings),
    [meetings]
  );

  // Get store actions
  const addMeetingAction = useMeetingStore((s) => s.addMeeting);
  const updateMeetingAction = useMeetingStore((s) => s.updateMeeting);
  const removeMeetingAction = useMeetingStore((s) => s.removeMeeting);
  const setFilterAction = useMeetingStore((s) => s.setFilter);
  const clearFilterAction = useMeetingStore((s) => s.clearFilter);
  const setProcessingId = useMeetingStore((s) => s.setProcessingId);
  const setErrorAction = useMeetingStore((s) => s.setError);
  const clearErrorAction = useMeetingStore((s) => s.clearError);
  const storeImportData = useMeetingStore((s) => s.importData);

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
   * Run AI processing on a meeting and update it with results.
   * Internal helper used by both addMeeting and processMeeting.
   */
  const runProcessing = useCallback(
    async (meetingId: string, controller: AbortController) => {
      const meeting = useMeetingStore.getState().meetings[meetingId];
      if (!meeting) return;

      setProcessingId(meetingId);
      try {
        const result = await processMeetingNotes(
          meeting.rawNotes,
          meeting.type,
          meeting.attendees,
          { abortController: controller },
          projectContext
        );

        // Bail out if aborted between AI response and store write
        if (controller.signal.aborted) return;

        // Verify the meeting still exists before updating
        const current = useMeetingStore.getState().meetings[meetingId];
        if (current) {
          const actionItems = result.actionItems.map((item) => ({
            ...item,
            id: nanoid(8),
            status: 'pending' as ActionItemStatus,
          }));

          updateMeetingAction(meetingId, {
            summary: result.summary,
            actionItems: [...current.actionItems, ...actionItems],
            decisions: [...current.decisions, ...result.decisions],
            followUpNeeded: result.followUpNeeded || current.followUpNeeded,
            followUpDate: result.suggestedFollowUpDate ?? current.followUpDate,
            isProcessed: true,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('[useMeetings] AI processing failed:', err);
      } finally {
        // Only clear processingId if this controller wasn't aborted
        // (prevents clearing state that belongs to a newer processing run)
        if (
          !controller.signal.aborted &&
          useMeetingStore.getState().processingId === meetingId
        ) {
          setProcessingId(null);
        }
        processingAbortMap.current.delete(meetingId);
      }
    },
    [updateMeetingAction, setProcessingId, projectContext]
  );

  /**
   * Add a new meeting. Auto-processes if rawNotes is long enough.
   */
  const addMeeting = useCallback(
    (input: AddMeetingInput) => {
      const now = Date.now();
      const meeting: Meeting = {
        id: nanoid(10),
        title: input.title,
        type: input.type,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        duration: input.duration,
        attendees: input.attendees ?? [],
        rawNotes: input.rawNotes,
        actionItems: [],
        decisions: [],
        followUpNeeded: input.followUpNeeded ?? false,
        followUpDate: input.followUpDate,
        relatedProject: input.relatedProject,
        tags: input.tags ?? [],
        createdAt: now,
        updatedAt: now,
        isProcessed: false,
      };

      addMeetingAction(meeting);

      // Auto-process if notes are substantial enough
      if (input.rawNotes.trim().length > 50) {
        // Abort any existing processing for the same meeting ID (unlikely but safe)
        processingAbortMap.current.get(meeting.id)?.abort();
        const controller = new AbortController();
        processingAbortMap.current.set(meeting.id, controller);
        runProcessing(meeting.id, controller);
      }
    },
    [addMeetingAction, runProcessing]
  );

  /**
   * Update an existing meeting.
   */
  const updateMeeting = useCallback(
    (id: string, updates: Partial<Meeting>) => {
      updateMeetingAction(id, { ...updates, updatedAt: Date.now() });
    },
    [updateMeetingAction]
  );

  /**
   * Remove a meeting.
   */
  const removeMeeting = useCallback(
    (id: string) => {
      removeMeetingAction(id);
    },
    [removeMeetingAction]
  );

  /**
   * Re-process an existing meeting with AI.
   */
  const processMeeting = useCallback(
    async (id: string) => {
      const meeting = useMeetingStore.getState().meetings[id];
      if (!meeting) return;

      // Abort any existing processing for this meeting
      processingAbortMap.current.get(id)?.abort();
      const controller = new AbortController();
      processingAbortMap.current.set(id, controller);

      // Clear existing AI results before re-processing
      updateMeetingAction(id, {
        summary: undefined,
        actionItems: [],
        decisions: [],
        isProcessed: false,
        updatedAt: Date.now(),
      });

      try {
        await runProcessing(id, controller);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorAction(
          err instanceof Error ? err.message : 'Failed to process meeting.'
        );
      }
    },
    [updateMeetingAction, runProcessing, setErrorAction]
  );

  /**
   * Update an action item within a meeting.
   */
  const updateActionItem = useCallback(
    (meetingId: string, itemId: string, updates: Partial<ActionItem>) => {
      const meeting = useMeetingStore.getState().meetings[meetingId];
      if (!meeting) return;

      const updatedItems = meeting.actionItems.map((item) => {
        if (item.id !== itemId) return item;
        const merged = { ...item, ...updates };
        // Normalize status ↔ completedAt invariant
        if (merged.status === 'completed' && !merged.completedAt) {
          merged.completedAt = Date.now();
        }
        if (merged.status !== 'completed') {
          merged.completedAt = undefined;
        }
        return merged;
      });

      updateMeetingAction(meetingId, {
        actionItems: updatedItems,
        updatedAt: Date.now(),
      });
    },
    [updateMeetingAction]
  );

  /**
   * Toggle completion of an action item.
   */
  const completeActionItem = useCallback(
    (meetingId: string, itemId: string) => {
      const meeting = useMeetingStore.getState().meetings[meetingId];
      if (!meeting) return;

      const updatedItems = meeting.actionItems.map((item) => {
        if (item.id !== itemId) return item;
        const isCompleting = item.status !== 'completed';
        return {
          ...item,
          status: (isCompleting ? 'completed' : 'pending') as ActionItemStatus,
          completedAt: isCompleting ? Date.now() : undefined,
        };
      });

      updateMeetingAction(meetingId, {
        actionItems: updatedItems,
        updatedAt: Date.now(),
      });
    },
    [updateMeetingAction]
  );

  // Derive pending action items reactively from meetingsRecord
  const pendingActionItems = useMemo((): PendingActionItem[] => {
    const items: PendingActionItem[] = [];

    for (const meeting of Object.values(meetingsRecord)) {
      for (const item of meeting.actionItems) {
        if (item.status !== 'completed') {
          items.push({
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            item,
          });
        }
      }
    }

    // Sort: items with due dates first (earliest first), then by priority
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    items.sort((a, b) => {
      // Due date comparison
      if (a.item.dueDate && b.item.dueDate) {
        if (a.item.dueDate !== b.item.dueDate) {
          return a.item.dueDate.localeCompare(b.item.dueDate);
        }
      } else if (a.item.dueDate && !b.item.dueDate) {
        return -1;
      } else if (!a.item.dueDate && b.item.dueDate) {
        return 1;
      }

      // Priority comparison
      return (priorityOrder[a.item.priority] ?? 1) - (priorityOrder[b.item.priority] ?? 1);
    });

    return items;
  }, [meetingsRecord]);

  /**
   * Set the filter criteria.
   */
  const setFilter = useCallback(
    (newFilter: MeetingFilter) => {
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
   * Export meetings as a Markdown file download.
   */
  const exportToMarkdown = useCallback(() => {
    const allMeetings = Object.values(useMeetingStore.getState().meetings)
      .sort((a, b) => b.createdAt - a.createdAt);
    const markdown = exportMeetingsToMarkdown(allMeetings);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Export meeting data as a JSON file download.
   */
  const exportData = useCallback(() => {
    const data = useMeetingStore.getState().exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Import meeting data from a JSON file.
   * Merges without overwriting existing entries.
   */
  const importData = useCallback(
    async (file: File): Promise<{ meetings: number }> => {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data.meetings !== 'object') {
        throw new Error(
          'Invalid import file. Expected JSON with a "meetings" object.'
        );
      }

      const existingState = useMeetingStore.getState();
      const newMeetings = Object.keys(data.meetings).filter(
        (id) => !existingState.meetings[id]
      ).length;

      storeImportData({ meetings: data.meetings });

      return { meetings: newMeetings };
    },
    [storeImportData]
  );

  return {
    // State
    meetings,
    filteredMeetings,
    filter,
    stats,
    isLoading,
    isProcessing,
    processingId,
    error,
    isConnected,

    // Actions
    addMeeting,
    updateMeeting,
    removeMeeting,
    processMeeting,
    updateActionItem,
    completeActionItem,
    pendingActionItems,
    setFilter,
    clearFilter,
    clearError,
    setError,
    exportToMarkdown,
    exportData,
    importData,
  };
}
