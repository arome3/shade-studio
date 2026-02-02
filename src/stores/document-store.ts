import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { VaultDocument, VaultDocumentStatus } from '@/types/vault-document';

/**
 * Status states for document operations.
 */
export type DocumentsLoadingStatus = 'idle' | 'loading' | 'error';

/**
 * Documents state shape.
 */
export interface DocumentsState {
  /** Map of document ID to document */
  documents: Record<string, VaultDocument>;
  /** Upload progress per document (0-100) */
  uploadProgress: Record<string, number>;
  /** Loading status for fetching documents */
  loadingStatus: DocumentsLoadingStatus;
  /** Last error that occurred */
  error: string | null;
  /** Timestamp of last successful fetch */
  lastFetchedAt: number | null;
  /** Currently selected document ID for viewing */
  selectedDocumentId: string | null;
}

/**
 * Documents actions for state transitions.
 */
export interface DocumentsActions {
  /** Set loading status */
  setLoading: () => void;
  /** Set idle status */
  setIdle: () => void;
  /** Add a document to the store (optimistic update) */
  addDocument: (document: VaultDocument) => void;
  /** Update a document in the store */
  updateDocument: (
    documentId: string,
    updates: Partial<VaultDocument>
  ) => void;
  /** Update document status */
  updateDocumentStatus: (
    documentId: string,
    status: VaultDocumentStatus,
    error?: string
  ) => void;
  /** Remove a document from the store */
  removeDocument: (documentId: string) => void;
  /** Set upload progress for a document */
  setUploadProgress: (documentId: string, progress: number) => void;
  /** Clear upload progress for a document */
  clearUploadProgress: (documentId: string) => void;
  /** Load documents for a project (replaces existing for that project) */
  loadProjectDocuments: (
    projectId: string,
    documents: VaultDocument[]
  ) => void;
  /** Set error state */
  setError: (error: string) => void;
  /** Clear error */
  clearError: () => void;
  /** Select a document for viewing */
  selectDocument: (documentId: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
}

/**
 * Initial state for the documents store.
 */
const initialState: DocumentsState = {
  documents: {},
  uploadProgress: {},
  loadingStatus: 'idle',
  error: null,
  lastFetchedAt: null,
  selectedDocumentId: null,
};

/**
 * Documents store combining state and actions.
 * Manages vault document state for encrypted file storage.
 */
export const useDocumentsStore = create<DocumentsState & DocumentsActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setLoading: () =>
        set(
          { loadingStatus: 'loading', error: null },
          false,
          'setLoading'
        ),

      setIdle: () =>
        set({ loadingStatus: 'idle' }, false, 'setIdle'),

      addDocument: (document: VaultDocument) =>
        set(
          (state) => ({
            documents: {
              ...state.documents,
              [document.id]: document,
            },
          }),
          false,
          'addDocument'
        ),

      updateDocument: (
        documentId: string,
        updates: Partial<VaultDocument>
      ) =>
        set(
          (state) => {
            const existing = state.documents[documentId];
            if (!existing) return state;

            return {
              documents: {
                ...state.documents,
                [documentId]: { ...existing, ...updates },
              },
            };
          },
          false,
          'updateDocument'
        ),

      updateDocumentStatus: (
        documentId: string,
        status: VaultDocumentStatus,
        error?: string
      ) =>
        set(
          (state) => {
            const existing = state.documents[documentId];
            if (!existing) return state;

            return {
              documents: {
                ...state.documents,
                [documentId]: {
                  ...existing,
                  status,
                  error,
                },
              },
            };
          },
          false,
          'updateDocumentStatus'
        ),

      removeDocument: (documentId: string) =>
        set(
          (state) => {
            const { [documentId]: removed, ...rest } = state.documents;
            const { [documentId]: progressRemoved, ...restProgress } =
              state.uploadProgress;

            return {
              documents: rest,
              uploadProgress: restProgress,
              // Clear selection if the removed document was selected
              selectedDocumentId:
                state.selectedDocumentId === documentId
                  ? null
                  : state.selectedDocumentId,
            };
          },
          false,
          'removeDocument'
        ),

      setUploadProgress: (documentId: string, progress: number) =>
        set(
          (state) => ({
            uploadProgress: {
              ...state.uploadProgress,
              [documentId]: Math.min(100, Math.max(0, progress)),
            },
          }),
          false,
          'setUploadProgress'
        ),

      clearUploadProgress: (documentId: string) =>
        set(
          (state) => {
            const { [documentId]: removed, ...rest } = state.uploadProgress;
            return { uploadProgress: rest };
          },
          false,
          'clearUploadProgress'
        ),

      loadProjectDocuments: (
        projectId: string,
        documents: VaultDocument[]
      ) =>
        set(
          (state) => {
            // Remove existing documents for this project
            const filteredDocs = Object.fromEntries(
              Object.entries(state.documents).filter(
                ([, doc]) => doc.projectId !== projectId
              )
            );

            // Add new documents
            const newDocs = documents.reduce(
              (acc, doc) => {
                acc[doc.id] = doc;
                return acc;
              },
              {} as Record<string, VaultDocument>
            );

            return {
              documents: { ...filteredDocs, ...newDocs },
              loadingStatus: 'idle',
              lastFetchedAt: Date.now(),
              error: null,
            };
          },
          false,
          'loadProjectDocuments'
        ),

      setError: (error: string) =>
        set(
          { loadingStatus: 'error', error },
          false,
          'setError'
        ),

      clearError: () =>
        set({ error: null }, false, 'clearError'),

      selectDocument: (documentId: string | null) =>
        set(
          { selectedDocumentId: documentId },
          false,
          'selectDocument'
        ),

      reset: () => set(initialState, false, 'reset'),
    }),
    {
      name: 'documents-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get all documents as an array.
 */
export const useDocumentsList = () =>
  useDocumentsStore((state) => Object.values(state.documents));

/**
 * Get documents for a specific project.
 */
export const useProjectDocuments = (projectId: string) =>
  useDocumentsStore((state) =>
    Object.values(state.documents).filter(
      (doc) => doc.projectId === projectId
    )
  );

/**
 * Get a specific document by ID.
 */
export const useDocument = (documentId: string) =>
  useDocumentsStore((state) => state.documents[documentId]);

/**
 * Get the currently selected document.
 */
export const useSelectedDocument = () =>
  useDocumentsStore((state) =>
    state.selectedDocumentId
      ? state.documents[state.selectedDocumentId]
      : null
  );

/**
 * Get upload progress for a document.
 */
export const useDocumentUploadProgress = (documentId: string) =>
  useDocumentsStore((state) => state.uploadProgress[documentId] ?? 0);

/**
 * Get all documents currently uploading.
 */
export const useUploadingDocuments = () =>
  useDocumentsStore((state) =>
    Object.values(state.documents).filter(
      (doc) => doc.status === 'uploading'
    )
  );

/**
 * Check if documents are currently loading.
 */
export const useIsDocumentsLoading = () =>
  useDocumentsStore((state) => state.loadingStatus === 'loading');

/**
 * Get the documents error state.
 */
export const useDocumentsError = () =>
  useDocumentsStore((state) => state.error);

/**
 * Get count of documents for a project.
 */
export const useProjectDocumentCount = (projectId: string) =>
  useDocumentsStore(
    (state) =>
      Object.values(state.documents).filter(
        (doc) => doc.projectId === projectId
      ).length
  );
