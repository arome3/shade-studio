/**
 * Tests for the useProposals hook.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProposals } from '../use-proposals';
import { useProposalStore } from '@/stores/proposal-store';

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

describe('useProposals', () => {
  beforeEach(() => {
    useProposalStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return empty state initially', () => {
      const { result } = renderHook(() => useProposals());

      expect(result.current.proposals).toEqual([]);
      expect(result.current.filteredProposals).toEqual([]);
      expect(result.current.filter).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.editingId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('createProposal', () => {
    it('should create a proposal and return its ID', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal(
          'potlock-standard',
          'My Grant Proposal'
        );
      });

      expect(proposalId!).toBeDefined();
      expect(result.current.proposals).toHaveLength(1);
      expect(result.current.proposals[0]!.proposal.title).toBe('My Grant Proposal');
      expect(result.current.proposals[0]!.proposal.ownerId).toBe('test.near');
    });

    it('should create multiple proposals', () => {
      const { result } = renderHook(() => useProposals());

      act(() => {
        result.current.createProposal('potlock-standard', 'Proposal A');
        result.current.createProposal('custom-proposal', 'Proposal B');
      });

      expect(result.current.proposals).toHaveLength(2);
    });
  });

  describe('removeProposal', () => {
    it('should remove a proposal', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal('potlock-standard', 'To Delete');
      });

      act(() => {
        result.current.removeProposal(proposalId!);
      });

      expect(result.current.proposals).toHaveLength(0);
    });
  });

  describe('updateSection', () => {
    it('should update a section', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal('potlock-standard', 'Test');
      });

      const sectionId = result.current.proposals[0]!.sections[0]!.id;

      act(() => {
        result.current.updateSection(proposalId!, sectionId, 'New content');
      });

      const updated = result.current.proposals[0]!.sections.find(
        (s) => s.id === sectionId
      );
      expect(updated!.content).toBe('New content');
      expect(updated!.wordCount).toBe(2);
    });
  });

  describe('updateStatus', () => {
    it('should update proposal status', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal('potlock-standard', 'Test');
      });

      act(() => {
        result.current.updateStatus(proposalId!, 'ready');
      });

      expect(result.current.proposals[0]!.proposal.status).toBe('ready');
    });
  });

  describe('saveVersion', () => {
    it('should create a version snapshot', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal('potlock-standard', 'Test');
      });

      act(() => {
        result.current.saveVersion(proposalId!, 'First save');
      });

      expect(result.current.proposals[0]!.version).toBe(2);
      expect(result.current.proposals[0]!.versionHistory).toHaveLength(1);
    });
  });

  describe('filtering', () => {
    it('should filter by search query', () => {
      const { result } = renderHook(() => useProposals());

      act(() => {
        result.current.createProposal('potlock-standard', 'Alpha Project');
        result.current.createProposal('potlock-standard', 'Beta Project');
      });

      act(() => {
        result.current.setFilter({ searchQuery: 'alpha' });
      });

      expect(result.current.filteredProposals).toHaveLength(1);
      expect(result.current.filteredProposals[0]!.proposal.title).toBe('Alpha Project');
    });

    it('should filter by status', () => {
      const { result } = renderHook(() => useProposals());
      let id1: string;

      act(() => {
        id1 = result.current.createProposal('potlock-standard', 'A');
        result.current.createProposal('potlock-standard', 'B');
      });

      act(() => {
        result.current.updateStatus(id1!, 'ready');
      });

      act(() => {
        result.current.setFilter({ status: 'ready' });
      });

      expect(result.current.filteredProposals).toHaveLength(1);
    });

    it('should clear filter', () => {
      const { result } = renderHook(() => useProposals());

      act(() => {
        result.current.createProposal('potlock-standard', 'Test');
        result.current.setFilter({ status: 'ready' });
      });

      act(() => {
        result.current.clearFilter();
      });

      expect(result.current.filter).toEqual({});
      expect(result.current.filteredProposals).toHaveLength(1);
    });
  });

  describe('getCompleteness', () => {
    it('should return completeness result', () => {
      const { result } = renderHook(() => useProposals());
      let proposalId: string;

      act(() => {
        proposalId = result.current.createProposal('potlock-standard', 'Test');
      });

      const completeness = result.current.getCompleteness(proposalId!);
      expect(completeness).toBeDefined();
      // Optional empty sections count as complete, so percentage > 0
      expect(completeness!.percentage).toBeGreaterThanOrEqual(0);
      expect(completeness!.isComplete).toBe(false);
    });

    it('should return null for non-existent proposal', () => {
      const { result } = renderHook(() => useProposals());
      expect(result.current.getCompleteness('nonexistent')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set and clear error', () => {
      const { result } = renderHook(() => useProposals());

      act(() => {
        result.current.setError('Something went wrong');
      });
      expect(result.current.error).toBe('Something went wrong');

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});
