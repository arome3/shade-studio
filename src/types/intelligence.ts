/**
 * Daily briefing and intelligence types for Private Grant Studio.
 * Handles personalized daily updates and grant opportunity tracking.
 */

import type { NEARAIAttestation } from './ai';

/** Priority level for briefing items */
export type BriefingPriority = 'critical' | 'high' | 'medium' | 'low';

/** Item status for tracking completion */
export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'deferred';

/** Grant pipeline status */
export type GrantPipelineStatus =
  | 'researching'
  | 'drafting'
  | 'review'
  | 'submitted'
  | 'approved'
  | 'rejected';

/** Grant pipeline item for tracking application progress */
export interface GrantPipelineItem {
  /** Grant program name */
  program: string;
  /** Current status in the pipeline */
  status: GrantPipelineStatus;
  /** Application deadline */
  deadline?: string;
  /** Requested funding amount */
  amount?: number;
  /** Next action to take */
  nextAction?: string;
  /** Progress percentage (0-100) */
  progress: number;
}

/** Strategic recommendation from AI analysis */
export interface Recommendation {
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected impact level */
  impact: 'high' | 'medium' | 'low';
  /** Implementation effort required */
  effort: 'high' | 'medium' | 'low';
  /** Reasoning behind the recommendation */
  rationale: string;
}

/** Briefing generation options */
export interface BriefingOptions {
  /** Include competitive analysis insights */
  includeCompetitive?: boolean;
  /** Maximum items per section */
  maxItemsPerSection?: number;
  /** Focus areas to prioritize */
  focusAreas?: string[];
  /** Progress callback for streaming */
  onProgress?: (progress: number) => void;
  /** Abort controller for cancellation */
  abortController?: AbortController;
}

/** Type of briefing item */
export type BriefingItemType =
  | 'deadline'
  | 'opportunity'
  | 'update'
  | 'milestone'
  | 'action-required'
  | 'news'
  | 'recommendation';

/** Individual briefing item */
export interface BriefingItem {
  /** Item identifier */
  id: string;
  /** Item type */
  type: BriefingItemType;
  /** Priority level */
  priority: BriefingPriority;
  /** Item title */
  title: string;
  /** Detailed description */
  description: string;
  /** Related project ID if any */
  projectId?: string;
  /** Related proposal ID if any */
  proposalId?: string;
  /** Action URL or deep link */
  actionUrl?: string;
  /** Action button text */
  actionText?: string;
  /** Due date if applicable */
  dueDate?: string;
  /** Source of the information */
  source?: string;
  /** Whether item has been read */
  isRead: boolean;
  /** Whether item has been dismissed */
  isDismissed: boolean;
  /** Item completion status */
  status?: ItemStatus;
  /** Timestamp */
  createdAt: string;
}

/** Daily briefing structure */
export interface DailyBriefing {
  /** Briefing identifier */
  id: string;
  /** User's NEAR account ID */
  accountId: string;
  /** Date of the briefing (YYYY-MM-DD) */
  date: string;
  /** Personalized greeting */
  greeting: string;
  /** Summary of the day */
  summary: string;
  /** Briefing items */
  items: BriefingItem[];
  /** Key metrics */
  metrics: BriefingMetrics;
  /** Weather/market sentiment (optional fun addition) */
  sentiment?: 'bullish' | 'neutral' | 'bearish';
  /** Grant pipeline overview */
  grantPipeline?: GrantPipelineItem[];
  /** Strategic recommendations */
  recommendations?: Recommendation[];
  /** Source document IDs used for generation */
  sourceDocumentIds?: string[];
  /** TEE attestation for privacy verification */
  attestation?: NEARAIAttestation;
  /** Generation timestamp */
  generatedAt: string;
}

/** Briefing metrics overview */
export interface BriefingMetrics {
  /** Active projects count */
  activeProjects: number;
  /** Pending proposals count */
  pendingProposals: number;
  /** Upcoming deadlines (next 7 days) */
  upcomingDeadlines: number;
  /** Tasks requiring action */
  actionRequired: number;
  /** Total funding requested */
  totalFundingRequested: number;
  /** Total funding received */
  totalFundingReceived: number;
}

