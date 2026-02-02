/**
 * Barrel export for all types.
 * Import types from '@/types' for convenience.
 */

// Project types
export type {
  ProjectVisibility,
  ProjectStatus,
  GrantProgram,
  TeamRole,
  TeamMember,
  ProjectMetadata,
  Project,
  EncryptedProject,
  ProjectListItem,
  CreateProjectInput,
  UpdateProjectInput,
} from './project';

// Document types
export type {
  DocumentType,
  DocumentStatus,
  EncryptedPayload,
  DocumentContent,
  DocumentSection,
  DocumentAttachment,
  DocumentMetadata,
  Document,
  EncryptedDocument,
  DocumentListItem,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentVersion,
} from './document';

// Proposal types
export type {
  ProposalStatus,
  MilestoneStatus,
  BudgetCategory,
  BudgetItem,
  Milestone,
  ProposalTeamMember,
  ProposalContent,
  Proposal,
  EncryptedProposal,
  ProposalListItem,
  CreateProposalInput,
  UpdateProposalInput,
  GrantProgramInfo,
} from './proposal';

// AI types
export type {
  AIModel,
  AIOperation,
  AIContext,
  AIMessage,
  AIRequest,
  AIResponse,
  TEEAttestation,
  AISession,
  AISuggestion,
  AIAnalysis,
  AIFeatureConfig,
  // NEAR AI Cloud types
  MessageRole,
  ChatMessage,
  SystemPromptType,
  ChatRequest,
  ChatResponse,
  NEARAIAttestation,
  AttestationVerificationResult,
  NEARAIModelId,
  PromptSuggestion,
} from './ai';

export { AI_MODELS } from './ai';

// Intelligence types
export type {
  BriefingPriority,
  BriefingItemType,
  BriefingItem,
  DailyBriefing,
  BriefingMetrics,
  GrantOpportunity,
  NotificationPreferences,
  IntelligenceFeed,
  SavedOpportunity,
  TrackedDeadline,
} from './intelligence';

// ZK types
export type {
  ZKCircuit,
  ProofStatus,
  CircuitArtifacts,
  PublicInputs,
  PrivateInputs,
  ZKProof,
  ZKCredential,
  GrantEligibilityInputs,
  MilestoneCompletionInputs,
  FundUsageInputs,
  ProofGenerationRequest,
  ProofVerificationRequest,
  ProofVerificationResult,
  ProverState,
  CircuitLoadProgress,
} from './zk';

// ============================================================================
// Utility Types
// ============================================================================

/** Make all properties optional recursively */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Make specified keys required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specified keys optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/** Extract the type of array elements */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/** Create a type with only the specified keys */
export type PickByValue<T, V> = Pick<
  T,
  { [K in keyof T]: T[K] extends V ? K : never }[keyof T]
>;

/** Async function return type */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

/** Nullable type */
export type Nullable<T> = T | null;

/** Maybe type (nullable and optional) */
export type Maybe<T> = T | null | undefined;

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Pagination params */
export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    cursor?: string;
  };
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Sort params */
export interface SortParams<T> {
  field: keyof T;
  direction: SortDirection;
}

/** Filter operator */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn';

/** Filter condition */
export interface FilterCondition<T> {
  field: keyof T;
  operator: FilterOperator;
  value: unknown;
}

/** NEAR account ID type alias */
export type AccountId = string;

/** Transaction hash type alias */
export type TransactionHash = string;

/** Timestamp in ISO 8601 format */
export type ISOTimestamp = string;

/** Base entity with common fields */
export interface BaseEntity {
  id: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Entity with owner */
export interface OwnedEntity extends BaseEntity {
  ownerId: AccountId;
}
