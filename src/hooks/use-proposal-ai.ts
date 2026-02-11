'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  improveSection,
  generateSectionContent,
  reviewSection,
  reviewFullProposal,
  customSectionPrompt,
} from '@/lib/proposals/ai-prompts';
import { useProposalStore } from '@/stores/proposal-store';
import type { ProposalSection } from '@/types/proposal';

// ============================================================================
// Types
// ============================================================================

export type AIAction = 'improve' | 'generate' | 'review' | 'review-full' | 'custom';

export interface UseProposalAIReturn {
  // State
  suggestion: string | null;
  isGenerating: boolean;
  aiError: string | null;
  lastAction: AIAction | null;

  // Actions
  improve: (proposalId: string, sectionId: string) => Promise<void>;
  generate: (proposalId: string, sectionId: string) => Promise<void>;
  review: (proposalId: string, sectionId: string) => Promise<void>;
  reviewAll: (proposalId: string) => Promise<void>;
  customPrompt: (proposalId: string, sectionId: string, prompt: string) => Promise<void>;
  insertSuggestion: (proposalId: string, sectionId: string) => void;
  clearSuggestion: () => void;
  cancel: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useProposalAI(): UseProposalAIReturn {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<AIAction | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const getWorkflowAndSection = (
    proposalId: string,
    sectionId: string
  ): { section: ProposalSection; title: string; allSections: ProposalSection[] } | null => {
    const workflow = useProposalStore.getState().proposals[proposalId];
    if (!workflow) return null;
    const section = workflow.sections.find((s) => s.id === sectionId);
    if (!section) return null;
    return {
      section,
      title: workflow.proposal.title,
      allSections: workflow.sections,
    };
  };

  const runAIAction = useCallback(
    async (action: AIAction, fn: (controller: AbortController) => Promise<string>) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setAiError(null);
      setSuggestion(null);
      setLastAction(action);

      try {
        const result = await fn(controller);
        if (!controller.signal.aborted) {
          setSuggestion(result);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setAiError(err instanceof Error ? err.message : 'AI request failed');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    []
  );

  const improve = useCallback(
    async (proposalId: string, sectionId: string) => {
      const ctx = getWorkflowAndSection(proposalId, sectionId);
      if (!ctx) return;

      await runAIAction('improve', (controller) =>
        improveSection(ctx.section, ctx.title, { abortController: controller })
      );
    },
    [runAIAction]
  );

  const generate = useCallback(
    async (proposalId: string, sectionId: string) => {
      const ctx = getWorkflowAndSection(proposalId, sectionId);
      if (!ctx) return;

      await runAIAction('generate', (controller) =>
        generateSectionContent(ctx.section, ctx.title, ctx.allSections, {
          abortController: controller,
        })
      );
    },
    [runAIAction]
  );

  const review = useCallback(
    async (proposalId: string, sectionId: string) => {
      const ctx = getWorkflowAndSection(proposalId, sectionId);
      if (!ctx) return;

      await runAIAction('review', (controller) =>
        reviewSection(ctx.section, ctx.title, { abortController: controller })
      );
    },
    [runAIAction]
  );

  const reviewAll = useCallback(
    async (proposalId: string) => {
      const workflow = useProposalStore.getState().proposals[proposalId];
      if (!workflow) return;

      await runAIAction('review-full', (controller) =>
        reviewFullProposal(workflow.sections, workflow.proposal.title, {
          abortController: controller,
        })
      );
    },
    [runAIAction]
  );

  const customPromptAction = useCallback(
    async (proposalId: string, sectionId: string, prompt: string) => {
      const ctx = getWorkflowAndSection(proposalId, sectionId);
      if (!ctx) return;

      await runAIAction('custom', (controller) =>
        customSectionPrompt(ctx.section, ctx.title, prompt, {
          abortController: controller,
        })
      );
    },
    [runAIAction]
  );

  const insertSuggestion = useCallback(
    (proposalId: string, sectionId: string) => {
      if (!suggestion) return;
      useProposalStore.getState().updateSection(proposalId, sectionId, suggestion);
      setSuggestion(null);
      setLastAction(null);
    },
    [suggestion]
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setAiError(null);
    setLastAction(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return {
    suggestion,
    isGenerating,
    aiError,
    lastAction,
    improve,
    generate,
    review,
    reviewAll,
    customPrompt: customPromptAction,
    insertSuggestion,
    clearSuggestion,
    cancel,
  };
}
