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
