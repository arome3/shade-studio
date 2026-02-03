/**
 * Tests for the briefing generator module.
 */

import { describe, it, expect } from 'vitest';
import {
  parseJsonResponse,
  validatePriority,
  validateItemType,
  validatePipelineStatus,
  normalizeItems,
  generateDefaultBriefing,
  getPriorityColor,
  getStatusColor,
} from '../briefing';

describe('parseJsonResponse', () => {
  it('should parse valid JSON', () => {
    const json = '{"greeting": "Hello", "summary": "Test summary"}';
    const result = parseJsonResponse(json);
    expect(result.greeting).toBe('Hello');
    expect(result.summary).toBe('Test summary');
  });

  it('should handle JSON wrapped in markdown code blocks', () => {
    const json = '```json\n{"greeting": "Hello"}\n```';
    const result = parseJsonResponse(json);
    expect(result.greeting).toBe('Hello');
  });

  it('should handle JSON with surrounding text', () => {
    const json = 'Here is the response:\n{"greeting": "Hello"}\nEnd of response';
    const result = parseJsonResponse(json);
    expect(result.greeting).toBe('Hello');
  });

  it('should throw on invalid JSON', () => {
    const invalid = 'not valid json';
    expect(() => parseJsonResponse(invalid)).toThrow();
  });
});

describe('validatePriority', () => {
  it('should accept valid priorities', () => {
    expect(validatePriority('critical')).toBe('critical');
    expect(validatePriority('high')).toBe('high');
    expect(validatePriority('medium')).toBe('medium');
    expect(validatePriority('low')).toBe('low');
  });

  it('should be case insensitive', () => {
    expect(validatePriority('HIGH')).toBe('high');
    expect(validatePriority('CRITICAL')).toBe('critical');
  });

  it('should return medium for invalid priorities', () => {
    expect(validatePriority('invalid')).toBe('medium');
    expect(validatePriority(undefined)).toBe('medium');
    expect(validatePriority('')).toBe('medium');
  });
});

describe('validateItemType', () => {
  it('should accept valid item types', () => {
    expect(validateItemType('deadline')).toBe('deadline');
    expect(validateItemType('opportunity')).toBe('opportunity');
    expect(validateItemType('action-required')).toBe('action-required');
  });

  it('should handle underscores', () => {
    expect(validateItemType('action_required')).toBe('action-required');
  });

  it('should return update for invalid types', () => {
    expect(validateItemType('invalid')).toBe('update');
    expect(validateItemType(undefined)).toBe('update');
  });
});

describe('validatePipelineStatus', () => {
  it('should accept valid statuses', () => {
    expect(validatePipelineStatus('researching')).toBe('researching');
    expect(validatePipelineStatus('drafting')).toBe('drafting');
    expect(validatePipelineStatus('submitted')).toBe('submitted');
    expect(validatePipelineStatus('approved')).toBe('approved');
  });

  it('should return researching for invalid statuses', () => {
    expect(validatePipelineStatus('invalid')).toBe('researching');
    expect(validatePipelineStatus(undefined)).toBe('researching');
  });
});

describe('normalizeItems', () => {
  it('should normalize valid items', () => {
    const rawItems = [
      { title: 'Task 1', description: 'Description 1', priority: 'high' },
      { title: 'Task 2', description: 'Description 2', priority: 'low' },
    ];
    const result = normalizeItems(rawItems);

    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe('Task 1');
    expect(result[0]?.priority).toBe('high');
    expect(result[0]?.isRead).toBe(false);
    expect(result[0]?.status).toBe('pending');
  });

  it('should filter out items without title or description', () => {
    const rawItems = [
      { title: 'Valid', description: 'Valid' },
      { title: 'No desc' },
      { description: 'No title' },
    ];
    const result = normalizeItems(rawItems as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Valid');
  });

  it('should limit items to maxItems', () => {
    const rawItems = Array.from({ length: 10 }, (_, i) => ({
      title: `Task ${i}`,
      description: `Desc ${i}`,
    }));
    const result = normalizeItems(rawItems, 3);
    expect(result).toHaveLength(3);
  });

  it('should handle empty or undefined input', () => {
    expect(normalizeItems(undefined as any)).toEqual([]);
    expect(normalizeItems([])).toEqual([]);
  });

  it('should generate unique IDs', () => {
    const rawItems = [
      { title: 'Task 1', description: 'Desc 1' },
      { title: 'Task 2', description: 'Desc 2' },
    ];
    const result = normalizeItems(rawItems);
    expect(result[0]?.id).not.toBe(result[1]?.id);
  });
});

describe('generateDefaultBriefing', () => {
  it('should generate a valid default briefing', () => {
    const briefing = generateDefaultBriefing('test.near');

    expect(briefing.accountId).toBe('test.near');
    expect(briefing.greeting).toBeDefined();
    expect(briefing.summary).toBeDefined();
    expect(briefing.items).toHaveLength(2);
    expect(briefing.metrics.actionRequired).toBe(2);
    expect(briefing.recommendations).toHaveLength(1);
  });

  it('should use correct date format', () => {
    const briefing = generateDefaultBriefing('test.near');
    expect(briefing.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getPriorityColor', () => {
  it('should return correct colors', () => {
    expect(getPriorityColor('critical')).toBe('text-error');
    expect(getPriorityColor('high')).toBe('text-warning');
    expect(getPriorityColor('medium')).toBe('text-near-green-500');
    expect(getPriorityColor('low')).toBe('text-text-muted');
  });
});

describe('getStatusColor', () => {
  it('should return correct colors for pipeline statuses', () => {
    expect(getStatusColor('approved')).toBe('text-success');
    expect(getStatusColor('submitted')).toBe('text-near-green-500');
    expect(getStatusColor('rejected')).toBe('text-error');
    expect(getStatusColor('researching')).toBe('text-text-muted');
  });
});
