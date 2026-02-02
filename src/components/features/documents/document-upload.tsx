'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { formatFileSize, validateFile, DocumentError } from '@/lib/documents/manager';
import { getAllSupportedMimeTypes } from '@/types/vault-document';
import { MAX_FILE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export interface DocumentUploadProps {
  /** Called when files are selected/dropped */
  onUpload: (files: File[]) => Promise<void>;
  /** Whether encryption is ready */
  isEncryptionReady: boolean;
  /** Called to initialize encryption */
  onInitializeEncryption?: () => Promise<void>;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Maximum number of files to accept (default: 5) */
  maxFiles?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Drag-and-drop file upload component.
 * Validates files before upload and shows encryption status.
 */
export function DocumentUpload({
  onUpload,
  isEncryptionReady,
  onInitializeEncryption,
  isUploading,
  disabled,
  maxFiles = 5,
  className,
}: DocumentUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: { file: File; errors: readonly { message: string }[] }[]) => {
      setError(null);
      setValidationErrors([]);

      // Handle rejected files from dropzone
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map(
          (r) => `${r.file.name}: ${r.errors.map((e) => e.message).join(', ')}`
        );
        setValidationErrors(errors);
        return;
      }

      // Validate all files
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of acceptedFiles) {
        try {
          validateFile(file);
          validFiles.push(file);
        } catch (err) {
          if (err instanceof DocumentError) {
            errors.push(`${file.name}: ${err.message}`);
          } else {
            errors.push(`${file.name}: Unknown error`);
          }
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
      }

      if (validFiles.length === 0) {
        return;
      }

      // Check if encryption is ready
      if (!isEncryptionReady) {
        setError('Encryption not initialized. Please unlock encryption first.');
        return;
      }

      // Upload valid files
      try {
        await onUpload(validFiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [isEncryptionReady, onUpload]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: getAllSupportedMimeTypes().reduce(
      (acc, type) => {
        acc[type] = [];
        return acc;
      },
      {} as Record<string, string[]>
    ),
    maxFiles,
    maxSize: MAX_FILE_SIZE,
    disabled: disabled || isUploading,
    noClick: !isEncryptionReady,
    noKeyboard: !isEncryptionReady,
  });

  const handleInitializeEncryption = async () => {
    setError(null);
    try {
      await onInitializeEncryption?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize encryption');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
          isDragActive && !isDragReject && 'border-near-green-500 bg-near-green-500/5',
          isDragReject && 'border-error bg-error/5',
          !isDragActive && !isDragReject && 'border-border hover:border-border-hover',
          (disabled || isUploading) && 'cursor-not-allowed opacity-50',
          !isEncryptionReady && 'cursor-default'
        )}
      >
        <input {...getInputProps()} />

        {/* Upload icon */}
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full',
            isDragActive ? 'bg-near-green-500/20' : 'bg-surface-hover'
          )}
        >
          {isUploading ? (
            <svg
              className="h-7 w-7 animate-spin text-near-green-500"
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
          ) : (
            <svg
              className={cn(
                'h-7 w-7',
                isDragActive ? 'text-near-green-500' : 'text-text-muted'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          )}
        </div>

        {/* Text */}
        {isUploading ? (
          <p className="text-sm text-text-primary">Uploading and encrypting...</p>
        ) : !isEncryptionReady ? (
          <div className="text-center">
            <p className="mb-2 text-sm text-text-primary">
              Encryption required for secure file storage
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleInitializeEncryption();
              }}
            >
              Unlock Encryption
            </Button>
          </div>
        ) : isDragActive ? (
          <p className="text-sm text-near-green-500">Drop files here</p>
        ) : (
          <div className="text-center">
            <p className="mb-1 text-sm text-text-primary">
              <span className="font-medium text-near-green-500">Click to upload</span>
              {' '}or drag and drop
            </p>
            <p className="text-xs text-text-muted">
              PDF, Images, Word, Excel, Text • Max {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((err, i) => (
            <div key={i} className="rounded-lg bg-warning/10 p-2 text-xs text-warning">
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Encryption status hint */}
      {isEncryptionReady && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <svg
            className="h-4 w-4 text-near-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          Files are encrypted before upload
        </div>
      )}
    </div>
  );
}
