/**
 * Project domain types for Private Grant Studio.
 * A project is a container for documents, proposals, and team collaboration.
 */

import type { EncryptedPayload } from './document';

/** Project visibility and access control */
export type ProjectVisibility = 'private' | 'team' | 'public';

/** Project lifecycle status */
export type ProjectStatus =
  | 'draft'
  | 'active'
  | 'submitted'
  | 'funded'
  | 'completed'
  | 'archived';

/** Grant program a project is targeting */
export type GrantProgram =
  | 'near-foundation'
  | 'proximity-labs'
  | 'ecosystem-fund'
  | 'community-grants'
  | 'other';

/** Team member role within a project */
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** Team member in a project */
export interface TeamMember {
  /** NEAR account ID */
  accountId: string;
  /** Role in the project */
  role: TeamRole;
  /** When they joined the project */
  joinedAt: string;
  /** Public key for encrypted content sharing */
  publicKey?: string;
}

/** Project metadata stored in NEAR Social */
export interface ProjectMetadata {
  /** Display name of the project */
  name: string;
  /** Brief description (max 2000 chars) */
  description: string;
  /** Target grant program */
  grantProgram: GrantProgram;
  /** Requested funding amount in USD */
  fundingAmount?: number;
  /** Project website or repo */
  website?: string;
  /** Project tags for categorization */
  tags: string[];
  /** Project logo/image URL */
  imageUrl?: string;
}

/** Core project entity */
export interface Project {
  /** Unique project identifier (nanoid) */
  id: string;
  /** Owner's NEAR account ID */
  ownerId: string;
  /** Project metadata */
  metadata: ProjectMetadata;
  /** Current status */
  status: ProjectStatus;
  /** Visibility setting */
  visibility: ProjectVisibility;
  /** Team members with access */
  team: TeamMember[];
  /** Document IDs in this project */
  documentIds: string[];
  /** Active proposal ID if any */
  activeProposalId?: string;
  /** Sub-account ID if project has its own NEAR account */
  subAccountId?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Encrypted project for storage */
export interface EncryptedProject {
  /** Project ID (unencrypted for indexing) */
  id: string;
  /** Owner's NEAR account ID (unencrypted) */
  ownerId: string;
  /** Encrypted project data */
  encrypted: EncryptedPayload;
  /** Version for migration support */
  version: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Project list item for display */
export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  grantProgram: GrantProgram;
  documentCount: number;
  updatedAt: string;
}

/** Project creation input */
export interface CreateProjectInput {
  name: string;
  description: string;
  grantProgram: GrantProgram;
  fundingAmount?: number;
  tags?: string[];
  visibility?: ProjectVisibility;
}

/** Project update input */
export interface UpdateProjectInput {
  id: string;
  metadata?: Partial<ProjectMetadata>;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
}
