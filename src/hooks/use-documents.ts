'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useWallet } from './use-wallet';
import { useEncryption } from './use-encryption';
import {
  useDocumentsStore,
  type DocumentsLoadingStatus,
} from '@/stores/document-store';
import {
  storedToVaultDocument,
  validateFile,
} from '@/lib/documents/manager';
import {
  generatePreview,
  revokeDocumentPreview,
  revokeAllPreviews,
  type DocumentPreview,
} from '@/lib/documents/preview';
import {
  getDocuments,
  type SocialAccount,
} from '@/lib/near/social';
import { getWalletSelector } from '@/lib/near/wallet';
import {
  WalletNotConnectedError,
  WalletNotInitializedError,
} from '@/lib/near/errors';
import { EncryptionNotInitializedError } from '@/lib/crypto';
import type { VaultDocument, CreateVaultDocumentInput } from '@/types/vault-document';

/**
 * Return type for the useDocuments hook.
 */
export interface UseDocumentsReturn {
  // State
  status: DocumentsLoadingStatus;
  documents: VaultDocument[];
  selectedDocument: VaultDocument | null;
  error: string | null;
  isLoading: boolean;

  // Actions
  fetchDocuments: (projectId: string) => Promise<void>;
  uploadDocument: (input: CreateVaultDocumentInput) => Promise<VaultDocument>;
  downloadDocument: (documentId: string) => Promise<File>;
  previewDocument: (documentId: string) => Promise<DocumentPreview>;
  deleteDocument: (documentId: string) => Promise<void>;
  selectDocument: (documentId: string | null) => void;
  validateFileForUpload: (file: File) => void;

  // Upload progress
  getUploadProgress: (documentId: string) => number;
}

/**
 * Main documents hook for vault file operations.
 * Combines store, encryption, and IPFS operations.
 *
 * @param projectId - Optional project ID to filter documents
 *
 * @example
 * function DocumentList({ projectId }) {
 *   const { documents, isLoading, uploadDocument } = useDocuments(projectId);
 *
 *   useEffect(() => {
 *     fetchDocuments(projectId);
 *   }, [projectId]);
 *
 *   const handleUpload = async (file: File) => {
 *     await uploadDocument({ file, projectId });
 *   };
 * }
 */
