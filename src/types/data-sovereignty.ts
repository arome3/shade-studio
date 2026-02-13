/**
 * Data Sovereignty Dashboard Types
 *
 * Defines the unified data model for the sovereignty dashboard, which
 * aggregates VaultDocuments (encrypted files) and UICredentials (ZK proofs)
 * into a single DataItem shape for inventory display and bulk operations.
 */

import type { LucideIcon } from 'lucide-react';
import type { VaultDocument } from './vault-document';
import type { UICredential } from './credentials';

// ============================================================================
// Core Enums
// ============================================================================

/** Where data is physically stored */
export type StorageLocation = 'local' | 'ipfs' | 'near-social' | 'near-contract';

/** Logical data categories matching actual data sources */
export type DataCategory = 'documents' | 'credentials' | 'proofs' | 'settings';

/** Activity log action types */
export type ActivityAction =
  | 'upload'
  | 'download'
  | 'delete'
  | 'export'
  | 'encrypt'
  | 'decrypt'
  | 'proof-generate'
  | 'proof-verify'
  | 'share'
  | 'setting-change';

/** Export file format */
export type ExportFormat = 'json' | 'zip';

// ============================================================================
// Data Item — Unified shape for documents + credentials
// ============================================================================

export interface DataItem {
  /** Unique identifier (from source document/credential) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Size in bytes (estimated for credentials) */
  sizeBytes: number;
  /** Whether the data is encrypted */
  encrypted: boolean;
  /** Creation timestamp (Unix ms) */
  createdAt: number;
  /** Storage location */
  location: StorageLocation;
  /** Optional secondary storage location (e.g. NEAR Social for metadata) */
  secondaryLocation?: StorageLocation;
  /** Data category */
  category: DataCategory;
  /** Optional reference to source VaultDocument */
  sourceDocument?: VaultDocument;
  /** Optional reference to source UICredential */
  sourceCredential?: UICredential;
}

// ============================================================================
// Storage Analysis
// ============================================================================

/** Display config for a storage location */
export interface StorageLocationConfig {
  label: string;
  icon: LucideIcon;
  hex: string;
  tailwindColor: string;
}

/** Per-location storage statistics */
export interface StorageBreakdown {
  location: StorageLocation;
  totalBytes: number;
  itemCount: number;
  percentage: number;
  config: StorageLocationConfig;
}

/** Overall storage summary */
export interface StorageSummary {
  totalBytes: number;
  totalItems: number;
  breakdown: StorageBreakdown[];
}

// ============================================================================
// Encryption Analysis
// ============================================================================

/** Per-location encryption stats */
export interface LocationEncryption {
  location: StorageLocation;
  encrypted: number;
  total: number;
  percentage: number;
}

/** Overall encryption summary */
export interface EncryptionSummary {
  encryptedCount: number;
  totalCount: number;
  overallPercentage: number;
  encryptionReady: boolean;
  byLocation: LocationEncryption[];
}

// ============================================================================
// Activity Log
// ============================================================================

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  description: string;
  category?: DataCategory;
  itemId?: string;
  timestamp: number;
}

// ============================================================================
// Privacy Settings
// ============================================================================

export interface PrivacySettings {
  autoEncrypt: boolean;
  localMetadataOnly: boolean;
  autoExpireShares: boolean;
  shareExpiryDays: number;
  activityLogEnabled: boolean;
  analyticsEnabled: boolean;
}

// ============================================================================
// Export
// ============================================================================

export interface ExportOptions {
  format: ExportFormat;
  categories: DataCategory[];
}

// ============================================================================
// Delete Result
// ============================================================================

export interface DeleteResult {
  successCount: number;
  failedItems: { id: string; name: string; error: string }[];
}

// ============================================================================
// Dashboard Stats
// ============================================================================

export interface DataSovereigntyStats {
  totalItems: number;
  totalBytes: number;
  encryptionPercentage: number;
  recentActivityCount: number;
}
