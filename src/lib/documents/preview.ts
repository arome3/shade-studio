/**
 * Document Preview Utilities
 *
 * Generates preview URLs and thumbnails for vault documents.
 * Handles memory management for blob URLs.
 */

import type { VaultDocumentType } from '@/types/vault-document';

/**
 * Preview result with URL and metadata.
 */
export interface DocumentPreview {
  /** Preview URL (blob URL or data URL) */
  url: string;
  /** Whether this is a blob URL that needs cleanup */
  isBlobUrl: boolean;
  /** Preview type for rendering hints */
  previewType: 'image' | 'pdf' | 'unsupported';
  /** Original file for download */
  file?: File;
}

/**
 * Preview cache to track blob URLs for cleanup.
 */
const previewCache = new Map<string, string>();

/**
 * Generate a preview for a decrypted file.
 *
 * @param file - Decrypted file
 * @param type - Document type category
 * @returns Preview object with URL and type info
 */
export function generatePreview(
  file: File,
  type: VaultDocumentType
): DocumentPreview {
  // Images can be directly previewed
  if (type === 'image') {
    const url = URL.createObjectURL(file);
    return {
      url,
      isBlobUrl: true,
      previewType: 'image',
      file,
    };
  }

  // PDFs can be previewed in browser
  if (type === 'pdf') {
    const url = URL.createObjectURL(file);
    return {
      url,
      isBlobUrl: true,
      previewType: 'pdf',
      file,
    };
  }

  // Other types don't have native preview
  // Return a placeholder URL
  return {
    url: '',
    isBlobUrl: false,
    previewType: 'unsupported',
    file,
  };
}

/**
 * Get or create a preview URL for a document.
 * Uses cache to avoid recreating URLs for the same document.
 *
 * @param documentId - Document ID for caching
 * @param file - Decrypted file
 * @returns Blob URL for preview
 */
export function getPreviewUrl(documentId: string, file: File): string {
  // Check cache first
  const cached = previewCache.get(documentId);
  if (cached) {
    return cached;
  }

  // Create new blob URL
  const url = URL.createObjectURL(file);
  previewCache.set(documentId, url);
  return url;
}

/**
 * Revoke a preview URL to free memory.
 *
 * @param url - Blob URL to revoke
 */
export function revokePreviewUrl(url: string): void {
  if (!url) return;

  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore errors (URL might already be revoked)
  }

  // Remove from cache
  for (const [key, cachedUrl] of previewCache.entries()) {
    if (cachedUrl === url) {
      previewCache.delete(key);
      break;
    }
  }
}

/**
 * Revoke preview URL for a specific document.
 *
 * @param documentId - Document ID
 */
export function revokeDocumentPreview(documentId: string): void {
  const url = previewCache.get(documentId);
  if (url) {
    revokePreviewUrl(url);
  }
}

/**
 * Revoke all cached preview URLs.
 * Call this on component unmount or when clearing state.
 */
export function revokeAllPreviews(): void {
  for (const url of previewCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  }
  previewCache.clear();
}

/**
 * Get icon name for document type.
 *
 * @param type - Document type
 * @returns Icon name for use with icon libraries
 */
export function getDocumentIcon(type: VaultDocumentType): string {
  switch (type) {
    case 'pdf':
      return 'file-text';
    case 'image':
      return 'image';
    case 'doc':
      return 'file-type';
    case 'sheet':
      return 'table';
    case 'text':
      return 'file-code';
    default:
      return 'file';
  }
}

/**
 * Get display label for document type.
 *
 * @param type - Document type
 * @returns Human-readable type label
 */
export function getDocumentTypeLabel(type: VaultDocumentType): string {
  switch (type) {
    case 'pdf':
      return 'PDF Document';
    case 'image':
      return 'Image';
    case 'doc':
      return 'Word Document';
    case 'sheet':
      return 'Spreadsheet';
    case 'text':
      return 'Text File';
    default:
      return 'File';
  }
}

/**
 * Check if a document type supports native preview.
 *
 * @param type - Document type
 * @returns true if browser can preview this type
 */
export function supportsPreview(type: VaultDocumentType): boolean {
  return type === 'image' || type === 'pdf';
}

/**
 * Get file extension from filename.
 *
 * @param filename - File name
 * @returns Extension without dot, lowercase
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase();
}

/**
 * Get color class for document type badge.
 *
 * @param type - Document type
 * @returns Tailwind color class
 */
export function getDocumentTypeColor(type: VaultDocumentType): string {
  switch (type) {
    case 'pdf':
      return 'bg-red-500/20 text-red-400';
    case 'image':
      return 'bg-blue-500/20 text-blue-400';
    case 'doc':
      return 'bg-indigo-500/20 text-indigo-400';
    case 'sheet':
      return 'bg-green-500/20 text-green-400';
    case 'text':
      return 'bg-gray-500/20 text-gray-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}
