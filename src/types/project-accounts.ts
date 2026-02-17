/**
 * Project Sub-Account types for NEAR hierarchical account management.
 *
 * Maps permission levels to NEAR access key semantics:
 * - owner:       FullAccess key
 * - editor:      FunctionCall key → social contract [set, grant_write_permission] 1 NEAR
 * - contributor: FunctionCall key → social contract [set] 0.5 NEAR
 * - viewer:      No key (read-only via RPC)
 */

import { z } from 'zod';
import { config } from '@/lib/config';

// ============================================================================
// Permission Model
// ============================================================================

/** Permission levels mapping 1:1 to NEAR access key semantics */
export type PermissionLevel = 'owner' | 'editor' | 'contributor' | 'viewer';

/** Access key permission definition for FunctionCall keys */
export interface AccessKeyPermission {
  type: 'FullAccess' | 'FunctionCall';
  receiverId?: string;
  methodNames?: string[];
  allowance?: string; // yoctoNEAR
}

/** Configuration for each permission level */
export interface PermissionConfig {
  label: string;
  description: string;
  requiresKey: boolean;
  accessKeyPermission: AccessKeyPermission | null;
}

/** Permission level → config mapping */
export const PERMISSION_CONFIGS: Record<PermissionLevel, PermissionConfig> = {
  owner: {
    label: 'Owner',
    description: 'Full access to the sub-account including key management',
    requiresKey: true,
    accessKeyPermission: {
      type: 'FullAccess',
    },
  },
  editor: {
    label: 'Editor',
    description: 'Can write data and grant permissions on social contract',
    requiresKey: true,
    accessKeyPermission: {
      type: 'FunctionCall',
      receiverId: config.near.socialContractId,
      methodNames: ['set', 'grant_write_permission'],
      allowance: '1000000000000000000000000', // 1 NEAR
    },
  },
  contributor: {
    label: 'Contributor',
    description: 'Can write data to the social contract',
    requiresKey: true,
    accessKeyPermission: {
      type: 'FunctionCall',
      receiverId: config.near.socialContractId,
      methodNames: ['set'],
      allowance: '500000000000000000000000', // 0.5 NEAR
    },
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access via RPC, no key required',
    requiresKey: false,
    accessKeyPermission: null,
  },
};

// ============================================================================
// Sub-Account Entities
// ============================================================================

/** A project's NEAR sub-account */
export interface ProjectSubAccount {
  /** Full sub-account ID (e.g., "my-project.alice.testnet") */
  accountId: string;
  /** Parent account that created the sub-account */
  parentAccountId: string;
  /** Whether the sub-account has been created on-chain */
  isCreated: boolean;
  /** Initial deposit in NEAR */
  initialDeposit: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/** A team member with access to a project sub-account */
export interface ProjectTeamMember {
  /** Team member's NEAR account ID */
  accountId: string;
  /** Permission level granted */
  permission: PermissionLevel;
  /** Public key associated with their access key (if any) */
  publicKey?: string;
  /** ISO 8601 timestamp when the member was added */
  addedAt: string;
  /** Status of the access key on-chain */
  keyStatus: 'pending' | 'active' | 'revoked';
}

/** Encrypted access key stored in localStorage */
export interface StoredAccessKey {
  /** Sub-account this key belongs to */
  subAccountId: string;
  /** Public key (ed25519:...) */
  publicKey: string;
  /** Encrypted private key (encrypted by useEncryption) */
  encryptedPrivateKey: string;
  /** Encryption nonce */
  nonce: string;
  /** Permission level this key was granted */
  permission: PermissionLevel;
}

// ============================================================================
// RPC Response Types
// ============================================================================

/** Single access key info from RPC */
export interface AccessKeyInfo {
  public_key: string;
  access_key: {
    nonce: number;
    permission:
      | 'FullAccess'
      | {
          FunctionCall: {
            allowance: string;
            receiver_id: string;
            method_names: string[];
          };
        };
  };
}

/** Response from view_access_key_list RPC call */
export interface AccessKeyList {
  keys: AccessKeyInfo[];
}

/** Account info from view_account RPC call */
export interface AccountInfo {
  amount: string;
  locked: string;
  code_hash: string;
  storage_usage: number;
  storage_paid_at: number;
  block_height: number;
  block_hash: string;
}

// ============================================================================
// Action Types (Wallet Selector compatible)
// ============================================================================

/**
 * Wallet action types matching NEAR Wallet Selector format.
 *
 * Each action includes both the v8 format (type + params) and optional
 * NAJ-format properties (createAccount, transfer, addKey, etc.) so that
 * both wallet-selector v8 and v10 (Meteor) can process them.
 */
export type WalletAction =
  | { type: 'CreateAccount'; createAccount?: Record<string, never> }
  | { type: 'Transfer'; params: { deposit: string }; transfer?: { deposit: string } }
  | {
      type: 'AddKey';
      params: {
        publicKey: string;
        accessKey:
          | { permission: 'FullAccess' }
          | {
              permission: {
                receiverId: string;
                methodNames: string[];
                allowance: string;
              };
            };
      };
      addKey?: {
        publicKey: string;
        accessKey: {
          nonce: number;
          permission:
            | 'FullAccess'
            | { fullAccess: Record<string, never> }
            | {
                functionCall: {
                  receiverId: string;
                  methodNames: string[];
                  allowance: string;
                };
              };
        };
      };
    }
  | { type: 'DeleteKey'; params: { publicKey: string }; deleteKey?: { publicKey: string } };

// ============================================================================
// Input / Output Types
// ============================================================================

/** Input for creating a sub-account */
export interface CreateSubAccountInput {
  /** Name portion of the sub-account (without parent suffix) */
  subAccountName: string;
  /** Project ID to associate with */
  projectId: string;
  /** Initial deposit in NEAR (default: "0.1") */
  initialDeposit?: string;
}

/** Input for adding a team member */
export interface AddTeamMemberInput {
  /** Full sub-account ID to grant access on */
  subAccountId: string;
  /** Member's NEAR account ID */
  memberAccountId: string;
  /** Permission level to grant */
  permission: PermissionLevel;
}

/** Result of adding a team member — private key shown once */
export interface AddTeamMemberResult {
  /** The created team member record */
  member: ProjectTeamMember;
  /** Public key of the generated key pair */
  publicKey: string;
  /** Private key — shown to the owner ONCE for sharing */
  privateKey: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Zod schema for sub-account name validation.
 * NEAR sub-account names: 2-32 chars, lowercase alphanumeric + hyphens,
 * cannot start/end with hyphens.
 */
export const SubAccountNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(32, 'Name must be at most 32 characters')
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    'Only lowercase letters, numbers, and hyphens (cannot start/end with hyphen)'
  );
