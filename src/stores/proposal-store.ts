/**
 * Proposal Workflow Store
 *
 * Manages proposal workflow state including CRUD operations,
 * section editing, version tracking, and data portability.
 * Uses Zustand with devtools and persist middleware.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type {
  ProposalWorkflow,
  ProposalFilter,
  ProposalSection,
  ProposalVersion,
  ProposalStatus,
  Proposal,
} from '@/types/proposal';
import { countWords, isSectionComplete } from '@/lib/proposals/validation';

/** Maximum number of version history entries to keep per proposal */
export const MAX_VERSION_HISTORY = 50;

/** Current persist schema version — bump when ProposalWorkflow shape changes */
export const PERSIST_VERSION = 1;

/**
 * Migrate persisted state from older versions.
 * Version 0 → 1: Add unmappedSectionContent to each workflow.
 */
function migratePersistedState(
  persisted: Record<string, unknown>,
  version: number
): Record<string, unknown> {
  if (version < 1) {
    const proposals = (persisted.proposals ?? {}) as Record<string, Record<string, unknown>>;
    for (const workflow of Object.values(proposals)) {
      if (!workflow.unmappedSectionContent) {
        workflow.unmappedSectionContent = {};
      }
    }
  }
  return persisted;
}

// ============================================================================
// Types
// ============================================================================

export interface ProposalWorkflowState {
  /** Proposal workflows keyed by proposal ID */
  proposals: Record<string, ProposalWorkflow>;
  /** Active filter criteria */
  filter: ProposalFilter;
  /** Loading state */
  isLoading: boolean;
  /** Saving state */
  isSaving: boolean;
  /** ID of proposal currently being edited */
  editingId: string | null;
  /** Error message if any */
  error: string | null;
}

export interface ProposalWorkflowActions {
  // Workflow CRUD
  addWorkflow: (workflow: ProposalWorkflow) => void;
  removeWorkflow: (proposalId: string) => void;
  updateProposal: (proposalId: string, updates: Partial<Proposal>) => void;

  // Section editing
  updateSection: (proposalId: string, sectionId: string, content: string) => void;
  setActiveSectionId: (proposalId: string, sectionId: string | null) => void;
  addAISuggestion: (proposalId: string, sectionId: string, suggestion: string) => void;
  clearAISuggestions: (proposalId: string, sectionId: string) => void;

  // Version management
  saveVersion: (proposalId: string, changeSummary: string) => void;

  // Status
  updateStatus: (proposalId: string, status: ProposalStatus) => void;

  // UI state
  setEditingId: (id: string | null) => void;
  toggleAIPanel: (proposalId: string) => void;

  // Filter
  setFilter: (filter: ProposalFilter) => void;
  clearFilter: () => void;

  // Data portability
  exportData: () => {
    proposals: Record<string, ProposalWorkflow>;
    filter: ProposalFilter;
    exportedAt: number;
  };
  importData: (data: { proposals: Record<string, ProposalWorkflow> }) => void;

  // Loading/error
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ProposalWorkflowState = {
  proposals: {},
  filter: {},
  isLoading: false,
  isSaving: false,
  editingId: null,
  error: null,
};

// ============================================================================
// Debounced Storage
// ============================================================================

export const DEBOUNCE_MS = 1000;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const debouncedStorage: StateStorage = {
  getItem: (name) => {
    const str = localStorage.getItem(name);
    return str ?? null;
  },
  setItem: (name, value) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      localStorage.setItem(name, value);
    }, DEBOUNCE_MS);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

// ============================================================================
// Store
// ============================================================================

