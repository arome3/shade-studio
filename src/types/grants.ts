/**
 * Global Grant Registry Domain Types
 *
 * Types for the composable on-chain grant registry on NEAR.
 * Aggregates grant programs, projects, and applications across
 * ecosystems (Gitcoin, PotLock, Optimism RPGF, Questbook, etc.)
 */

import { z } from 'zod';

// ============================================================================
// Union Types
// ============================================================================

/** Blockchain ecosystem */
export type GrantChain =
  | 'near'
  | 'ethereum'
  | 'optimism'
  | 'arbitrum'
  | 'polygon'
  | 'base'
  | 'solana'
  | 'multichain';

/** Grant category */
export type GrantCategory =
  | 'defi'
  | 'infrastructure'
  | 'tooling'
  | 'social'
  | 'gaming'
  | 'nft'
  | 'dao'
  | 'privacy'
  | 'education'
  | 'public-goods'
  | 'other';

/** Grant program lifecycle status */
export type ProgramStatus = 'active' | 'upcoming' | 'closed' | 'paused';

/** Grant application lifecycle status */
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'funded'
  | 'completed';

// ============================================================================
// Core Entities
// ============================================================================

/** A grant program registered in the on-chain registry */
export interface GrantProgram {
  /** Unique program identifier */
  id: string;
  /** Program name */
  name: string;
  /** Description of the grant program */
  description: string;
  /** Sponsoring organization */
  organization: string;
  /** Supported blockchain ecosystems */
  chains: GrantChain[];
  /** Grant categories */
  categories: GrantCategory[];
  /** Total funding pool (string for large numbers) */
  fundingPool: string;
  /** Minimum grant amount */
  minAmount?: string;
  /** Maximum grant amount */
  maxAmount?: string;
  /** Application deadline (ISO 8601) */
  deadline?: string;
  /** Program website URL */
  website: string;
  /** Direct application URL */
  applicationUrl?: string;
  /** Current lifecycle status */
  status: ProgramStatus;
  /** NEAR account that registered the program */
  registeredBy: string;
  /** ISO 8601 registration timestamp */
  registeredAt: string;
  /** Total applications received */
  applicationCount: number;
  /** Total applications funded */
  fundedCount: number;
}

/** A project registered in the grant registry */
export interface GrantProject {
  /** Unique project identifier */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Project website */
  website?: string;
  /** Team members */
  teamMembers: ProjectTeamMember[];
  /** NEAR account that registered the project */
  registeredBy: string;
  /** ISO 8601 registration timestamp */
  registeredAt: string;
  /** Total funding received across all grants */
  totalFunded: string;
  /** Total applications submitted */
  applicationCount: number;
  /** Success rate (0-100) */
  successRate: number;
}

/** A team member on a grant project */
export interface ProjectTeamMember {
  /** NEAR account ID */
  accountId: string;
  /** Display name */
  name: string;
  /** Role on the project */
  role: string;
  /** External profile URL */
  profileUrl?: string;
}

/** A grant application linking a project to a program */
export interface GrantApplication {
  /** Unique application identifier */
  id: string;
  /** Grant program this application is for */
  programId: string;
  /** Project applying for the grant */
  projectId: string;
  /** NEAR account of the applicant */
  applicantAccountId: string;
  /** Application title / proposal name */
  title: string;
  /** Amount requested (string for large numbers) */
  requestedAmount: string;
  /** Current application status */
  status: ApplicationStatus;
  /** ISO 8601 submission timestamp */
  submittedAt?: string;
  /** Amount funded (if approved) */
  fundedAmount?: string;
  /** ISO 8601 completion timestamp */
  completedAt?: string;
}

/** Aggregate ecosystem statistics */
export interface EcosystemStats {
  /** Total registered grant programs */
  totalPrograms: number;
  /** Total registered projects */
  totalProjects: number;
  /** Total funding distributed (string for large numbers) */
  totalFunded: string;
  /** Total applications submitted */
  totalApplications: number;
  /** Currently active programs */
  activePrograms: number;
  /** Top categories by program count */
  topCategories: Array<{ category: GrantCategory; count: number }>;
  /** Top chains by program count */
  topChains: Array<{ chain: GrantChain; count: number }>;
}

/** Search/filter parameters for program discovery */
export interface ProgramSearchFilters {
  /** Free-text search */
  searchText?: string;
  /** Filter by category */
  category?: GrantCategory;
  /** Filter by chain */
  chain?: GrantChain;
  /** Only show active programs */
  activeOnly?: boolean;
  /** Minimum funding pool */
  minFunding?: string;
  /** Maximum funding pool */
  maxFunding?: string;
}

// ============================================================================
// Input DTOs
// ============================================================================

