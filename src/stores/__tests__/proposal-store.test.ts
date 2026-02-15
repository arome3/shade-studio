/**
 * Tests for the proposal workflow store.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useProposalStore,
  MAX_VERSION_HISTORY,
  debouncedStorage,
  DEBOUNCE_MS,
  PERSIST_VERSION,
} from '../proposal-store';
import { createProposalFromTemplate } from '@/lib/proposals/templates';
import type { ProposalWorkflow } from '@/types/proposal';

// ============================================================================
// Helpers
// ============================================================================

function createTestWorkflow(overrides: Partial<{ title: string; id: string }> = {}): ProposalWorkflow {
  const workflow = createProposalFromTemplate(
    'potlock-standard',
    overrides.title ?? 'Test Proposal',
    'alice.near'
  );
  if (overrides.id) {
    workflow.proposal.id = overrides.id;
  }
  return workflow;
}

// ============================================================================
// Tests
// ============================================================================

describe('useProposalStore', () => {
  beforeEach(() => {
    useProposalStore.getState().reset();
  });

  describe('addWorkflow', () => {
    it('should add a workflow', () => {
      const workflow = createTestWorkflow({ id: 'test-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
      });

      const state = useProposalStore.getState();
      expect(state.proposals['test-1']).toBeDefined();
      expect(state.proposals['test-1']!.proposal.title).toBe('Test Proposal');
    });

    it('should add multiple workflows', () => {
      const w1 = createTestWorkflow({ id: 'w1', title: 'Workflow 1' });
      const w2 = createTestWorkflow({ id: 'w2', title: 'Workflow 2' });

      act(() => {
        useProposalStore.getState().addWorkflow(w1);
        useProposalStore.getState().addWorkflow(w2);
      });

      const state = useProposalStore.getState();
      expect(Object.keys(state.proposals)).toHaveLength(2);
    });
  });

  describe('removeWorkflow', () => {
    it('should remove a workflow', () => {
      const workflow = createTestWorkflow({ id: 'rem-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().removeWorkflow('rem-1');
      });

      expect(useProposalStore.getState().proposals['rem-1']).toBeUndefined();
    });
  });

  describe('updateSection', () => {
    it('should update section content and wordCount', () => {
      const workflow = createTestWorkflow({ id: 'edit-1' });
      const sectionId = workflow.sections[0]!.id;

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateSection('edit-1', sectionId, 'Hello world');
      });

      const updated = useProposalStore.getState().proposals['edit-1']!;
      const section = updated.sections.find((s) => s.id === sectionId);
      expect(section!.content).toBe('Hello world');
      expect(section!.wordCount).toBe(2);
      expect(section!.lastEditedAt).toBeGreaterThan(0);
    });

    it('should sync content to ProposalContent via contentFieldKey', () => {
      const workflow = createTestWorkflow({ id: 'sync-1' });
      const overviewSection = workflow.sections.find(
        (s) => s.contentFieldKey === 'summary'
      );
      expect(overviewSection).toBeDefined();

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateSection(
          'sync-1',
          overviewSection!.id,
          'New summary content'
        );
      });

      const updated = useProposalStore.getState().proposals['sync-1']!;
      expect(updated.proposal.content.summary).toBe('New summary content');
    });

    it('should update isComplete status', () => {
      const workflow = createTestWorkflow({ id: 'complete-1' });
      const requiredSection = workflow.sections.find((s) => s.required);
      expect(requiredSection).toBeDefined();

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateSection(
          'complete-1',
          requiredSection!.id,
          'Some content'
        );
      });

      const updated = useProposalStore.getState().proposals['complete-1']!;
      const section = updated.sections.find((s) => s.id === requiredSection!.id);
      expect(section!.isComplete).toBe(true);
    });
  });

  describe('saveVersion', () => {
    it('should create a version snapshot', () => {
      const workflow = createTestWorkflow({ id: 'ver-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().saveVersion('ver-1', 'Initial draft');
      });

      const updated = useProposalStore.getState().proposals['ver-1']!;
      expect(updated.version).toBe(2);
      expect(updated.versionHistory).toHaveLength(1);
      expect(updated.versionHistory[0]!.changeSummary).toBe('Initial draft');
      expect(updated.versionHistory[0]!.version).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('should update proposal status', () => {
      const workflow = createTestWorkflow({ id: 'status-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateStatus('status-1', 'ready');
      });

      const updated = useProposalStore.getState().proposals['status-1']!;
      expect(updated.proposal.status).toBe('ready');
    });
  });

  describe('filter', () => {
    it('should set and clear filter', () => {
      act(() => {
        useProposalStore.getState().setFilter({ status: 'draft' });
      });
      expect(useProposalStore.getState().filter.status).toBe('draft');

      act(() => {
        useProposalStore.getState().clearFilter();
      });
      expect(useProposalStore.getState().filter).toEqual({});
    });
  });

  describe('toggleAIPanel', () => {
    it('should toggle showAIPanel', () => {
      const workflow = createTestWorkflow({ id: 'ai-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().toggleAIPanel('ai-1');
      });

      expect(useProposalStore.getState().proposals['ai-1']!.showAIPanel).toBe(true);

      act(() => {
        useProposalStore.getState().toggleAIPanel('ai-1');
      });

      expect(useProposalStore.getState().proposals['ai-1']!.showAIPanel).toBe(false);
    });
  });

  describe('data portability', () => {
    it('should export data', () => {
      const workflow = createTestWorkflow({ id: 'export-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
      });

      const exported = useProposalStore.getState().exportData();
      expect(exported.proposals['export-1']!).toBeDefined();
      expect(exported.exportedAt).toBeGreaterThan(0);
    });

    it('should import data without overwriting', () => {
      const w1 = createTestWorkflow({ id: 'existing', title: 'Existing' });
      const w2 = createTestWorkflow({ id: 'new-one', title: 'New One' });

      act(() => {
        useProposalStore.getState().addWorkflow(w1);
        useProposalStore.getState().importData({
          proposals: { existing: w2, 'new-one': w2 },
        });
      });

      const state = useProposalStore.getState();
      expect(state.proposals['existing']!.proposal.title).toBe('Existing');
      expect(state.proposals['new-one']!).toBeDefined();
    });
  });

  describe('loading/error', () => {
    it('should set and clear loading', () => {
      act(() => {
        useProposalStore.getState().setLoading(true);
      });
      expect(useProposalStore.getState().isLoading).toBe(true);

      act(() => {
        useProposalStore.getState().setLoading(false);
      });
      expect(useProposalStore.getState().isLoading).toBe(false);
    });

    it('should set error and clear transient state', () => {
      act(() => {
        useProposalStore.getState().setLoading(true);
        useProposalStore.getState().setError('Something failed');
      });

      const state = useProposalStore.getState();
      expect(state.error).toBe('Something failed');
      expect(state.isLoading).toBe(false);
      expect(state.isSaving).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const workflow = createTestWorkflow({ id: 'reset-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().setFilter({ status: 'draft' });
        useProposalStore.getState().reset();
      });

      const state = useProposalStore.getState();
      expect(Object.keys(state.proposals)).toHaveLength(0);
      expect(state.filter).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('version history cap', () => {
    it('should cap version history at MAX_VERSION_HISTORY entries', () => {
      const workflow = createTestWorkflow({ id: 'cap-1' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
      });

      // Create more versions than the cap
      act(() => {
        for (let i = 0; i < MAX_VERSION_HISTORY + 10; i++) {
          useProposalStore.getState().saveVersion('cap-1', `Change ${i}`);
        }
      });

      const updated = useProposalStore.getState().proposals['cap-1']!;
      expect(updated.versionHistory).toHaveLength(MAX_VERSION_HISTORY);
    });

    it('should preserve the first (initial) version entry after pruning', () => {
      const workflow = createTestWorkflow({ id: 'cap-2' });

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
      });

      // Save the initial version
      act(() => {
        useProposalStore.getState().saveVersion('cap-2', 'Initial version');
      });

      // Save many more to trigger pruning
      act(() => {
        for (let i = 1; i < MAX_VERSION_HISTORY + 10; i++) {
          useProposalStore.getState().saveVersion('cap-2', `Change ${i}`);
        }
      });

      const updated = useProposalStore.getState().proposals['cap-2']!;
      expect(updated.versionHistory).toHaveLength(MAX_VERSION_HISTORY);
      expect(updated.versionHistory[0]!.changeSummary).toBe('Initial version');
    });
  });

  describe('unmapped section content', () => {
    it('should persist unmapped section content in updateSection', () => {
      const workflow = createTestWorkflow({ id: 'unmapped-1' });
      const teamSection = workflow.sections.find((s) => s.id === 'team');
      expect(teamSection).toBeDefined();
      expect(teamSection!.contentFieldKey).toBeUndefined();

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateSection('unmapped-1', 'team', 'Our team is great');
      });

      const updated = useProposalStore.getState().proposals['unmapped-1']!;
      expect(updated.unmappedSectionContent['team']).toBe('Our team is great');
    });

    it('should not set unmapped content for mapped sections', () => {
      const workflow = createTestWorkflow({ id: 'unmapped-2' });
      const overviewSection = workflow.sections.find((s) => s.contentFieldKey === 'summary');
      expect(overviewSection).toBeDefined();

      act(() => {
        useProposalStore.getState().addWorkflow(workflow);
        useProposalStore.getState().updateSection('unmapped-2', overviewSection!.id, 'Summary text');
      });

      const updated = useProposalStore.getState().proposals['unmapped-2']!;
      expect(updated.unmappedSectionContent[overviewSection!.id]).toBeUndefined();
      expect(updated.proposal.content.summary).toBe('Summary text');
    });
  });

  describe('debounced storage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce setItem calls', () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');

      debouncedStorage.setItem('test-key', 'value1');
      debouncedStorage.setItem('test-key', 'value2');
      debouncedStorage.setItem('test-key', 'value3');

      // Should not have written yet
      expect(mockSetItem).not.toHaveBeenCalled();

      // Advance past debounce period
      vi.advanceTimersByTime(DEBOUNCE_MS + 100);

      // Should have written only once with the latest value
      expect(mockSetItem).toHaveBeenCalledTimes(1);
      expect(mockSetItem).toHaveBeenCalledWith('test-key', 'value3');

      mockSetItem.mockRestore();
    });

    it('should read from localStorage immediately', () => {
      const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"data":"test"}');
      const result = debouncedStorage.getItem('test-key');
      expect(result).toBe('{"data":"test"}');
      mockGetItem.mockRestore();
    });
  });

  describe('migration', () => {
    it('should have a persist version greater than 0', () => {
      expect(PERSIST_VERSION).toBeGreaterThan(0);
    });

    it('should handle updateSection on a workflow missing unmappedSectionContent', () => {
      // Simulate a legacy workflow loaded from pre-migration localStorage
      const workflow = createTestWorkflow({ id: 'legacy-1' });
      // Force remove the field to simulate legacy data
      const legacyWorkflow = { ...workflow } as Record<string, unknown>;
      delete legacyWorkflow.unmappedSectionContent;

      act(() => {
        useProposalStore.getState().addWorkflow(legacyWorkflow as unknown as ProposalWorkflow);
        // Should not crash even without unmappedSectionContent
        useProposalStore.getState().updateSection('legacy-1', 'team', 'Team info');
      });

      const updated = useProposalStore.getState().proposals['legacy-1']!;
      expect(updated.unmappedSectionContent['team']).toBe('Team info');
    });

    it('should backfill unmappedSectionContent on importData for legacy exports', () => {
      const workflow = createTestWorkflow({ id: 'legacy-import' });
      // Simulate an export from before the field existed
      const legacyWorkflow = { ...workflow } as Record<string, unknown>;
      delete legacyWorkflow.unmappedSectionContent;

      act(() => {
        useProposalStore.getState().importData({
          proposals: { 'legacy-import': legacyWorkflow as unknown as ProposalWorkflow },
        });
      });

      const imported = useProposalStore.getState().proposals['legacy-import']!;
      expect(imported.unmappedSectionContent).toEqual({});
    });
  });
});
