/**
 * Document Manager - Core business logic for vault document operations.
 *
 * Handles the complete lifecycle of encrypted file storage:
 * 1. Validate file (size, type)
 * 2. Encrypt file contents with TweetNaCl secretbox
 * 3. Upload encrypted blob to IPFS
 * 4. Persist metadata to NEAR Social
 *
 * Download reverses the process:
 * 1. Fetch encrypted blob from IPFS
 * 2. Reconstruct encryption payload
 * 3. Decrypt to original file
 */

import { nanoid } from 'nanoid';
import { MAX_FILE_SIZE } from '@/lib/constants';
import { encryptFile, decryptFile } from '@/lib/crypto/encryption';
import { decodeBase64 } from '@/lib/crypto/utils';
import { getIPFSClient } from '@/lib/storage/ipfs';
import {
  buildSaveDocumentTransaction,
  buildDeleteDocumentTransaction,
  type SocialAccount,
  type SocialTransaction,
  type StoredDocumentMetadata,
} from '@/lib/near/social';
import {
  type VaultDocument,
  type VaultDocumentMetadata,
  type VaultDocumentType,
  type CreateVaultDocumentInput,
  SUPPORTED_VAULT_MIME_TYPES,
  getAllSupportedMimeTypes,
} from '@/types/vault-document';
import type { EncryptedPayload } from '@/types/document';

/**
 * Error codes for document operations.
 */
export const DocumentErrorCode = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
} as const;

export type DocumentErrorCodeType =
  (typeof DocumentErrorCode)[keyof typeof DocumentErrorCode];

/**
 * Error class for document operations.
 */
export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentErrorCodeType,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

/**
 * Result from document upload operation.
 */
export interface UploadDocumentResult {
  document: VaultDocument;
  transaction: SocialTransaction;
}

/**
 * Validate a file for upload.
 *
 * @param file - File to validate
 * @throws DocumentError if validation fails
 */
