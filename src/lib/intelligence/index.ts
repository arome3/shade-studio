/**
 * Intelligence Module Exports
 *
 * Central export point for daily briefing and intelligence functionality.
 */

// Briefing Generator
export {
  generateDailyBriefing,
  generateDefaultBriefing,
  parseJsonResponse,
  validatePriority,
  validateItemType,
  validatePipelineStatus,
  normalizeItems,
  getPriorityColor,
  getPriorityBgColor,
  getStatusColor,
  getItemStatusColor,
  type BriefingGenerationContext,
} from './briefing';

// Prompts
export {
  BRIEFING_SYSTEM_PROMPT,
  DEFAULT_BRIEFING_PROMPT,
  buildBriefingUserPrompt,
  getTimeOfDay,
  getDaysUntil,
  toDeadlineContext,
  type BriefingProjectContext,
  type BriefingDeadlineContext,
} from './prompts';
