/**
 * Proposal and grant types for Private Grant Studio.
 * Proposals are structured funding requests with milestones and budgets.
 */

import type { EncryptedPayload } from './document';

/** Proposal lifecycle status */
export type ProposalStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'funded'
  | 'completed';

/** Milestone status */
export type MilestoneStatus =
  | 'pending'
  | 'in-progress'
  | 'submitted'
  | 'approved'
  | 'rejected';

/** Budget category */
export type BudgetCategory =
  | 'development'
  | 'design'
  | 'marketing'
  | 'operations'
  | 'infrastructure'
  | 'legal'
  | 'other';

/** Budget line item */
export interface BudgetItem {
  /** Item identifier */
  id: string;
  /** Category */
  category: BudgetCategory;
  /** Description of the expense */
  description: string;
  /** Amount in USD */
  amount: number;
  /** Associated milestone ID if any */
  milestoneId?: string;
}

/** Project milestone */
export interface Milestone {
  /** Milestone identifier */
  id: string;
  /** Milestone title */
  title: string;
  /** Detailed description */
  description: string;
  /** Deliverables list */
  deliverables: string[];
  /** Target completion date (ISO 8601) */
  targetDate: string;
  /** Actual completion date if completed */
  completedDate?: string;
  /** Funding amount for this milestone */
  fundingAmount: number;
  /** Current status */
  status: MilestoneStatus;
  /** ZK proof of completion if submitted */
  completionProof?: string;
  /** Order in the milestone sequence */
  order: number;
}

/** Team member for proposal */
export interface ProposalTeamMember {
  /** NEAR account ID */
  accountId: string;
  /** Display name */
  name: string;
  /** Role in the project */
  role: string;
  /** Relevant experience/background */
  background: string;
  /** LinkedIn/GitHub/portfolio URL */
  profileUrl?: string;
}

/** Proposal content sections */
export interface ProposalContent {
  /** Executive summary (max 500 words) */
  summary: string;
  /** Problem statement */
  problem: string;
  /** Proposed solution */
  solution: string;
  /** Technical approach */
  technicalApproach: string;
  /** Market analysis */
  marketAnalysis?: string;
  /** Competitive landscape */
  competition?: string;
  /** Go-to-market strategy */
  goToMarket?: string;
  /** Risk assessment */
  risks?: string;
  /** Additional notes */
  additionalNotes?: string;
}

/** Core proposal entity */
export interface Proposal {
  /** Unique proposal identifier (nanoid) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Owner's NEAR account ID */
  ownerId: string;
  /** Proposal title */
  title: string;
  /** Target grant program */
  grantProgram: string;
  /** Proposal content */
  content: ProposalContent;
  /** Team members */
  team: ProposalTeamMember[];
  /** Project milestones */
  milestones: Milestone[];
  /** Budget breakdown */
  budget: BudgetItem[];
  /** Total requested funding in USD */
  totalFunding: number;
  /** Project duration in months */
  durationMonths: number;
  /** Current status */
  status: ProposalStatus;
  /** Submission date if submitted */
  submittedAt?: string;
  /** External proposal ID from grant program */
  externalId?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Encrypted proposal for storage */
export interface EncryptedProposal {
  /** Proposal ID (unencrypted for indexing) */
  id: string;
  /** Project ID (unencrypted for indexing) */
  projectId: string;
  /** Owner's NEAR account ID (unencrypted) */
  ownerId: string;
  /** Encrypted proposal data */
  encrypted: EncryptedPayload;
  /** Minimal public metadata */
  publicMetadata: {
    grantProgram: string;
    status: ProposalStatus;
    submittedAt?: string;
    updatedAt: string;
  };
  /** Version for migration support */
  version: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Proposal list item for display */
export interface ProposalListItem {
  id: string;
  projectId: string;
  title: string;
  grantProgram: string;
  totalFunding: number;
  status: ProposalStatus;
  milestoneCount: number;
  completedMilestones: number;
  updatedAt: string;
}

/** Proposal creation input */
export interface CreateProposalInput {
  projectId: string;
  title: string;
  grantProgram: string;
  summary: string;
}

/** Proposal update input */
export interface UpdateProposalInput {
  id: string;
  title?: string;
  content?: Partial<ProposalContent>;
  team?: ProposalTeamMember[];
  milestones?: Milestone[];
  budget?: BudgetItem[];
  status?: ProposalStatus;
}

/** Grant program information */
export interface GrantProgramInfo {
  /** Program identifier */
  id: string;
  /** Program name */
  name: string;
  /** Program description */
  description: string;
  /** Organization running the program */
  organization: string;
  /** Maximum grant amount */
  maxAmount?: number;
  /** Minimum grant amount */
  minAmount?: number;
  /** Application deadline if any */
  deadline?: string;
  /** Program website */
  website: string;
  /** Required sections in proposal */
  requiredSections: string[];
  /** Whether program is currently active */
  isActive: boolean;
}