export function validateFile(file: File): void {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new DocumentError(
      DocumentErrorCode.FILE_TOO_LARGE,
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(MAX_FILE_SIZE)})`
    );
  }

  // Check file type
  const supportedTypes = getAllSupportedMimeTypes();
  if (!supportedTypes.includes(file.type)) {
    throw new DocumentError(
      DocumentErrorCode.UNSUPPORTED_TYPE,
      `File type "${file.type}" is not supported. Supported types: ${supportedTypes.join(', ')}`
    );
  }
}

/**
 * Get document type category from MIME type.
 *
 * @param mimeType - MIME type string
 * @returns VaultDocumentType category
 */
export function getDocumentTypeFromMime(mimeType: string): VaultDocumentType {
  for (const [type, mimes] of Object.entries(SUPPORTED_VAULT_MIME_TYPES)) {
    if ((mimes as readonly string[]).includes(mimeType)) {
      return type as VaultDocumentType;
    }
  }
  return 'other';
}

/**
 * Format file size for display.
 *
 * @param bytes - Size in bytes
 * @returns Human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Upload and encrypt a document.
 *
 * Flow:
 * 1. Validate file
 * 2. Encrypt file contents
 * 3. Convert ciphertext to binary blob
 * 4. Upload to IPFS
 * 5. Build NEAR Social transaction
 *
 * @param input - Upload input with file, projectId, and optional tags
 * @param secretKey - 32-byte encryption key
 * @param account - NEAR Social account for transaction
 * @returns Document object and unsigned transaction
 */
export async function uploadDocument(
  input: CreateVaultDocumentInput,
  secretKey: Uint8Array,
  account: SocialAccount
): Promise<UploadDocumentResult> {
  const { file, projectId, tags } = input;

  // Step 1: Validate
  validateFile(file);

  // Step 2: Encrypt
  let encryptedPayload: EncryptedPayload;
  try {
    const { payload } = await encryptFile(file, secretKey);
    encryptedPayload = payload;
  } catch (error) {
    throw new DocumentError(
      DocumentErrorCode.ENCRYPTION_FAILED,
      'Failed to encrypt file',
      error
    );
  }

  // Step 3: Convert base64 ciphertext to binary for IPFS
  // This is more efficient than storing base64 on IPFS
  const ciphertextBytes = decodeBase64(encryptedPayload.ciphertext);
  const encryptedBlob = new Blob([new Uint8Array(ciphertextBytes)], {
    type: 'application/octet-stream',
  });

  // Step 4: Upload to IPFS
  let ipfsCid: string;
  try {
    const ipfsClient = getIPFSClient();
    const result = await ipfsClient.upload(encryptedBlob, `${file.name}.encrypted`);
    ipfsCid = result.cid;
  } catch (error) {
    throw new DocumentError(
      DocumentErrorCode.UPLOAD_FAILED,
      'Failed to upload encrypted file to IPFS',
      error
    );
  }

  // Step 5: Build metadata and document
  const documentId = nanoid();
  const now = Date.now();
  const documentType = getDocumentTypeFromMime(file.type);

  const metadata: VaultDocumentMetadata = {
    name: file.name,
    type: documentType,
    mimeType: file.type,
    size: file.size,
    ipfsCid,
    encryptionNonce: encryptedPayload.nonce,
    createdAt: now,
    updatedAt: now,
    tags,
  };

  const document: VaultDocument = {
    id: documentId,
    projectId,
    metadata,
    status: 'stored',
  };

  // Step 6: Build NEAR Social transaction
  const storedMetadata: StoredDocumentMetadata = {
    name: metadata.name,
    type: metadata.type,
    mimeType: metadata.mimeType,
    ipfsCid: metadata.ipfsCid,
    encryptionNonce: metadata.encryptionNonce,
    size: metadata.size,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    tags: metadata.tags,
  };

  let transaction: SocialTransaction;
  try {
    transaction = await buildSaveDocumentTransaction(
      account,
      projectId,
      documentId,
      storedMetadata
    );
  } catch (error) {
    // Cleanup: try to delete from IPFS if transaction build fails
    try {
      const ipfsClient = getIPFSClient();
      await ipfsClient.delete(ipfsCid);
    } catch {
      // Ignore cleanup errors
    }

    throw new DocumentError(
      DocumentErrorCode.TRANSACTION_FAILED,
      'Failed to build save transaction',
      error
    );
  }

  return { document, transaction };
}

/**
 * Download and decrypt a document.
 *
 * Flow:
 * 1. Fetch encrypted blob from IPFS
 * 2. Reconstruct EncryptedPayload
 * 3. Decrypt to original File
 *
 * @param document - Document to download
 * @param secretKey - 32-byte decryption key
 * @returns Decrypted File object
 */
export async function downloadDocument(
  document: VaultDocument,
  secretKey: Uint8Array
): Promise<File> {
  const { metadata } = document;

  // Step 1: Download from IPFS
  let encryptedData: ArrayBuffer;
  try {
    const ipfsClient = getIPFSClient();
    encryptedData = await ipfsClient.download(metadata.ipfsCid);
  } catch (error) {
    throw new DocumentError(
      DocumentErrorCode.DOWNLOAD_FAILED,
      'Failed to download encrypted file from IPFS',
      error
    );
  }

  // Step 2: Reconstruct EncryptedPayload
  // Convert ArrayBuffer back to base64 for the decryption function
  const ciphertextArray = new Uint8Array(encryptedData);
  const ciphertextBase64 = btoa(
    String.fromCharCode.apply(null, Array.from(ciphertextArray))
  );

  const payload: EncryptedPayload = {
    ciphertext: ciphertextBase64,
    nonce: metadata.encryptionNonce,
    ephemeralPublicKey: '', // Empty for secretbox
    version: 1,
  };

  // Step 3: Decrypt
  try {
    const file = await decryptFile(
      payload,
      {
        name: metadata.name,
        type: metadata.mimeType,
        size: metadata.size,
        lastModified: metadata.updatedAt,
      },
      secretKey
    );

    return file;
  } catch (error) {
    throw new DocumentError(
      DocumentErrorCode.DECRYPTION_FAILED,
      'Failed to decrypt file. Wrong encryption key?',
      error
    );
  }
}

/**
 * Delete a document from IPFS and build deletion transaction.
 *
 * @param document - Document to delete
 * @param account - NEAR Social account for transaction
 * @returns Unsigned deletion transaction
 */
export async function deleteDocument(
  document: VaultDocument,
  account: SocialAccount
): Promise<SocialTransaction> {
  const { id, projectId, metadata } = document;

  // Delete from IPFS first
  try {
    const ipfsClient = getIPFSClient();
    await ipfsClient.delete(metadata.ipfsCid);
  } catch (error) {
    // Log but continue - the content might already be gone
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DocumentManager] Failed to delete from IPFS:', error);
    }
  }

  // Build deletion transaction
  try {
    const transaction = await buildDeleteDocumentTransaction(
      account,
      projectId,
      id
    );
    return transaction;
  } catch (error) {
    throw new DocumentError(
      DocumentErrorCode.DELETE_FAILED,
      'Failed to build delete transaction',
      error
    );
  }
}

/**
 * Convert StoredDocumentMetadata to VaultDocument.
 * Used when loading documents from NEAR Social.
 *
 * @param id - Document ID
 * @param projectId - Project ID
 * @param stored - Stored metadata from NEAR Social
 * @returns VaultDocument object
 */
export function storedToVaultDocument(
  id: string,
  projectId: string,
  stored: StoredDocumentMetadata
): VaultDocument {
  return {
    id,
    projectId,
    metadata: {
      name: stored.name,
      type: stored.type as VaultDocumentType,
      mimeType: stored.mimeType || 'application/octet-stream',
      size: stored.size,
      ipfsCid: stored.ipfsCid,
      encryptionNonce: stored.encryptionNonce,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      tags: stored.tags,
    },
    status: 'stored',
  };
}