/** Grant opportunity from external sources */
export interface GrantOpportunity {
  /** Opportunity identifier */
  id: string;
  /** Grant program name */
  programName: string;
  /** Organization offering the grant */
  organization: string;
  /** Grant description */
  description: string;
  /** Funding amount range */
  fundingRange: {
    min: number;
    max: number;
    currency: string;
  };
  /** Application deadline */
  deadline?: string;
  /** Eligibility requirements */
  eligibility: string[];
  /** Required documents */
  requiredDocuments: string[];
  /** Application URL */
  applicationUrl: string;
  /** Tags/categories */
  tags: string[];
  /** Match score (0-100) based on user's projects */
  matchScore?: number;
  /** Whether user has saved this opportunity */
  isSaved: boolean;
  /** Source of the opportunity */
  source: string;
  /** Last updated */
  updatedAt: string;
}

/** User notification preferences */
export interface NotificationPreferences {
  /** Enable daily briefings */
  dailyBriefings: boolean;
  /** Preferred time for daily briefing (HH:mm) */
  briefingTime: string;
  /** Timezone */
  timezone: string;
  /** Email notifications */
  emailNotifications: boolean;
  /** Push notifications */
  pushNotifications: boolean;
  /** Notification categories */
  categories: {
    deadlines: boolean;
    opportunities: boolean;
    milestones: boolean;
    teamUpdates: boolean;
    news: boolean;
  };
  /** Minimum priority to notify */
  minimumPriority: BriefingPriority;
}

/** Intelligence feed for tracking updates */
export interface IntelligenceFeed {
  /** Feed identifier */
  id: string;
  /** User's NEAR account ID */
  accountId: string;
  /** Feed items */
  items: BriefingItem[];
  /** Last fetch timestamp */
  lastFetched: string;
  /** Pagination cursor */
  cursor?: string;
  /** Whether more items available */
  hasMore: boolean;
}

/** Saved opportunity for later */
export interface SavedOpportunity {
  /** Saved record ID */
  id: string;
  /** Opportunity ID */
  opportunityId: string;
  /** User's NEAR account ID */
  accountId: string;
  /** Notes about the opportunity */
  notes?: string;
  /** Reminder date */
  reminderDate?: string;
  /** Associated project ID if mapped */
  projectId?: string;
  /** Status */
  status: 'saved' | 'applied' | 'rejected' | 'archived';
  /** Saved timestamp */
  savedAt: string;
}

/** Deadline tracking */
export interface TrackedDeadline {
  /** Deadline identifier */
  id: string;
  /** User's NEAR account ID */
  accountId: string;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Deadline date (ISO 8601) */
  date: string;
  /** Related project ID */
  projectId?: string;
  /** Related proposal ID */
  proposalId?: string;
  /** Related opportunity ID */
  opportunityId?: string;
  /** Reminder settings */
  reminders: {
    enabled: boolean;
    daysBefore: number[];
  };
  /** Whether completed */
  isCompleted: boolean;
  /** Creation timestamp */
  createdAt: string;
}

// ============================================================================
// Competitive Tracker Types
// ============================================================================

/** Threat level for competitor assessment (1 = low, 5 = critical) */
export type ThreatLevel = 1 | 2 | 3 | 4 | 5;

/** Competitive entry event type */
export type CompetitiveEntryType = 'funding' | 'launch' | 'partnership' | 'news' | 'grant';

/** Tracked competitor */
export interface Competitor {
  /** Unique identifier */
  id: string;
  /** Competitor name */
  name: string;
  /** Brief description */
  description: string;
  /** Website URL */
  website?: string;
  /** Twitter/X handle */
  twitter?: string;
  /** GitHub organization or repo */
  github?: string;
  /** Category tags */
  categories: string[];
  /** Threat level assessment (1-5) */
  threatLevel: ThreatLevel;
  /** Additional notes */
  notes?: string;
  /** Timestamp when competitor was added */
  addedAt: number;
}

/** Competitive intelligence entry */
export interface CompetitiveEntry {
  /** Unique identifier */
  id: string;
  /** Associated competitor ID */
  competitorId: string;
  /** Entry type */
  type: CompetitiveEntryType;
  /** Entry title */
  title: string;
  /** Detailed description */
  description: string;
  /** Source URL for the information */
  sourceUrl?: string;
  /** Date of the event (ISO 8601) */
  date: string;
  /** Relevance score (0-100) */
  relevance: number;
  /** Funding amount in USD (meaningful for funding-type entries) */
  amount?: number;
  /** AI-generated strategic insight */
  insight?: string;
  /** Whether this was manually added */
  isManual: boolean;
  /** Creation timestamp */
  createdAt: number;
}

