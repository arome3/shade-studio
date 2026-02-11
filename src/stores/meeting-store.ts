/**
 * Meeting Notes Pipeline Store
 *
 * Manages meeting records and action items state.
 * Uses Zustand with devtools and persist middleware.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Meeting, MeetingFilter } from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/** Meeting store state */
export interface MeetingState {
  /** Tracked meetings keyed by ID */
  meetings: Record<string, Meeting>;
  /** Active filter criteria */
  filter: MeetingFilter;
  /** Loading state */
  isLoading: boolean;
  /** ID of meeting currently being processed, or null */
  processingId: string | null;
  /** Error message if any */
  error: string | null;
}

/** Meeting store actions */
export interface MeetingActions {
  // Meeting CRUD
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeMeeting: (id: string) => void;

  // Filter
  setFilter: (filter: MeetingFilter) => void;
  clearFilter: () => void;

  // Data portability
  exportData: () => {
    meetings: Record<string, Meeting>;
    filter: MeetingFilter;
    exportedAt: number;
  };
  importData: (data: { meetings: Record<string, Meeting> }) => void;

  // Loading/error actions
  setLoading: (loading: boolean) => void;
  setProcessingId: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: MeetingState = {
  meetings: {},
  filter: {},
  isLoading: false,
  processingId: null,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useMeetingStore = create<MeetingState & MeetingActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Meeting CRUD
        addMeeting: (meeting: Meeting) =>
          set(
            (state) => ({
              meetings: {
                ...state.meetings,
                [meeting.id]: meeting,
              },
            }),
            false,
            'addMeeting'
          ),

        updateMeeting: (id: string, updates: Partial<Meeting>) =>
          set(
            (state) => {
              const existing = state.meetings[id];
              if (!existing) return state;

              return {
                meetings: {
                  ...state.meetings,
                  [id]: { ...existing, ...updates },
                },
              };
            },
            false,
            'updateMeeting'
          ),

        removeMeeting: (id: string) =>
          set(
            (state) => {
              const { [id]: _, ...remaining } = state.meetings;
              return { meetings: remaining };
            },
            false,
            'removeMeeting'
          ),

        // Filter
        setFilter: (filter: MeetingFilter) =>
          set({ filter }, false, 'setFilter'),

        clearFilter: () =>
          set({ filter: {} }, false, 'clearFilter'),

        // Data portability
        exportData: () => {
          const { meetings, filter } = get();
          return { meetings, filter, exportedAt: Date.now() };
        },

        importData: (data: { meetings: Record<string, Meeting> }) =>
          set(
            (state) => {
              const merged: Record<string, Meeting> = { ...state.meetings };
              for (const [id, meeting] of Object.entries(data.meetings)) {
                if (!merged[id]) {
                  merged[id] = meeting;
                }
              }

              return { meetings: merged };
            },
            false,
            'importData'
          ),

        // Loading/error actions
        setLoading: (loading: boolean) =>
          set(
            {
              isLoading: loading,
              ...(loading ? { error: null } : {}),
            },
            false,
            'setLoading'
          ),

        setProcessingId: (id: string | null) =>
          set({ processingId: id }, false, 'setProcessingId'),

        setError: (error: string | null) =>
          set(
            {
              error,
              isLoading: false,
              processingId: null,
            },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        // Reset
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'meeting-store',
        partialize: (state) => ({
          meetings: state.meetings,
          filter: state.filter,
        }),
      }
    ),
    {
      name: 'meeting-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the meetings record. */
export const useMeetingsRecord = () =>
  useMeetingStore((state) => state.meetings);

/** Get a single meeting by ID. */
export const useMeetingById = (id: string) =>
  useMeetingStore((state) => state.meetings[id] ?? null);

/** Get the active filter. */
export const useMeetingFilter = () =>
  useMeetingStore((state) => state.filter);

/** Check if loading. */
export const useMeetingLoading = () =>
  useMeetingStore((state) => state.isLoading);

/** Get the ID of the meeting currently being processed, or null. */
export const useMeetingProcessing = () =>
  useMeetingStore((state) => state.processingId);

/** Get the current error. */
export const useMeetingError = () =>
  useMeetingStore((state) => state.error);
