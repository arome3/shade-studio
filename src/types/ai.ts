/**
 * AI and TEE attestation types for Private Grant Studio.
 * Handles AI-assisted writing and Phala TEE attestations.
 */

/** AI model identifiers */
export type AIModel =
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'llama-3-70b';

/** AI operation types */
export type AIOperation =
  | 'generate'
  | 'improve'
  | 'summarize'
  | 'expand'
  | 'simplify'
  | 'translate'
  | 'analyze'
  | 'chat';

/** AI request context */
export interface AIContext {
  /** Current document content */
  documentContent?: string;
  /** Project metadata for context */
  projectMetadata?: {
    name: string;
    description: string;
    grantProgram: string;
  };
  /** Specific section being edited */
  currentSection?: string;
  /** Selected text to operate on */
  selection?: string;
  /** Conversation history for chat */
  conversationHistory?: AIMessage[];
}

/** AI chat message */
export interface AIMessage {
  /** Message identifier */
  id: string;
  /** Role: user or assistant */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: string;
}

/** AI request payload */
export interface AIRequest {
  /** Operation type */
  operation: AIOperation;
  /** User prompt */
  prompt: string;
  /** Context for the AI */
  context: AIContext;
  /** Model preference */
  model?: AIModel;
  /** Temperature (0-1) */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
}

/** AI response payload */
export interface AIResponse {
  /** Request identifier */
  requestId: string;
  /** Generated content */
  content: string;
  /** Model used */
  model: AIModel;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** TEE attestation if available */
  attestation?: TEEAttestation;
  /** Processing time in ms */
  processingTime: number;
  /** Timestamp */
  timestamp: string;
}

/** Phala TEE attestation */
export interface TEEAttestation {
  /** Attestation identifier */
  id: string;
  /** TEE quote/report */
  quote: string;
  /** Public key of the TEE */
  publicKey: string;
  /** Hash of the code running in TEE */
  codeHash: string;
  /** Timestamp of attestation */
  timestamp: string;
  /** Attestation certificate chain */
  certificateChain: string[];
  /** Verification status */
  verified: boolean;
}

/** AI session for tracking conversations */
export interface AISession {
  /** Session identifier */
  id: string;
  /** Associated document ID */
  documentId?: string;
  /** Associated project ID */
  projectId?: string;
  /** Conversation messages */
  messages: AIMessage[];
  /** Session metadata */
  metadata: {
    model: AIModel;
    totalTokens: number;
    startedAt: string;
    lastActivityAt: string;
  };
}

/** AI writing suggestion */
export interface AISuggestion {
  /** Suggestion identifier */
  id: string;
  /** Type of suggestion */
  type: 'grammar' | 'clarity' | 'tone' | 'structure' | 'content';
  /** Original text */
  original: string;
  /** Suggested replacement */
  suggestion: string;
  /** Explanation for the suggestion */
  explanation: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Position in document */
  position: {
    start: number;
    end: number;
  };
}

/** AI analysis result */
export interface AIAnalysis {
  /** Analysis identifier */
  id: string;
  /** Document or section analyzed */
  targetId: string;
  /** Analysis type */
  type: 'readability' | 'completeness' | 'compliance' | 'sentiment';
  /** Analysis score (0-100) */
  score: number;
  /** Detailed findings */
  findings: {
    category: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    location?: string;
  }[];
  /** Recommendations */
  recommendations: string[];
  /** Timestamp */
  timestamp: string;
}

/** AI feature configuration */
export interface AIFeatureConfig {
  /** Whether AI features are enabled */
  enabled: boolean;
  /** Default model to use */
  defaultModel: AIModel;
  /** Max requests per day */
  dailyLimit: number;
  /** Current usage count */
  usageCount: number;
  /** Features enabled */
  features: {
    generation: boolean;
    suggestions: boolean;
    analysis: boolean;
    chat: boolean;
  };
}

// ============================================================================
// NEAR AI Cloud Specific Types
// ============================================================================

/** Message role for chat completions */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Chat message for NEAR AI Cloud */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Creation timestamp */
  createdAt: string;
  /** TEE attestation for assistant messages */
  attestation?: NEARAIAttestation;
  /** Whether message is currently streaming */
  isStreaming?: boolean;
}

