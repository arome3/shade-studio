'use client';

import { DocumentCard } from './document-card';
import { cn } from '@/lib/utils/cn';
import type { VaultDocument } from '@/types/vault-document';

export interface DocumentListProps {
  /** Documents to display */
  documents: VaultDocument[];
  /** Called when a document is selected for preview */
  onPreview?: (document: VaultDocument) => void;
  /** Called when download is requested */
  onDownload?: (document: VaultDocument) => void;
  /** Called when delete is requested */
  onDelete?: (document: VaultDocument) => void;
  /** Get upload progress for a document */
  getUploadProgress?: (documentId: string) => number;
  /** Currently selected document ID */
  selectedDocumentId?: string | null;
  /** Display mode */
  viewMode?: 'grid' | 'list';
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Document list component displaying multiple document cards.
 * Supports grid and list view modes.
 */
export function DocumentList({
  documents,
  onPreview,
  onDownload,
  onDelete,
  getUploadProgress,
  selectedDocumentId,
  viewMode = 'grid',
  isLoading,
  emptyMessage = 'No documents yet',
  className,
}: DocumentListProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col gap-3',
          className
        )}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <DocumentCardSkeleton key={i} viewMode={viewMode} />
        ))}
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
          <svg
            className="h-8 w-8 text-text-muted"
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
        </div>
        <h3 className="mb-1 text-lg font-medium text-text-primary">
          {emptyMessage}
        </h3>
        <p className="text-sm text-text-secondary">
          Upload files to store them securely with encryption
        </p>
      </div>
    );
  }

  // Document grid/list
  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
          : 'flex flex-col gap-3',
        className
      )}
    >
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
          uploadProgress={getUploadProgress?.(document.id)}
          isSelected={selectedDocumentId === document.id}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton loader for document cards.
 */
function DocumentCardSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-border bg-surface p-4',
        viewMode === 'list' && 'flex items-center gap-4'
      )}
    >
      {/* Icon placeholder */}
      <div className="mb-3 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-surface-hover" />
        <div className="h-5 w-16 rounded-full bg-surface-hover" />
      </div>

      {/* Name placeholder */}
      <div className="mb-2 h-4 w-3/4 rounded bg-surface-hover" />

      {/* Metadata placeholder */}
      <div className="mb-3 flex gap-2">
        <div className="h-3 w-12 rounded bg-surface-hover" />
        <div className="h-3 w-20 rounded bg-surface-hover" />
      </div>

      {/* Button placeholder */}
      <div className="flex gap-2">
        <div className="h-8 w-16 rounded bg-surface-hover" />
        <div className="h-8 w-20 rounded bg-surface-hover" />
      </div>
    </div>
  );
}

/**
 * View mode toggle component.
 */
export function ViewModeToggle({
  viewMode,
  onChange,
  className,
}: {
  viewMode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 rounded-lg bg-surface p-1', className)}>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          'rounded-md p-1.5 transition-colors',
          viewMode === 'grid'
            ? 'bg-surface-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        )}
        title="Grid view"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'rounded-md p-1.5 transition-colors',
          viewMode === 'list'
            ? 'bg-surface-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        )}
        title="List view"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