export const useProposalStore = create<ProposalWorkflowState & ProposalWorkflowActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Workflow CRUD
        addWorkflow: (workflow: ProposalWorkflow) =>
          set(
            (state) => ({
              proposals: {
                ...state.proposals,
                [workflow.proposal.id]: workflow,
              },
            }),
            false,
            'addWorkflow'
          ),

        removeWorkflow: (proposalId: string) =>
          set(
            (state) => {
              const { [proposalId]: _, ...remaining } = state.proposals;
              return { proposals: remaining };
            },
            false,
            'removeWorkflow'
          ),

        updateProposal: (proposalId: string, updates: Partial<Proposal>) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    proposal: {
                      ...existing.proposal,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    },
                  },
                },
              };
            },
            false,
            'updateProposal'
          ),

        // Section editing — the core action
        updateSection: (proposalId: string, sectionId: string, content: string) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              const updatedSections = existing.sections.map((s) => {
                if (s.id !== sectionId) return s;

                const updated: ProposalSection = {
                  ...s,
                  content,
                  wordCount: countWords(content),
                  lastEditedAt: Date.now(),
                };
                updated.isComplete = isSectionComplete(updated);
                return updated;
              });

              // Sync to ProposalContent if section has a contentFieldKey
              const editedSection = updatedSections.find((s) => s.id === sectionId);
              let updatedProposal = existing.proposal;
              let updatedUnmapped = existing.unmappedSectionContent ?? {};
              if (editedSection?.contentFieldKey) {
                updatedProposal = {
                  ...existing.proposal,
                  content: {
                    ...existing.proposal.content,
                    [editedSection.contentFieldKey]: content,
                  },
                  updatedAt: new Date().toISOString(),
                };
              } else {
                updatedProposal = {
                  ...existing.proposal,
                  updatedAt: new Date().toISOString(),
                };
                // Persist unmapped section content
                updatedUnmapped = {
                  ...existing.unmappedSectionContent,
                  [sectionId]: content,
                };
              }

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    sections: updatedSections,
                    proposal: updatedProposal,
                    unmappedSectionContent: updatedUnmapped,
                  },
                },
              };
            },
            false,
            'updateSection'
          ),

        setActiveSectionId: (proposalId: string, sectionId: string | null) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    activeSectionId: sectionId,
                  },
                },
              };
            },
            false,
            'setActiveSectionId'
          ),

        addAISuggestion: (proposalId: string, sectionId: string, suggestion: string) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              const updatedSections = existing.sections.map((s) => {
                if (s.id !== sectionId) return s;
                return {
                  ...s,
                  aiSuggestions: [...(s.aiSuggestions ?? []), suggestion],
                };
              });

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    sections: updatedSections,
                  },
                },
              };
            },
            false,
            'addAISuggestion'
          ),

        clearAISuggestions: (proposalId: string, sectionId: string) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              const updatedSections = existing.sections.map((s) => {
                if (s.id !== sectionId) return s;
                return { ...s, aiSuggestions: [] };
              });

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    sections: updatedSections,
                  },
                },
              };
            },
            false,
            'clearAISuggestions'
          ),

        // Version management
        saveVersion: (proposalId: string, changeSummary: string) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              const snapshot: ProposalVersion = {
                version: existing.version,
                timestamp: Date.now(),
                changeSummary,
                sections: existing.sections.map(({ aiSuggestions: _, ...rest }) => rest),
              };

              let history = [...existing.versionHistory, snapshot];
              if (history.length > MAX_VERSION_HISTORY) {
                // Keep first (initial) + most recent entries
                const first = history[0]!;
                history = [first, ...history.slice(-(MAX_VERSION_HISTORY - 1))];
              }

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    version: existing.version + 1,
                    versionHistory: history,
                  },
                },
              };
            },
            false,
            'saveVersion'
          ),

        // Status
        updateStatus: (proposalId: string, status: ProposalStatus) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    proposal: {
                      ...existing.proposal,
                      status,
                      updatedAt: new Date().toISOString(),
                    },
                  },
                },
              };
            },
            false,
            'updateStatus'
          ),

        // UI state
        setEditingId: (id: string | null) =>
          set({ editingId: id }, false, 'setEditingId'),

        toggleAIPanel: (proposalId: string) =>
          set(
            (state) => {
              const existing = state.proposals[proposalId];
              if (!existing) return state;

              return {
                proposals: {
                  ...state.proposals,
                  [proposalId]: {
                    ...existing,
                    showAIPanel: !existing.showAIPanel,
                  },
                },
              };
            },
            false,
            'toggleAIPanel'
          ),

        // Filter
        setFilter: (filter: ProposalFilter) =>
          set({ filter }, false, 'setFilter'),

        clearFilter: () =>
          set({ filter: {} }, false, 'clearFilter'),

        // Data portability
        exportData: () => {
          const { proposals, filter } = get();
          return { proposals, filter, exportedAt: Date.now() };
        },

        importData: (data: { proposals: Record<string, ProposalWorkflow> }) =>
          set(
            (state) => {
              const merged: Record<string, ProposalWorkflow> = { ...state.proposals };
              for (const [id, workflow] of Object.entries(data.proposals)) {
                if (!merged[id]) {
                  // Backfill unmappedSectionContent for older exports
                  merged[id] = {
                    ...workflow,
                    unmappedSectionContent: workflow.unmappedSectionContent ?? {},
                  };
                }
              }
              return { proposals: merged };
            },
            false,
            'importData'
          ),

        // Loading/error
        setLoading: (loading: boolean) =>
          set(
            { isLoading: loading, ...(loading ? { error: null } : {}) },
            false,
            'setLoading'
          ),

        setSaving: (saving: boolean) =>
          set({ isSaving: saving }, false, 'setSaving'),

        setError: (error: string | null) =>
          set(
            { error, isLoading: false, isSaving: false },
            false,
            'setError'
          ),

        clearError: () =>
          set({ error: null }, false, 'clearError'),

        // Reset
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'proposal-store',
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => debouncedStorage),
        migrate: migratePersistedState as never,
        partialize: (state) => ({
          proposals: state.proposals,
          filter: state.filter,
        }),
      }
    ),
    {
      name: 'proposal-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the proposals record. */
export const useProposalsRecord = () =>
  useProposalStore((state) => state.proposals);

/** Get a single workflow by proposal ID. */
export const useProposalWorkflow = (id: string) =>
  useProposalStore((state) => state.proposals[id] ?? null);

/** Get the active filter. */
export const useProposalFilter = () =>
  useProposalStore((state) => state.filter);

/** Check if loading. */
export const useProposalLoading = () =>
  useProposalStore((state) => state.isLoading);

/** Check if saving. */
export const useProposalSaving = () =>
  useProposalStore((state) => state.isSaving);

/** Get the ID currently being edited. */
export const useProposalEditingId = () =>
  useProposalStore((state) => state.editingId);

/** Get the current error. */
export const useProposalError = () =>
  useProposalStore((state) => state.error);
