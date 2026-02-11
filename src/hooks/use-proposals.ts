'use client';

import { useCallback, useMemo } from 'react';
import { useWallet } from './use-wallet';
import {
  useProposalStore,
  useProposalsRecord,
  useProposalFilter,
  useProposalLoading,
  useProposalSaving,
  useProposalEditingId,
  useProposalError,
} from '@/stores/proposal-store';
import {
  createProposalFromTemplate,
  getGrantProgramLabel,
  exportProposalToMarkdown,
  exportProposalToJSON,
  checkCompleteness,
  validateImportData,
} from '@/lib/proposals';
import type {
  ProposalWorkflow,
  ProposalFilter,
  ProposalStatus,
  CompletenessResult,
} from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export interface UseProposalsReturn {
  // State
  proposals: ProposalWorkflow[];
  filteredProposals: ProposalWorkflow[];
  filter: ProposalFilter;
  isLoading: boolean;
  isSaving: boolean;
  editingId: string | null;
  error: string | null;
  isConnected: boolean;

  // CRUD
  createProposal: (templateId: string, title: string) => string;
  removeProposal: (proposalId: string) => void;
  updateTitle: (proposalId: string, title: string) => void;
  updateStatus: (proposalId: string, status: ProposalStatus) => void;

  // Section editing
  updateSection: (proposalId: string, sectionId: string, content: string) => void;
  setActiveSectionId: (proposalId: string, sectionId: string | null) => void;

  // Version management
  saveVersion: (proposalId: string, changeSummary: string) => void;

  // Completeness
  getCompleteness: (proposalId: string) => CompletenessResult | null;

  // UI
  setEditingId: (id: string | null) => void;
  toggleAIPanel: (proposalId: string) => void;

  // Filter
  setFilter: (filter: ProposalFilter) => void;
  clearFilter: () => void;
  clearError: () => void;
  setError: (error: string | null) => void;

  // Export & import
  exportMarkdown: (proposalId: string) => void;
  exportJSON: (proposalId: string) => void;
  exportAllData: () => void;
  importData: (file: File) => Promise<{ proposals: number }>;
}

// ============================================================================
// Filter helper
// ============================================================================

function filterWorkflows(
  workflows: ProposalWorkflow[],
  filter: ProposalFilter
): ProposalWorkflow[] {
  return workflows.filter((w) => {
    if (filter.status && w.proposal.status !== filter.status) return false;
    if (filter.grantProgram && w.grantProgram !== filter.grantProgram) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const title = w.proposal.title.toLowerCase();
      const program = getGrantProgramLabel(w.grantProgram).toLowerCase();
      if (!title.includes(q) && !program.includes(q)) return false;
    }
    return true;
  });
}

// ============================================================================
// Hook
// ============================================================================

