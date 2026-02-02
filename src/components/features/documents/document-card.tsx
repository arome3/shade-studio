'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  formatFileSize,
} from '@/lib/documents/manager';
import {
  getDocumentTypeLabel,
  getDocumentTypeColor,
  supportsPreview,
} from '@/lib/documents/preview';
import { cn } from '@/lib/utils/cn';
import type { VaultDocument } from '@/types/vault-document';

export interface DocumentCardProps {
  /** Document to display */
  document: VaultDocument;
  /** Called when card is clicked for preview */
  onPreview?: (document: VaultDocument) => void;
  /** Called when download is requested */
  onDownload?: (document: VaultDocument) => void;
  /** Called when delete is requested */
  onDelete?: (document: VaultDocument) => void;
  /** Upload progress if document is uploading (0-100) */
  uploadProgress?: number;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card component for displaying a single vault document.
 * Shows file info, type badge, and action buttons.
 */
export function DocumentCard({
  document,
  onPreview,
  onDownload,
  onDelete,
  uploadProgress,
  isSelected,
  className,
}: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { metadata, status } = document;
  const isUploading = status === 'uploading';
  const hasError = status === 'error';
  const canPreview = supportsPreview(metadata.type);

  const handlePreview = () => {
    if (!isUploading && !hasError && onPreview) {
      onPreview(document);
    }
  };

  const handleDownload = async () => {
    if (isDownloading || !onDownload) return;

    setIsDownloading(true);
    try {
      await onDownload(document);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || !onDelete) return;

    // Confirm deletion
    if (!window.confirm(`Delete "${metadata.name}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(document);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:border-border-hover',
        isSelected && 'border-near-green-500 ring-1 ring-near-green-500/30',
        hasError && 'border-error/50',
        className
      )}
      onClick={handlePreview}
    >
      <CardContent className="p-4">
        {/* Upload progress bar */}
        {isUploading && uploadProgress !== undefined && (
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-xl bg-surface-hover">
            <div
              className="h-full bg-near-green-500 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Document icon and type badge */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* File icon based on type */}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
              <DocumentIcon type={metadata.type} />
            </div>

            {/* Type badge */}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                getDocumentTypeColor(metadata.type)
              )}
            >
              {getDocumentTypeLabel(metadata.type)}
            </span>
          </div>

          {/* Status indicator */}
          {isUploading && (
            <span className="text-xs text-text-muted">Uploading...</span>
          )}
          {hasError && (
            <span className="text-xs text-error">Error</span>
          )}
        </div>

        {/* File name */}
        <h3 className="mb-1 truncate text-sm font-medium text-text-primary">
          {metadata.name}
        </h3>

        {/* File metadata */}
        <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
          <span>{formatFileSize(metadata.size)}</span>
          <span>•</span>
          <span>{formatDate(metadata.createdAt)}</span>
        </div>

        {/* Tags */}
        {metadata.tags && metadata.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {metadata.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-surface-hover px-1.5 py-0.5 text-xs text-text-secondary"
              >
                {tag}
              </span>
            ))}
            {metadata.tags.length > 3 && (
              <span className="text-xs text-text-muted">
                +{metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {hasError && document.error && (
          <p className="mb-3 text-xs text-error">{document.error}</p>
        )}

        {/* Action buttons (visible on hover) */}
        <div
          className={cn(
            'flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100',
            isUploading && 'pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {canPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              disabled={isUploading || hasError}
            >
              Preview
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            loading={isDownloading}
            disabled={isUploading || hasError}
          >
            Download
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            loading={isDeleting}
            disabled={isUploading}
            className="text-error hover:text-error"
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Document icon based on type.
 */
function DocumentIcon({ type }: { type: string }) {
  switch (type) {
    case 'pdf':
      return (
        <svg
          className="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6m-6 4h4"
          />
        </svg>
      );
    case 'image':
      return (
        <svg
          className="h-5 w-5 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case 'doc':
      return (
        <svg
          className="h-5 w-5 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'sheet':
      return (
        <svg
          className="h-5 w-5 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    case 'text':
      return (
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="h-5 w-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
  }
}
