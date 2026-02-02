/**
 * Document domain types for Private Grant Studio.
 * Documents are encrypted content stored in NEAR Social.
 */

/** Types of documents supported */
export type DocumentType =
  | 'proposal'
  | 'whitepaper'
  | 'technical-spec'
  | 'milestone-report'
  | 'budget'
  | 'pitch-deck'
  | 'notes';

/** Document lifecycle status */
export type DocumentStatus = 'draft' | 'review' | 'final' | 'archived';

/** Encrypted payload structure using TweetNaCl box */
export interface EncryptedPayload {
  /** Encrypted data as base64 */
  ciphertext: string;
  /** Nonce used for encryption as base64 */
  nonce: string;
  /** Ephemeral public key for decryption as base64 */
  ephemeralPublicKey: string;
  /** Encryption version for migration support */
  version: number;
}

/** Document content structure */
export interface DocumentContent {
  /** Markdown content */
  body: string;
  /** Structured sections for proposals */
  sections?: DocumentSection[];
  /** Attachments metadata */
  attachments?: DocumentAttachment[];
}

/** Named section within a document */
export interface DocumentSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section content (markdown) */
  content: string;
  /** Section order */
  order: number;
}

/** File attachment metadata */
export interface DocumentAttachment {
  /** Attachment identifier */
  id: string;
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Encrypted file reference/hash */
  encryptedRef: string;
  /** Upload timestamp */
  uploadedAt: string;
}

/** Document metadata (partially public for indexing) */
export interface DocumentMetadata {
  /** Document title */
  title: string;
  /** Document type */
  type: DocumentType;
  /** Brief summary (max 500 chars) */
  summary?: string;
  /** Tags for categorization */
  tags: string[];
  /** Word count */
  wordCount: number;
  /** Last edit position for resume */
  lastEditPosition?: number;
}

/** Core document entity */
export interface Document {
  /** Unique document identifier (nanoid) */
  id: string;
  /** Parent project ID */
  projectId: string;
  /** Owner's NEAR account ID */
  ownerId: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Document content */
  content: DocumentContent;
  /** Current status */
  status: DocumentStatus;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Encrypted document for storage */
export interface EncryptedDocument {
  /** Document ID (unencrypted for indexing) */
  id: string;
  /** Project ID (unencrypted for indexing) */
  projectId: string;
  /** Owner's NEAR account ID (unencrypted) */
  ownerId: string;
  /** Encrypted document data */
  encrypted: EncryptedPayload;
  /** Minimal public metadata for listing */
  publicMetadata: {
    type: DocumentType;
    status: DocumentStatus;
    updatedAt: string;
  };
  /** Version for migration support */
  version: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Document list item for display */
export interface DocumentListItem {
  id: string;
  projectId: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  summary?: string;
  wordCount: number;
  updatedAt: string;
}

/** Document creation input */
export interface CreateDocumentInput {
  projectId: string;
  title: string;
  type: DocumentType;
  content?: string;
  tags?: string[];
}

/** Document update input */
export interface UpdateDocumentInput {
  id: string;
  metadata?: Partial<DocumentMetadata>;
  content?: Partial<DocumentContent>;
  status?: DocumentStatus;
}

/** Document version for history tracking */
export interface DocumentVersion {
  /** Version identifier */
  id: string;
  /** Document ID */
  documentId: string;
  /** Version number */
  version: number;
  /** Encrypted content at this version */
  encrypted: EncryptedPayload;
  /** Who made the change */
  authorId: string;
  /** Change summary */
  summary?: string;
  /** Timestamp */
  createdAt: string;
}
