/**
 * AI Module Exports
 *
 * Central export point for all AI-related functionality.
 */

// Client
export {
  NEARAIClient,
  getAIClient,
  resetAIClient,
  type NEARAIClientConfig,
  type StreamCallbacks,
  type ChatOptions,
} from './client';

// Prompts
export {
  SYSTEM_PROMPTS,
  PROMPT_SUGGESTIONS,
  getSystemPrompt,
  createContextualPrompt,
  getPromptSuggestionsByCategory,
  getPersonaDisplayName,
  getPersonaDescription,
  type ProjectContext,
  type DocumentContext,
} from './prompts';

// Context
export {
  buildContext,
  estimateTokens,
  calculateRelevanceScore,
  selectRelevantDocuments,
  summarizeDocuments,
  formatProjectMetadata,
  truncateContent,
  extractKeySections,
  type ContextDocument,
  type BuiltContext,
  type ContextBuildOptions,
} from './context';

// Attestation
export {
  verifyAttestation,
  formatAttestation,
  getTeeDescription,
  formatHash,
  getVerificationBadge,
  createVerificationReport,
  isPrivateComputation,
  getExternalVerificationUrl,
} from './attestation';