/** Summary of competitive landscape */
export interface CompetitiveSummary {
  /** Total number of tracked competitors */
  totalCompetitors: number;
  /** Number of entries in the recent window */
  recentEntries: number;
  /** Total funding amount tracked across entries */
  totalFundingTracked: number;
  /** AI-extracted trend descriptions */
  trends: string[];
  /** When this summary was generated */
  generatedAt: number;
}

// ============================================================================
// Decision Journal Types
// ============================================================================

/** Category of a strategic decision */
export type DecisionCategory =
  | 'strategic'
  | 'technical'
  | 'financial'
  | 'team'
  | 'partnership'
  | 'product'
  | 'marketing';

/** Status of a decision in its lifecycle */
export type DecisionStatus =
  | 'proposed'
  | 'approved'
  | 'implemented'
  | 'revisited'
  | 'reversed';

/** Outcome assessment of a decision */
export type DecisionOutcome =
  | 'pending'
  | 'successful'
  | 'partially_successful'
  | 'unsuccessful'
  | 'inconclusive';

/** An alternative that was considered but not chosen */
export interface DecisionAlternative {
  /** Alternative title */
  title: string;
  /** Description of the alternative */
  description: string;
  /** Advantages of this alternative */
  pros: string[];
  /** Disadvantages of this alternative */
  cons: string[];
  /** Reason this alternative was not chosen */
  whyNotChosen?: string;
}

/** A strategic decision record */
export interface Decision {
  /** Unique identifier */
  id: string;
  /** Decision title */
  title: string;
  /** Detailed description of the decision */
  description: string;
  /** Decision category */
  category: DecisionCategory;
  /** Current status */
  status: DecisionStatus;
  /** Outcome assessment */
  outcome: DecisionOutcome;
  /** Context — what prompted this decision */
  context: string;
  /** Rationale — why this option was chosen */
  rationale: string;
  /** Alternatives that were considered */
  alternatives: DecisionAlternative[];
  /** Expected impact of the decision */
  expectedImpact: string;
  /** Actual impact observed (filled in after outcome is assessed) */
  actualImpact?: string;
  /** People involved in making this decision */
  decisionMakers: string[];
  /** Related document or resource references */
  relatedDocuments: string[];
  /** Tags for categorization and search */
  tags: string[];
  /** Date the decision was made (ISO 8601) */
  decisionDate: string;
  /** Date scheduled for review (ISO 8601) */
  reviewDate?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** AI-generated strategic analysis */
  aiAnalysis?: string;
}

/** Filter criteria for decisions */
export interface DecisionFilter {
  /** Filter by category */
  category?: DecisionCategory;
  /** Filter by status */
  status?: DecisionStatus;
  /** Filter by outcome */
  outcome?: DecisionOutcome;
  /** Filter by date range */
  dateRange?: { start: string; end: string };
  /** Full-text search query */
  searchQuery?: string;
}

// ============================================================================
// Meeting Notes Pipeline Types
// ============================================================================

/** Type of meeting */
export type MeetingType =
  | 'team'
  | 'funder'
  | 'partner'
  | 'advisor'
  | 'community'
  | 'other';

/** Priority for action items extracted from meetings */
export type ActionItemPriority = 'high' | 'medium' | 'low';

/** Status of an action item */
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed';

/** An action item extracted from meeting notes */
export interface ActionItem {
  /** Unique identifier */
  id: string;
  /** Description of the action */
  description: string;
  /** Person responsible */
  assignee?: string;
  /** Due date (ISO 8601) */
  dueDate?: string;
  /** Priority level */
  priority: ActionItemPriority;
  /** Current status */
  status: ActionItemStatus;
  /** Timestamp when completed */
  completedAt?: number;
}