export function useDocuments(projectId?: string): UseDocumentsReturn {
  const fetchAttempted = useRef(false);

  // Get wallet state
  const { isConnected, accountId } = useWallet();

  // Get encryption state and methods
  const { isReady: isEncryptionReady, encryptFileData, decryptFileData } =
    useEncryption();

  // Get documents store state and actions
  const loadingStatus = useDocumentsStore((state) => state.loadingStatus);
  const allDocuments = useDocumentsStore((state) => state.documents);
  const selectedDocumentId = useDocumentsStore(
    (state) => state.selectedDocumentId
  );
  const uploadProgress = useDocumentsStore((state) => state.uploadProgress);
  const error = useDocumentsStore((state) => state.error);

  const setLoading = useDocumentsStore((state) => state.setLoading);
  const addDocument = useDocumentsStore((state) => state.addDocument);
  const updateDocumentStatus = useDocumentsStore(
    (state) => state.updateDocumentStatus
  );
  const removeDocument = useDocumentsStore((state) => state.removeDocument);
  const setUploadProgress = useDocumentsStore(
    (state) => state.setUploadProgress
  );
  const clearUploadProgress = useDocumentsStore(
    (state) => state.clearUploadProgress
  );
  const loadProjectDocuments = useDocumentsStore(
    (state) => state.loadProjectDocuments
  );
  const setError = useDocumentsStore((state) => state.setError);
  const selectDocumentAction = useDocumentsStore(
    (state) => state.selectDocument
  );
  const reset = useDocumentsStore((state) => state.reset);

  // Filter documents by project if projectId provided
  const documents = projectId
    ? Object.values(allDocuments).filter((doc) => doc.projectId === projectId)
    : Object.values(allDocuments);

  // Get selected document
  const selectedDocument = selectedDocumentId
    ? allDocuments[selectedDocumentId] ?? null
    : null;

  /**
   * Get the SocialAccount object for transactions.
   */
  const getSocialAccount = useCallback(async (): Promise<SocialAccount> => {
    const selector = getWalletSelector();
    if (!selector) {
      throw new WalletNotInitializedError();
    }

    if (!isConnected || !accountId) {
      throw new WalletNotConnectedError();
    }

    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();
    const account = accounts.find((a) => a.accountId === accountId);

    if (!account) {
      throw new WalletNotConnectedError('No account found');
    }

    return {
      accountId: account.accountId,
      publicKey: account.publicKey?.toString() ?? '',
    };
  }, [isConnected, accountId]);

  /**
   * Sign and send a transaction via the wallet.
   * Converts NAJ-format actions (from near-social-js) to Wallet Selector format.
   */
  const signAndSendTransaction = useCallback(
    async (transaction: { receiverId: string; actions: unknown[] }) => {
      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: transaction.receiverId,
        actions: transaction.actions.map((action: unknown) => {
          const typedAction = action as {
            functionCall?: {
              methodName: string;
              args: Uint8Array;
              gas: bigint;
              deposit: bigint;
            };
          };

          if (!typedAction.functionCall) {
            throw new Error('Invalid action type');
          }

          // Decode Uint8Array args back to a JSON object.
          // near-social-js encodes the args as JSON bytes, but the
          // Wallet Selector expects a plain object (it re-encodes internally).
          let args: Record<string, unknown>;
          try {
            const argsJson = new TextDecoder().decode(typedAction.functionCall.args);
            args = JSON.parse(argsJson);
          } catch {
            // Fallback: pass as base64-encoded object if not valid JSON
            args = { data: Array.from(typedAction.functionCall.args) };
          }

          return {
            type: 'FunctionCall' as const,
            params: {
              methodName: typedAction.functionCall.methodName,
              args,
              gas: typedAction.functionCall.gas.toString(),
              deposit: typedAction.functionCall.deposit.toString(),
            },
          };
        }),
      });
    },
    []
  );

  /**
   * Fetch documents for a project from NEAR Social.
   */
  const fetchDocuments = useCallback(
    async (fetchProjectId: string) => {
      if (!accountId) {
        return;
      }

      try {
        setLoading();

        const documentsData = await getDocuments(accountId, fetchProjectId);

        const documentsList: VaultDocument[] = Object.entries(documentsData).map(
          ([docId, data]) => storedToVaultDocument(docId, fetchProjectId, data)
        );

        // Sort by createdAt descending (newest first)
        documentsList.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);

        loadProjectDocuments(fetchProjectId, documentsList);

        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[useDocuments] Fetched',
            documentsList.length,
            'documents for project',
            fetchProjectId
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch documents';
        setError(message);

        if (process.env.NODE_ENV === 'development') {
          console.error('[useDocuments] Fetch failed:', err);
        }
      }
    },
    [accountId, setLoading, loadProjectDocuments, setError]
  );

  /**
   * Upload a file to the vault.
   */
  const uploadDocument = useCallback(
    async (input: CreateVaultDocumentInput): Promise<VaultDocument> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      if (!isEncryptionReady) {
        throw new EncryptionNotInitializedError();
      }

      const { file, projectId: uploadProjectId, tags } = input;

      // Validate file first
      validateFile(file);

      // Create placeholder document for optimistic update
      const placeholderId = `uploading-${Date.now()}`;
      const placeholderDoc: VaultDocument = {
        id: placeholderId,
        projectId: uploadProjectId,
        metadata: {
          name: file.name,
          type: 'other',
          mimeType: file.type,
          size: file.size,
          ipfsCid: '',
          encryptionNonce: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags,
        },
        status: 'uploading',
      };

      try {
        // Add placeholder to store
        addDocument(placeholderDoc);
        setUploadProgress(placeholderId, 0);

        // Encrypt the file
        setUploadProgress(placeholderId, 20);
        const { payload } = await encryptFileData(file);

        setUploadProgress(placeholderId, 40);

        // Get account for transaction
        const account = await getSocialAccount();

        // Import required modules
        const { decodeBase64 } = await import('@/lib/crypto/utils');
        const { getIPFSClient } = await import('@/lib/storage/ipfs');
        const { buildSaveDocumentTransaction } = await import('@/lib/near/social');
        const { nanoid } = await import('nanoid');
        const { getDocumentTypeFromMime } = await import('@/lib/documents/manager');

        // Convert ciphertext to binary for IPFS (more efficient than base64)
        const ciphertextBytes = decodeBase64(payload.ciphertext);
        const encryptedBlob = new Blob([new Uint8Array(ciphertextBytes)], {
          type: 'application/octet-stream',
        });

        setUploadProgress(placeholderId, 60);

        // Upload to IPFS
        const ipfsClient = getIPFSClient();
        const ipfsResult = await ipfsClient.upload(
          encryptedBlob,
          `${file.name}.encrypted`
        );

        setUploadProgress(placeholderId, 80);

        // Build document
        const documentId = nanoid();
        const now = Date.now();
        const documentType = getDocumentTypeFromMime(file.type);

        const finalDocument: VaultDocument = {
          id: documentId,
          projectId: uploadProjectId,
          metadata: {
            name: file.name,
            type: documentType,
            mimeType: file.type,
            size: file.size,
            ipfsCid: ipfsResult.cid,
            encryptionNonce: payload.nonce,
            createdAt: now,
            updatedAt: now,
            tags,
          },
          status: 'encrypted',
        };

        // Build and send transaction
        const storedMetadata = {
          name: finalDocument.metadata.name,
          type: finalDocument.metadata.type,
          mimeType: finalDocument.metadata.mimeType,
          ipfsCid: finalDocument.metadata.ipfsCid,
          encryptionNonce: finalDocument.metadata.encryptionNonce,
          size: finalDocument.metadata.size,
          createdAt: finalDocument.metadata.createdAt,
          updatedAt: finalDocument.metadata.updatedAt,
          tags: finalDocument.metadata.tags,
        };

        const socialTransaction = await buildSaveDocumentTransaction(
          account,
          uploadProjectId,
          documentId,
          storedMetadata
        );

        await signAndSendTransaction(
          socialTransaction as unknown as { receiverId: string; actions: unknown[] }
        );

        setUploadProgress(placeholderId, 100);

        // Remove placeholder and add real document
        removeDocument(placeholderId);
        clearUploadProgress(placeholderId);

        const storedDocument: VaultDocument = {
          ...finalDocument,
          status: 'stored',
        };
        addDocument(storedDocument);

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useDocuments] Uploaded document:', documentId);
        }

        return storedDocument;
      } catch (err) {
        // Update placeholder to error state
        updateDocumentStatus(
          placeholderId,
          'error',
          err instanceof Error ? err.message : 'Upload failed'
        );
        clearUploadProgress(placeholderId);

        if (process.env.NODE_ENV === 'development') {
          console.error('[useDocuments] Upload failed:', err);
        }

        throw err;
      }
    },
    [
      isConnected,
      accountId,
      isEncryptionReady,
      encryptFileData,
      getSocialAccount,
      signAndSendTransaction,
      addDocument,
      removeDocument,
      updateDocumentStatus,
      setUploadProgress,
      clearUploadProgress,
    ]
  );

  /**
   * Download and decrypt a document.
   */
  const downloadDocument = useCallback(
    async (documentId: string): Promise<File> => {
      if (!isEncryptionReady) {
        throw new EncryptionNotInitializedError();
      }

      const document = allDocuments[documentId];
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      const { metadata } = document;

      // Download from IPFS
      const { getIPFSClient } = await import('@/lib/storage/ipfs');
      const ipfsClient = getIPFSClient();
      const encryptedData = await ipfsClient.download(metadata.ipfsCid);

      // Reconstruct encrypted payload
      const ciphertextArray = new Uint8Array(encryptedData);
      const ciphertextBase64 = btoa(
        String.fromCharCode.apply(null, Array.from(ciphertextArray))
      );

      const payload = {
        ciphertext: ciphertextBase64,
        nonce: metadata.encryptionNonce,
        ephemeralPublicKey: '',
        version: 1,
      };

      // Decrypt
      const file = await decryptFileData(payload, {
        name: metadata.name,
        type: metadata.mimeType,
        size: metadata.size,
        lastModified: metadata.updatedAt,
      });

      return file;
    },
    [isEncryptionReady, allDocuments, decryptFileData]
  );

  /**
   * Generate preview for a document.
   */
  const previewDocument = useCallback(
    async (documentId: string): Promise<DocumentPreview> => {
      const file = await downloadDocument(documentId);
      const document = allDocuments[documentId];

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      return generatePreview(file, document.metadata.type);
    },
    [downloadDocument, allDocuments]
  );

  /**
   * Delete a document.
   */
  const deleteDocument = useCallback(
    async (documentId: string): Promise<void> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      const document = allDocuments[documentId];
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      try {
        // Optimistically remove from store
        removeDocument(documentId);
        revokeDocumentPreview(documentId);

        // Get account for transaction
        const account = await getSocialAccount();

        // Build and send delete transaction
        const { buildDeleteDocumentTransaction } = await import('@/lib/near/social');
        const transaction = await buildDeleteDocumentTransaction(
          account,
          document.projectId,
          documentId
        );

        await signAndSendTransaction(
          transaction as unknown as { receiverId: string; actions: unknown[] }
        );

        // Try to delete from IPFS (non-blocking)
        try {
          const { getIPFSClient } = await import('@/lib/storage/ipfs');
          const ipfsClient = getIPFSClient();
          await ipfsClient.delete(document.metadata.ipfsCid);
        } catch {
          // Ignore IPFS deletion errors
        }

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useDocuments] Deleted document:', documentId);
        }
      } catch (err) {
        // Rollback: re-add the document
        addDocument(document);

        if (process.env.NODE_ENV === 'development') {
          console.error('[useDocuments] Delete failed:', err);
        }

        throw err;
      }
    },
    [
      isConnected,
      accountId,
      allDocuments,
      removeDocument,
      addDocument,
      getSocialAccount,
      signAndSendTransaction,
    ]
  );

  /**
   * Select a document for viewing.
   */
  const selectDocument = useCallback(
    (documentId: string | null) => {
      selectDocumentAction(documentId);
    },
    [selectDocumentAction]
  );

  /**
   * Validate a file for upload (without uploading).
   */
  const validateFileForUpload = useCallback((file: File) => {
    validateFile(file);
  }, []);

  /**
   * Get upload progress for a document.
   */
  const getUploadProgress = useCallback(
    (documentId: string) => {
      return uploadProgress[documentId] ?? 0;
    },
    [uploadProgress]
  );

  // Reset store when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      reset();
      revokeAllPreviews();
      fetchAttempted.current = false;
    }
  }, [isConnected, reset]);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      revokeAllPreviews();
    };
  }, []);

  return {
    // State
    status: loadingStatus,
    documents,
    selectedDocument,
    error,
    isLoading: loadingStatus === 'loading',

    // Actions
    fetchDocuments,
    uploadDocument,
    downloadDocument,
    previewDocument,
    deleteDocument,
    selectDocument,
    validateFileForUpload,

    // Upload progress
    getUploadProgress,
  };
}
