'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/documents/manager';
import {
  getDocumentTypeLabel,
  revokePreviewUrl,
  type DocumentPreview,
} from '@/lib/documents/preview';
import { cn } from '@/lib/utils/cn';
import type { VaultDocument } from '@/types/vault-document';

export interface DocumentViewerProps {
  /** Document to view */
  document: VaultDocument | null;
  /** Called to get preview for document */
  onPreview: (documentId: string) => Promise<DocumentPreview>;
  /** Called to download document */
  onDownload: (document: VaultDocument) => Promise<File>;
  /** Called when viewer is closed */
  onClose: () => void;
  /** Whether the viewer is open */
  isOpen: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Document viewer modal for previewing files.
 * Supports images and PDFs with native browser rendering.
 */
export function DocumentViewer({
  document,
  onPreview,
  onDownload,
  onClose,
  isOpen,
  className,
}: DocumentViewerProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load preview when document changes
  useEffect(() => {
    if (!document || !isOpen) {
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const previewData = await onPreview(document.id);
        if (!cancelled) {
          setPreview(previewData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [document, isOpen, onPreview]);

  // Cleanup preview URL on unmount or close
  useEffect(() => {
    if (!isOpen && preview?.isBlobUrl && preview.url) {
      revokePreviewUrl(preview.url);
      setPreview(null);
    }
  }, [isOpen, preview]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleDownload = useCallback(async () => {
    if (!document || isDownloading) return;

    setIsDownloading(true);
    try {
      const file = preview?.file ?? (await onDownload(document));

      // Create download link
      const url = URL.createObjectURL(file);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = file.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [document, preview, onDownload, isDownloading]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className
      )}
      onClick={onClose}
    >
      {/* Modal content */}
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            {document && (
              <>
                <span className="text-sm font-medium text-text-primary">
                  {document.metadata.name}
                </span>
                <span className="text-xs text-text-muted">
                  {getDocumentTypeLabel(document.metadata.type)} •{' '}
                  {formatFileSize(document.metadata.size)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              loading={isDownloading}
            >
              Download
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-near-black/50 p-4">
          {isLoading && (
            <div className="flex h-64 flex-col items-center justify-center">
              <svg
                className="mb-4 h-8 w-8 animate-spin text-near-green-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-text-muted">Decrypting document...</p>
            </div>
          )}

          {error && (
            <div className="flex h-64 flex-col items-center justify-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/20">
                <svg
                  className="h-6 w-6 text-error"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mb-2 text-sm text-text-primary">
                Failed to load preview
              </p>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
          )}

          {!isLoading && !error && preview && (
            <>
              {/* Image preview */}
              {preview.previewType === 'image' && preview.url && (
                <div className="flex items-center justify-center">
                  <img
                    src={preview.url}
                    alt={document?.metadata.name || 'Document preview'}
                    className="max-h-[70vh] rounded-lg object-contain"
                  />
                </div>
              )}

              {/* PDF preview */}
              {preview.previewType === 'pdf' && preview.url && (
                <iframe
                  src={preview.url}
                  title={document?.metadata.name || 'PDF preview'}
                  className="h-[70vh] w-full rounded-lg bg-white"
                />
              )}

              {/* Unsupported preview */}
              {preview.previewType === 'unsupported' && document && (
                <div className="flex h-64 flex-col items-center justify-center">
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
                  <p className="mb-2 text-sm text-text-primary">
                    Preview not available for this file type
                  </p>
                  <p className="mb-4 text-xs text-text-muted">
                    {getDocumentTypeLabel(document.metadata.type)}
                  </p>
                  <Button onClick={handleDownload} loading={isDownloading}>
                    Download to view
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