/** A meeting record */
export interface Meeting {
  /** Unique identifier */
  id: string;
  /** Meeting title */
  title: string;
  /** Meeting type */
  type: MeetingType;
  /** Meeting date (ISO 8601 date string) */
  date: string;
  /** Duration in minutes */
  duration?: number;
  /** List of attendees */
  attendees: string[];
  /** Raw meeting notes text */
  rawNotes: string;
  /** AI-generated summary */
  summary?: string;
  /** Extracted action items */
  actionItems: ActionItem[];
  /** Key decisions made during the meeting */
  decisions: string[];
  /** Whether follow-up is needed */
  followUpNeeded: boolean;
  /** Suggested follow-up date (ISO 8601) */
  followUpDate?: string;
  /** Related project identifier */
  relatedProject?: string;
  /** Tags for categorization */
  tags: string[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Whether AI processing has been completed */
  isProcessed: boolean;
}

/** Result of AI processing of meeting notes */
export interface MeetingProcessingResult {
  /** AI-generated meeting summary */
  summary: string;
  /** Extracted action items (without runtime fields) */
  actionItems: Omit<ActionItem, 'id' | 'status' | 'completedAt'>[];
  /** Key decisions identified */
  decisions: string[];
  /** Whether follow-up is recommended */
  followUpNeeded: boolean;
  /** Suggested follow-up date (ISO 8601) */
  suggestedFollowUpDate?: string;
}

/** Filter criteria for meetings */
export interface MeetingFilter {
  /** Filter by meeting type */
  type?: MeetingType;
  /** Filter by processing status */
  status?: 'all' | 'processed' | 'unprocessed';
  /** Full-text search query */
  searchQuery?: string;
  /** Filter by date range */
  dateRange?: { start: string; end: string };
}

// ============================================================================
// Weekly Synthesis Types
// ============================================================================

/** Status of a weekly synthesis generation */
export type SynthesisStatus = 'generating' | 'completed' | 'failed';

/** Direction of a weekly trend */
export type TrendDirection = 'positive' | 'negative' | 'neutral';

/** A trend identified across the week's data */
export interface WeeklyTrend {
  /** Trend title */
  title: string;
  /** Detailed description */
  description: string;
  /** Category (e.g., "funding", "technical", "competitive") */
  category: string;
  /** Whether the trend is positive, negative, or neutral */
  direction: TrendDirection;
  /** AI confidence in this trend (0-100) */
  confidence: number;
}

/** Grant progress tracked across the week */
export interface WeeklyGrantProgress {
  /** Grant program name */
  program: string;
  /** Status at start of week */
  previousStatus: GrantPipelineStatus;
  /** Status at end of week */
  currentStatus: GrantPipelineStatus;
  /** Milestones achieved this week */
  milestones: string[];
  /** Current blockers */
  blockers: string[];
  /** Progress change delta (-100 to 100) */
  progressDelta: number;
}

/** A strategic recommendation for next week */
export interface WeeklyRecommendation {
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority level */
  priority: BriefingPriority;
  /** Category (e.g., "grants", "technical", "team") */
  category: string;
  /** Estimated effort level */
  effort: 'high' | 'medium' | 'low';
}

/** Aggregate stats for the week */
export interface WeeklySummaryStats {
  /** Number of daily briefings generated */
  briefingsGenerated: number;
  /** Number of meetings held */
  meetingsHeld: number;
  /** Number of decisions made */
  decisionsMade: number;
  /** Number of competitive entries tracked */
  competitiveEntries: number;
  /** Action items completed */
  actionItemsCompleted: number;
  /** Action items created */
  actionItemsCreated: number;
  /** Total funding tracked in competitive entries */
  totalFundingTracked: number;
}

/** A weekly synthesis report */
export interface WeeklySynthesis {
  /** Unique identifier */
  id: string;
  /** Week start date (Monday, YYYY-MM-DD) */
  weekStart: string;
  /** Week end date (Sunday, YYYY-MM-DD) */
  weekEnd: string;
  /** Executive summary paragraph */
  executiveSummary: string;
  /** Longer strategic analysis */
  strategicAnalysis: string;
  /** Aggregate stats for the week */
  stats: WeeklySummaryStats;
  /** Identified trends */
  trends: WeeklyTrend[];
  /** Grant progress tracking */
  grantProgress: WeeklyGrantProgress[];
  /** Recommendations for next week */
  recommendations: WeeklyRecommendation[];
  /** Key highlights from the week */
  highlights: string[];
  /** Risks and concerns identified */
  risks: string[];
  /** Generation status */
  status: SynthesisStatus;
  /** Error message if generation failed */
  errorMessage?: string;
  /** TEE attestation for privacy verification */
  attestation?: NEARAIAttestation;
  /** When the synthesis was generated */
  generatedAt: string;
}
