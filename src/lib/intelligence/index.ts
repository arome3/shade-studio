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

// Decision Journal
export {
  analyzeDecision,
  filterDecisions,
  exportDecisionsToMarkdown,
  getCategoryBadgeVariant,
  getStatusBadgeVariant,
  getOutcomeBadgeVariant,
  getOutcomeColor,
  getOutcomeBgColor,
  getCategoryLabel,
  getOutcomeLabel,
  getStatusLabel,
} from './decisions';

// Meeting Notes Pipeline
export {
  processMeetingNotes,
  filterMeetings,
  calculateMeetingStats,
  exportMeetingsToMarkdown,
  getMeetingTypeBadgeVariant,
  getMeetingTypeLabel,
  getActionPriorityBadgeVariant,
  getActionPriorityLabel,
  getActionStatusBadgeVariant,
  getActionStatusLabel,
  type MeetingStats,
} from './meetings';

// Weekly Synthesis
export {
  getWeekBounds,
  gatherWeeklyData,
  generateWeeklySynthesis,
  exportSynthesisToMarkdown,
  validateSynthesisImport,
  getTrendDirectionBadgeVariant,
  getRecommendationPriorityColor,
  getRecommendationPriorityBadgeVariant,
  getSynthesisStatusBadgeVariant,
  getEffortBadgeVariant,
  type WeekBounds,
  type WeeklyDataContext,
  type ImportValidationResult,
} from './synthesis';
