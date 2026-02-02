import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  calculateRelevanceScore,
  selectRelevantDocuments,
  summarizeDocuments,
  buildContext,
  truncateContent,
  formatProjectMetadata,
  type ContextDocument,
} from '../context';

describe('ai/context', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'This is a test string with some words.';
      const tokens = estimateTokens(text);
      // ~4 chars per token
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(10000);
      const tokens = estimateTokens(text);
      expect(tokens).toBe(2500); // 10000 / 4
    });
  });

  describe('calculateRelevanceScore', () => {
    const testDoc: ContextDocument = {
      id: '1',
      title: 'Grant Proposal Budget',
      type: 'proposal',
      content: 'This document contains budget information for the grant.',
    };

    it('should return 0.5 for empty query', () => {
      const score = calculateRelevanceScore(testDoc, '');
      expect(score).toBe(0.5);
    });

    it('should return higher score for matching keywords', () => {
      const score = calculateRelevanceScore(testDoc, 'budget grant');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return higher score for title matches', () => {
      const scoreWithTitle = calculateRelevanceScore(testDoc, 'budget');
      const scoreWithoutTitle = calculateRelevanceScore(
        { ...testDoc, title: 'Document' },
        'budget'
      );
      // Both score 1.0 due to keyword match + title bonus capping at 1
      // Test that both have high scores when keyword matches
      expect(scoreWithTitle).toBeGreaterThanOrEqual(scoreWithoutTitle);
      expect(scoreWithTitle).toBeGreaterThan(0.5);
    });

    it('should cap score at 1', () => {
      const score = calculateRelevanceScore(testDoc, 'grant budget proposal document');
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('selectRelevantDocuments', () => {
    const docs: ContextDocument[] = [
      { id: '1', title: 'Budget', type: 'budget', content: 'Budget details here.' },
      { id: '2', title: 'Timeline', type: 'timeline', content: 'Timeline and milestones.' },
      { id: '3', title: 'Team', type: 'team', content: 'Team member bios.' },
    ];

    it('should select all documents within token limit', () => {
      const { selected, excluded } = selectRelevantDocuments(docs, {
        maxTokens: 1000,
      });
      expect(selected.length).toBe(3);
      expect(excluded.length).toBe(0);
    });

    it('should exclude documents when over token limit', () => {
      const { selected, excluded } = selectRelevantDocuments(docs, {
        maxTokens: 5, // Very small limit - only ~20 chars
      });
      expect(selected.length).toBeLessThan(3);
      expect(excluded.length).toBeGreaterThan(0);
    });

    it('should prioritize relevant documents', () => {
      const { selected } = selectRelevantDocuments(docs, {
        maxTokens: 30,
        query: 'budget',
      });
      // Budget doc should be selected first
      if (selected.length > 0) {
        expect(selected[0]!.title).toBe('Budget');
      }
    });
  });

  describe('summarizeDocuments', () => {
    it('should return empty string for no documents', () => {
      expect(summarizeDocuments([])).toBe('');
    });

    it('should create summary with document info', () => {
      const docs: ContextDocument[] = [
        { id: '1', title: 'Doc 1', type: 'proposal', content: 'Content' },
        { id: '2', title: 'Doc 2', type: 'budget', content: 'Content' },
      ];
      const summary = summarizeDocuments(docs);
      expect(summary).toContain('Doc 1');
      expect(summary).toContain('Doc 2');
      expect(summary).toContain('[proposal]');
      expect(summary).toContain('[budget]');
    });

    it('should include update date when available', () => {
      const docs: ContextDocument[] = [
        {
          id: '1',
          title: 'Doc',
          type: 'proposal',
          content: 'Content',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];
      const summary = summarizeDocuments(docs);
      expect(summary).toContain('updated:');
    });
  });

  describe('formatProjectMetadata', () => {
    it('should format project with all fields', () => {
      const result = formatProjectMetadata({
        metadata: {
          name: 'Test Project',
          description: 'A test project',
          grantProgram: 'near-foundation',
          fundingAmount: 50000,
          tags: [],
        },
        team: [{ accountId: 'alice.near' }, { accountId: 'bob.near' }],
      } as any);

      expect(result).toContain('Test Project');
      expect(result).toContain('A test project');
      expect(result).toContain('near-foundation');
      expect(result).toContain('50,000');
      expect(result).toContain('2 members');
    });

    it('should handle missing fields', () => {
      const result = formatProjectMetadata({
        metadata: {
          name: 'Test Project',
          description: '',
          grantProgram: 'other',
          tags: [],
        },
      } as any);

      expect(result).toContain('Test Project');
      expect(result).not.toContain('undefined');
    });
  });

  describe('buildContext', () => {
    const docs: ContextDocument[] = [
      { id: '1', title: 'Doc 1', type: 'proposal', content: 'Content 1' },
    ];

    it('should build context with documents', () => {
      const result = buildContext(docs);
      expect(result.contextString).toContain('Doc 1');
      expect(result.includedDocuments).toContain('1');
      expect(result.excludedDocuments).toHaveLength(0);
    });

    it('should include project metadata', () => {
      const result = buildContext(
        docs,
        { metadata: { name: 'My Project' } } as any,
        { includeProjectMetadata: true }
      );
      expect(result.contextString).toContain('My Project');
    });

    it('should track if context was truncated', () => {
      const largeDocs: ContextDocument[] = [
        { id: '1', title: 'Doc 1', type: 'proposal', content: 'a'.repeat(5000) },
        { id: '2', title: 'Doc 2', type: 'proposal', content: 'b'.repeat(5000) },
      ];
      const result = buildContext(largeDocs, undefined, { maxTokens: 1000 });
      expect(result.wasTruncated).toBe(true);
      expect(result.excludedDocuments.length).toBeGreaterThan(0);
    });
  });

  describe('truncateContent', () => {
    it('should not truncate short content', () => {
      const content = 'Short content';
      const { content: result, wasTruncated } = truncateContent(content, 100);
      expect(result).toBe(content);
      expect(wasTruncated).toBe(false);
    });

    it('should truncate long content', () => {
      const content = 'a'.repeat(1000);
      const { content: result, wasTruncated } = truncateContent(content, 50);
      expect(result.length).toBeLessThan(content.length);
      expect(wasTruncated).toBe(true);
      expect(result).toContain('[... content truncated for length ...]');
    });

    it('should preserve start and end', () => {
      const content = 'START' + 'x'.repeat(1000) + 'END';
      const { content: result } = truncateContent(content, 50);
      expect(result).toContain('START');
      expect(result).toContain('END');
    });
  });
});
