import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPTS,
  PROMPT_SUGGESTIONS,
  getSystemPrompt,
  createContextualPrompt,
  getPromptSuggestionsByCategory,
  getPersonaDisplayName,
  getPersonaDescription,
} from '../prompts';
import type { SystemPromptType } from '@/types/ai';

describe('ai/prompts', () => {
  describe('SYSTEM_PROMPTS', () => {
    it('should have all persona types defined', () => {
      const personas: SystemPromptType[] = [
        'grantWriter',
        'documentReviewer',
        'technicalWriter',
        'dailyBriefing',
        'competitiveAnalysis',
      ];

      for (const persona of personas) {
        expect(SYSTEM_PROMPTS[persona]).toBeDefined();
        expect(typeof SYSTEM_PROMPTS[persona]).toBe('string');
        expect(SYSTEM_PROMPTS[persona].length).toBeGreaterThan(0);
      }
    });

    it('should mention TEE in all prompts', () => {
      for (const prompt of Object.values(SYSTEM_PROMPTS)) {
        expect(prompt.toLowerCase()).toContain('tee');
      }
    });
  });

  describe('getSystemPrompt', () => {
    it('should return prompt for valid persona', () => {
      const prompt = getSystemPrompt('grantWriter');
      expect(prompt).toBe(SYSTEM_PROMPTS.grantWriter);
    });

    it('should return grantWriter as default for invalid persona', () => {
      const prompt = getSystemPrompt('invalid' as SystemPromptType);
      expect(prompt).toBe(SYSTEM_PROMPTS.grantWriter);
    });
  });

  describe('createContextualPrompt', () => {
    it('should include base prompt', () => {
      const prompt = createContextualPrompt('grantWriter');
      expect(prompt).toContain(SYSTEM_PROMPTS.grantWriter);
    });

    it('should add project context', () => {
      const prompt = createContextualPrompt('grantWriter', {
        projectName: 'Test Project',
        projectDescription: 'A test project',
        grantProgram: 'NEAR Foundation',
      });

      expect(prompt).toContain('Test Project');
      expect(prompt).toContain('A test project');
      expect(prompt).toContain('NEAR Foundation');
    });

    it('should add document context', () => {
      const prompt = createContextualPrompt('documentReviewer', undefined, {
        title: 'Budget Document',
        type: 'budget',
        content: 'Budget details here',
      });

      expect(prompt).toContain('Budget Document');
      expect(prompt).toContain('budget');
      expect(prompt).toContain('Budget details here');
    });

    it('should truncate long document content', () => {
      const longContent = 'x'.repeat(5000);
      const prompt = createContextualPrompt('grantWriter', undefined, {
        title: 'Long Doc',
        type: 'proposal',
        content: longContent,
      });

      expect(prompt).toContain('[content truncated]');
      expect(prompt.length).toBeLessThan(SYSTEM_PROMPTS.grantWriter.length + 5000);
    });

    it('should include deadline if provided', () => {
      const prompt = createContextualPrompt('grantWriter', {
        deadline: '2024-12-31',
      });

      expect(prompt).toContain('Deadline');
    });

    it('should include team size if provided', () => {
      const prompt = createContextualPrompt('grantWriter', {
        teamSize: 5,
      });

      expect(prompt).toContain('5 members');
    });
  });

  describe('PROMPT_SUGGESTIONS', () => {
    it('should have unique IDs', () => {
      const ids = PROMPT_SUGGESTIONS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have labels and prompts', () => {
      for (const suggestion of PROMPT_SUGGESTIONS) {
        expect(suggestion.label).toBeDefined();
        expect(suggestion.label.length).toBeGreaterThan(0);
        // Note: "ask a question" has empty prompt
      }
    });

    it('should have valid categories', () => {
      const validCategories = ['writing', 'analysis', 'research', 'general'];
      for (const suggestion of PROMPT_SUGGESTIONS) {
        if (suggestion.category) {
          expect(validCategories).toContain(suggestion.category);
        }
      }
    });
  });

  describe('getPromptSuggestionsByCategory', () => {
    it('should return all suggestions when no category', () => {
      const all = getPromptSuggestionsByCategory();
      expect(all).toEqual(PROMPT_SUGGESTIONS);
    });

    it('should filter by category', () => {
      const writing = getPromptSuggestionsByCategory('writing');
      expect(writing.every((s) => s.category === 'writing')).toBe(true);

      const analysis = getPromptSuggestionsByCategory('analysis');
      expect(analysis.every((s) => s.category === 'analysis')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const result = getPromptSuggestionsByCategory('nonexistent' as any);
      expect(result).toEqual([]);
    });
  });

  describe('getPersonaDisplayName', () => {
    it('should return display name for valid persona', () => {
      expect(getPersonaDisplayName('grantWriter')).toBe('Grant Writer');
      expect(getPersonaDisplayName('documentReviewer')).toBe('Document Reviewer');
      expect(getPersonaDisplayName('technicalWriter')).toBe('Technical Writer');
      expect(getPersonaDisplayName('dailyBriefing')).toBe('Intelligence Analyst');
      expect(getPersonaDisplayName('competitiveAnalysis')).toBe('Competitive Analyst');
    });

    it('should return fallback for invalid persona', () => {
      expect(getPersonaDisplayName('invalid' as SystemPromptType)).toBe(
        'AI Assistant'
      );
    });
  });

  describe('getPersonaDescription', () => {
    it('should return description for valid persona', () => {
      const desc = getPersonaDescription('grantWriter');
      expect(desc).toBeDefined();
      expect(desc.length).toBeGreaterThan(0);
    });

    it('should return different descriptions for different personas', () => {
      const grantWriter = getPersonaDescription('grantWriter');
      const reviewer = getPersonaDescription('documentReviewer');
      expect(grantWriter).not.toBe(reviewer);
    });

    it('should return fallback for invalid persona', () => {
      expect(getPersonaDescription('invalid' as SystemPromptType)).toBe(
        'General-purpose AI assistant'
      );
    });
  });
});