export function useProposals(): UseProposalsReturn {
  const { isConnected, accountId } = useWallet();

  // Store selectors
  const proposalsRecord = useProposalsRecord();
  const filter = useProposalFilter();
  const isLoading = useProposalLoading();
  const isSaving = useProposalSaving();
  const editingId = useProposalEditingId();
  const error = useProposalError();

  // Store actions
  const addWorkflow = useProposalStore((s) => s.addWorkflow);
  const removeWorkflow = useProposalStore((s) => s.removeWorkflow);
  const updateProposalAction = useProposalStore((s) => s.updateProposal);
  const updateSectionAction = useProposalStore((s) => s.updateSection);
  const setActiveSectionAction = useProposalStore((s) => s.setActiveSectionId);
  const saveVersionAction = useProposalStore((s) => s.saveVersion);
  const updateStatusAction = useProposalStore((s) => s.updateStatus);
  const setEditingIdAction = useProposalStore((s) => s.setEditingId);
  const toggleAIPanelAction = useProposalStore((s) => s.toggleAIPanel);
  const setFilterAction = useProposalStore((s) => s.setFilter);
  const clearFilterAction = useProposalStore((s) => s.clearFilter);
  const setErrorAction = useProposalStore((s) => s.setError);
  const clearErrorAction = useProposalStore((s) => s.clearError);
  const storeImportData = useProposalStore((s) => s.importData);

  // Derive sorted array from record
  const proposals = useMemo(
    () =>
      Object.values(proposalsRecord).sort(
        (a, b) =>
          new Date(b.proposal.updatedAt).getTime() -
          new Date(a.proposal.updatedAt).getTime()
      ),
    [proposalsRecord]
  );

  // Derive filtered proposals
  const filteredProposals = useMemo(
    () => filterWorkflows(proposals, filter),
    [proposals, filter]
  );

  // CRUD
  const createProposal = useCallback(
    (templateId: string, title: string): string => {
      const workflow = createProposalFromTemplate(
        templateId,
        title,
        accountId ?? 'anonymous',
        'default'
      );
      addWorkflow(workflow);
      return workflow.proposal.id;
    },
    [accountId, addWorkflow]
  );

  const removeProposal = useCallback(
    (proposalId: string) => {
      removeWorkflow(proposalId);
    },
    [removeWorkflow]
  );

  const updateTitle = useCallback(
    (proposalId: string, title: string) => {
      updateProposalAction(proposalId, { title });
    },
    [updateProposalAction]
  );

  const updateStatus = useCallback(
    (proposalId: string, status: ProposalStatus) => {
      updateStatusAction(proposalId, status);
    },
    [updateStatusAction]
  );

  // Section editing
  const updateSection = useCallback(
    (proposalId: string, sectionId: string, content: string) => {
      updateSectionAction(proposalId, sectionId, content);
    },
    [updateSectionAction]
  );

  const setActiveSectionId = useCallback(
    (proposalId: string, sectionId: string | null) => {
      setActiveSectionAction(proposalId, sectionId);
    },
    [setActiveSectionAction]
  );

  // Version management
  const saveVersion = useCallback(
    (proposalId: string, changeSummary: string) => {
      saveVersionAction(proposalId, changeSummary);
    },
    [saveVersionAction]
  );

  // Completeness
  const getCompleteness = useCallback(
    (proposalId: string): CompletenessResult | null => {
      const workflow = useProposalStore.getState().proposals[proposalId];
      if (!workflow) return null;
      return checkCompleteness(workflow);
    },
    []
  );

  // UI
  const setEditingId = useCallback(
    (id: string | null) => {
      setEditingIdAction(id);
    },
    [setEditingIdAction]
  );

  const toggleAIPanel = useCallback(
    (proposalId: string) => {
      toggleAIPanelAction(proposalId);
    },
    [toggleAIPanelAction]
  );

  // Filter
  const setFilter = useCallback(
    (newFilter: ProposalFilter) => {
      setFilterAction(newFilter);
    },
    [setFilterAction]
  );

  const clearFilter = useCallback(() => {
    clearFilterAction();
  }, [clearFilterAction]);

  const clearError = useCallback(() => {
    clearErrorAction();
  }, [clearErrorAction]);

  const setError = useCallback(
    (err: string | null) => {
      setErrorAction(err);
    },
    [setErrorAction]
  );

  // Export
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const exportMarkdown = useCallback(
    (proposalId: string) => {
      const workflow = useProposalStore.getState().proposals[proposalId];
      if (!workflow) return;
      const markdown = exportProposalToMarkdown(workflow);
      const slug = workflow.proposal.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30);
      downloadFile(markdown, `${slug}-proposal.md`, 'text/markdown');
    },
    [downloadFile]
  );

  const exportJSON = useCallback(
    (proposalId: string) => {
      const workflow = useProposalStore.getState().proposals[proposalId];
      if (!workflow) return;
      const json = exportProposalToJSON(workflow);
      const slug = workflow.proposal.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30);
      downloadFile(json, `${slug}-proposal.json`, 'application/json');
    },
    [downloadFile]
  );

  const exportAllData = useCallback(() => {
    const data = useProposalStore.getState().exportData();
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `proposals-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  }, [downloadFile]);

  const importData = useCallback(
    async (file: File): Promise<{ proposals: number }> => {
      const text = await file.text();

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Import file is not valid JSON.');
      }

      const validation = validateImportData(data);
      if (!validation.valid) {
        throw new Error(
          `Invalid import data:\n${validation.errors.slice(0, 5).join('\n')}${
            validation.errors.length > 5
              ? `\n...and ${validation.errors.length - 5} more errors`
              : ''
          }`
        );
      }

      const existingState = useProposalStore.getState();
      const proposals = (data as { proposals: Record<string, unknown> }).proposals;
      const newProposals = Object.keys(proposals).filter(
        (id) => !existingState.proposals[id]
      ).length;

      storeImportData({ proposals: proposals as Record<string, ProposalWorkflow> });

      return { proposals: newProposals };
    },
    [storeImportData]
  );

  return {
    // State
    proposals,
    filteredProposals,
    filter,
    isLoading,
    isSaving,
    editingId,
    error,
    isConnected,

    // CRUD
    createProposal,
    removeProposal,
    updateTitle,
    updateStatus,

    // Section editing
    updateSection,
    setActiveSectionId,

    // Version management
    saveVersion,

    // Completeness
    getCompleteness,

    // UI
    setEditingId,
    toggleAIPanel,

    // Filter
    setFilter,
    clearFilter,
    clearError,
    setError,

    // Export & import
    exportMarkdown,
    exportJSON,
    exportAllData,
    importData,
  };
}