/** System prompt type enum for AI personas */
export type SystemPromptType =
  | 'grantWriter'
  | 'documentReviewer'
  | 'technicalWriter'
  | 'dailyBriefing'
  | 'competitiveAnalysis';

/** Chat request for NEAR AI Cloud */
export interface ChatRequest {
  /** Conversation messages */
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  /** Model to use */
  model?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** System prompt type */
  persona?: SystemPromptType;
}

/** Chat response from NEAR AI Cloud */
export interface ChatResponse {
  /** Response identifier */
  id: string;
  /** Object type */
  object: 'chat.completion' | 'chat.completion.chunk';
  /** Creation timestamp (unix) */
  created: number;
  /** Model used */
  model: string;
  /** Response choices */
  choices: Array<{
    /** Choice index */
    index: number;
    /** Message content */
    message?: {
      role: MessageRole;
      content: string;
    };
    /** Delta for streaming */
    delta?: {
      role?: MessageRole;
      content?: string;
    };
    /** Finish reason */
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  /** Token usage (non-streaming only) */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** NEAR AI Cloud TEE Attestation (extended format) */
export interface NEARAIAttestation {
  /** Attestation version */
  version: string;
  /** TEE type (e.g., 'intel-tdx', 'amd-sev') */
  tee_type: string;
  /** Enclave/VM identifier */
  enclave_id: string;
  /** Hash of code running in TEE */
  code_hash: string;
  /** Attestation timestamp (ISO 8601) */
  timestamp: string;
  /** Raw attestation quote (base64) */
  quote: string;
  /** Additional claims */
  claims?: Record<string, unknown>;
  /** Signature over attestation */
  signature?: string;
}

/** Attestation verification result */
export interface AttestationVerificationResult {
  /** Whether attestation is valid */
  isValid: boolean;
  /** Verification status */
  status: 'verified' | 'unverified' | 'expired' | 'invalid' | 'error';
  /** Human-readable message */
  message: string;
  /** Verification timestamp */
  verifiedAt?: string;
  /** Detailed error if any */
  error?: string;
  /** Warnings (e.g., attestation is old but valid) */
  warnings?: string[];
}

/** Available AI models on NEAR AI Cloud */
export const AI_MODELS = [
  {
    id: 'deepseek-ai/DeepSeek-V3.1',
    name: 'DeepSeek V3.1',
    provider: 'DeepSeek',
    description: 'Large, powerful model for complex tasks',
  },
  {
    id: 'Qwen/Qwen3-30B-A3B-Instruct-2507',
    name: 'Qwen 3 30B',
    provider: 'Alibaba',
    description: 'Fast, efficient model for quick responses',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'OpenAI',
    description: 'Open-source GPT model with strong reasoning',
  },
] as const;

/** AI model ID type derived from available models */
export type NEARAIModelId = (typeof AI_MODELS)[number]['id'];

/** Prompt suggestion for quick actions */
export interface PromptSuggestion {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Full prompt text */
  prompt: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Category for grouping */
  category?: 'writing' | 'analysis' | 'research' | 'general';
}

// ============================================================================
// Re-exports from Enhanced Attestation Module
// ============================================================================

/**
 * For comprehensive attestation verification with caching and detailed feedback,
 * use the enhanced attestation module:
 *
 * @example
 * ```typescript
 * import { verifyAttestation, TEEInfo, VerificationResult } from '@/lib/attestation';
 * import { useAttestationEnhanced } from '@/hooks/use-attestation-enhanced';
 * import { AttestationDetails, TEEExplainer } from '@/components/features/attestation';
 * ```
 *
 * The enhanced module provides:
 * - Multi-step verification with progress tracking
 * - In-memory caching with TTL
 * - Detailed verification steps
 * - Educational TEE explainer components
 */
export type {
  TEEType,
  TEEInfo,
  TEEAttestation as ExtendedTEEAttestation,
  VerificationResult,
  VerificationStep,
  VerificationOptions,
} from './attestation';
