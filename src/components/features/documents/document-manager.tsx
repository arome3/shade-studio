'use client';

import { useState, useCallback, useEffect } from 'react';
import { DocumentUpload } from './document-upload';
import { DocumentList, ViewModeToggle } from './document-list';
import { DocumentViewer } from './document-viewer';
import { EncryptionStatus } from './encryption-status';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useDocuments } from '@/hooks/use-documents';
import { useEncryption } from '@/hooks/use-encryption';
import { cn } from '@/lib/utils/cn';
import type { VaultDocument, CreateVaultDocumentInput } from '@/types/vault-document';

export interface DocumentManagerProps {
  /** Project ID to manage documents for */
  projectId: string;
  /** Title to display */
  title?: string;
  /** Whether to show the upload component */
  showUpload?: boolean;
  /** Maximum files per upload */
  maxFilesPerUpload?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Complete document management interface.
 * Combines upload, list, and viewer components into a cohesive experience.
 */
export function DocumentManager({
  projectId,
  title = 'Documents',
  showUpload = true,
  maxFilesPerUpload = 5,
  className,
}: DocumentManagerProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Document operations
  const {
    documents,
    selectedDocument,
    isLoading,
    error: documentsError,
    fetchDocuments,
    uploadDocument,
    downloadDocument,
    previewDocument,
    deleteDocument,
    selectDocument,
    getUploadProgress,
  } = useDocuments(projectId);

  // Encryption state
  const {
    isReady: isEncryptionReady,
    initialize: initializeEncryption,
    error: encryptionError,
  } = useEncryption();

  // Fetch documents on mount
  useEffect(() => {
    if (projectId) {
      fetchDocuments(projectId);
    }
  }, [projectId, fetchDocuments]);

  // Handle file upload
  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!projectId) return;

      setIsUploading(true);
      try {
        // Upload files sequentially
        for (const file of files) {
          const input: CreateVaultDocumentInput = {
            file,
            projectId,
          };
          await uploadDocument(input);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, uploadDocument]
  );

  // Handle document preview
  const handlePreview = useCallback(
    (document: VaultDocument) => {
      selectDocument(document.id);
      setIsViewerOpen(true);
    },
    [selectDocument]
  );

  // Handle document download
  const handleDownload = useCallback(
    async (document: VaultDocument) => {
      const file = await downloadDocument(document.id);

      // Trigger browser download
      const url = URL.createObjectURL(file);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = file.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [downloadDocument]
  );

  // Handle document deletion
  const handleDelete = useCallback(
    async (document: VaultDocument) => {
      await deleteDocument(document.id);
    },
    [deleteDocument]
  );

  // Handle viewer close
  const handleViewerClose = useCallback(() => {
    setIsViewerOpen(false);
    selectDocument(null);
  }, [selectDocument]);

  // Handle preview request from viewer
  const handleViewerPreview = useCallback(
    async (documentId: string) => {
      return previewDocument(documentId);
    },
    [previewDocument]
  );

  // Handle download from viewer
  const handleViewerDownload = useCallback(
    async (document: VaultDocument) => {
      return downloadDocument(document.id);
    },
    [downloadDocument]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <EncryptionStatus size="sm" />
        </div>

        <div className="flex items-center gap-3">
          {documents.length > 0 && (
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchDocuments(projectId)}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error display */}
      {(documentsError || encryptionError) && (
        <div className="rounded-lg bg-error/10 p-4 text-sm text-error">
          {documentsError || encryptionError?.message}
        </div>
      )}

      {/* Upload section */}
      {showUpload && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              onUpload={handleUpload}
              isEncryptionReady={isEncryptionReady}
              onInitializeEncryption={initializeEncryption}
              isUploading={isUploading}
              maxFiles={maxFilesPerUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* Documents list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Your Files
              {documents.length > 0 && (
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({documents.length})
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DocumentList
            documents={documents}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onDelete={handleDelete}
            getUploadProgress={getUploadProgress}
            selectedDocumentId={selectedDocument?.id}
            viewMode={viewMode}
            isLoading={isLoading}
            emptyMessage="No files uploaded yet"
          />
        </CardContent>
      </Card>

      {/* Document viewer modal */}
      <DocumentViewer
        document={selectedDocument}
        onPreview={handleViewerPreview}
        onDownload={handleViewerDownload}
        onClose={handleViewerClose}
        isOpen={isViewerOpen}
      />
    </div>
  );
}