/** Input for registering a new grant program */
export interface RegisterProgramInput {
  name: string;
  description: string;
  organization: string;
  chains: GrantChain[];
  categories: GrantCategory[];
  fundingPool: string;
  minAmount?: string;
  maxAmount?: string;
  deadline?: string;
  website: string;
  applicationUrl?: string;
  status: ProgramStatus;
}

/** Input for registering a new project */
export interface RegisterProjectInput {
  name: string;
  description: string;
  website?: string;
  teamMembers: ProjectTeamMember[];
}

/** Input for recording a grant application */
export interface RecordApplicationInput {
  programId: string;
  projectId: string;
  title: string;
  requestedAmount: string;
}

// ============================================================================
// Display Helpers
// ============================================================================

/** Human-readable program status labels with Badge variants */
export const PROGRAM_STATUS_DISPLAY: Record<
  ProgramStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default' }
> = {
  active: { label: 'Active', variant: 'success' },
  upcoming: { label: 'Upcoming', variant: 'default' },
  closed: { label: 'Closed', variant: 'error' },
  paused: { label: 'Paused', variant: 'warning' },
};

/** Human-readable application status labels with Badge variants */
export const APPLICATION_STATUS_DISPLAY: Record<
  ApplicationStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default' | 'outline' | 'secondary' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'default' },
  'under-review': { label: 'Under Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  funded: { label: 'Funded', variant: 'success' },
  completed: { label: 'Completed', variant: 'outline' },
};

/** Human-readable category labels */
export const CATEGORY_LABELS: Record<GrantCategory, string> = {
  defi: 'DeFi',
  infrastructure: 'Infrastructure',
  tooling: 'Tooling',
  social: 'Social',
  gaming: 'Gaming',
  nft: 'NFT',
  dao: 'DAO',
  privacy: 'Privacy',
  education: 'Education',
  'public-goods': 'Public Goods',
  other: 'Other',
};

/** Human-readable chain labels */
export const CHAIN_LABELS: Record<GrantChain, string> = {
  near: 'NEAR',
  ethereum: 'Ethereum',
  optimism: 'Optimism',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  base: 'Base',
  solana: 'Solana',
  multichain: 'Multichain',
};

// ============================================================================
// Zod Schemas
// ============================================================================

/** All valid chain strings */
export const GRANT_CHAINS = [
  'near',
  'ethereum',
  'optimism',
  'arbitrum',
  'polygon',
  'base',
  'solana',
  'multichain',
] as const;

/** All valid category strings */
export const GRANT_CATEGORIES = [
  'defi',
  'infrastructure',
  'tooling',
  'social',
  'gaming',
  'nft',
  'dao',
  'privacy',
  'education',
  'public-goods',
  'other',
] as const;

/** All valid program status strings */
export const PROGRAM_STATUSES = ['active', 'upcoming', 'closed', 'paused'] as const;

/** Validate program search filters */
export const ProgramSearchFiltersSchema = z.object({
  searchText: z.string().optional(),
  category: z.enum(GRANT_CATEGORIES).optional(),
  chain: z.enum(GRANT_CHAINS).optional(),
  activeOnly: z.boolean().optional(),
  minFunding: z.string().regex(/^\d*$/, 'Must be numeric').optional(),
  maxFunding: z.string().regex(/^\d*$/, 'Must be numeric').optional(),
});

/** Validate register program input */
export const RegisterProgramSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must be at most 2000 characters'),
  organization: z.string().min(2, 'Organization must be at least 2 characters').max(100, 'Organization must be at most 100 characters'),
  chains: z.array(z.enum(GRANT_CHAINS)).min(1, 'Select at least one chain'),
  categories: z.array(z.enum(GRANT_CATEGORIES)).min(1, 'Select at least one category'),
  fundingPool: z.string().min(1, 'Funding pool is required'),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  deadline: z.string().optional(),
  website: z.string().url('Must be a valid URL'),
  applicationUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  status: z.enum(PROGRAM_STATUSES),
});

/** Validate record application input */
export const RecordApplicationSchema = z.object({
  programId: z.string().min(1, 'Program is required'),
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
  requestedAmount: z.string().min(1, 'Requested amount is required'),
});

/** Validate register project input */
export const RegisterProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must be at most 2000 characters'),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  teamMembers: z
    .array(
      z.object({
        accountId: z.string().min(2, 'Account ID is required').max(64),
        name: z.string().min(1, 'Name is required').max(100),
        role: z.string().min(1, 'Role is required').max(100),
        profileUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
      })
    )
    .min(1, 'At least one team member is required'),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a funding amount for display.
 * Handles large number strings and adds appropriate suffixes.
 */
export function formatFunding(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0';

  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}K`;
  }
  return `$${num.toLocaleString()}`;
}
