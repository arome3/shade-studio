/**
 * Vault Document types for file-based encrypted storage.
 *
 * VaultDocuments are binary files (PDFs, images, spreadsheets, etc.)
 * that are encrypted client-side and stored on IPFS with metadata
 * persisted to NEAR Social.
 *
 * This is distinct from the text-based Document type which stores
 * markdown content directly in NEAR Social.
 */

/**
 * Document type categories for vault files.
 * Used for icon display and file handling.
 */
export type VaultDocumentType =
  | 'pdf'
  | 'image'
  | 'doc'
  | 'sheet'
  | 'text'
  | 'other';

/**
 * Document lifecycle status during upload/storage.
 */
export type VaultDocumentStatus =
  | 'uploading'
  | 'encrypted'
  | 'stored'
  | 'error';

/**
 * Metadata for a vault document.
 * Stored in NEAR Social alongside the encrypted content on IPFS.
 */
export interface VaultDocumentMetadata {
  /** Original filename */
  name: string;
  /** Document type category */
  type: VaultDocumentType;
  /** Original MIME type for file reconstruction */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** IPFS content identifier for encrypted blob */
  ipfsCid: string;
  /** Encryption nonce (base64) for decryption */
  encryptionNonce: string;
  /** Creation timestamp (Unix ms) */
  createdAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;
  /** Optional tags for organization */
  tags?: string[];
}

/**
 * Complete vault document entity.
 */
export interface VaultDocument {
  /** Unique document identifier (nanoid) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Document metadata */
  metadata: VaultDocumentMetadata;
  /** Current status */
  status: VaultDocumentStatus;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Input for creating a new vault document.
 */
export interface CreateVaultDocumentInput {
  /** File to upload and encrypt */
  file: File;
  /** Parent project ID */
  projectId: string;
  /** Optional tags for organization */
  tags?: string[];
}

/**
 * List item for displaying vault documents.
 */
export interface VaultDocumentListItem {
  id: string;
  projectId: string;
  name: string;
  type: VaultDocumentType;
  mimeType: string;
  size: number;
  status: VaultDocumentStatus;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

/**
 * Supported MIME types for vault documents.
 */
export const SUPPORTED_VAULT_MIME_TYPES = {
  // PDF
  pdf: ['application/pdf'],
  // Images
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  // Documents (Word)
  doc: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  // Spreadsheets (Excel)
  sheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  // Text
  text: ['text/plain', 'text/markdown'],
} as const;

/**
 * Get all supported MIME types as a flat array.
 */
export function getAllSupportedMimeTypes(): string[] {
  return Object.values(SUPPORTED_VAULT_MIME_TYPES).flat();
}

/**
 * Check if a MIME type is supported.
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return getAllSupportedMimeTypes().includes(mimeType);
}
