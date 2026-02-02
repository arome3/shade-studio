/**
 * Daily briefing and intelligence types for Private Grant Studio.
 * Handles personalized daily updates and grant opportunity tracking.
 */

/** Priority level for briefing items */
export type BriefingPriority = 'high' | 'medium' | 'low';

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
