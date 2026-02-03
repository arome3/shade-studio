'use client';

import { useCallback, useRef } from 'react';
import { useWallet } from './use-wallet';
import { useEncryption } from './use-encryption';
import { useDocuments } from './use-documents';
import {
  useIntelligenceStore,
  useCurrentBriefing,
  useIsBriefingLoading,
  useBriefingError,
  useBriefingHistory,
  useGenerationProgress,
} from '@/stores/intelligence-store';
import {
  generateDailyBriefing,
  generateDefaultBriefing,
  type BriefingGenerationContext,
} from '@/lib/intelligence/briefing';
import type { ContextDocument } from '@/lib/ai/context';
import type {
  DailyBriefing,
  BriefingOptions,
  ItemStatus,
} from '@/types/intelligence';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for the useBriefing hook.
 */
export interface UseBriefingReturn {
  // State
  briefing: DailyBriefing | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
  needsRefresh: boolean;
  isConnected: boolean;
  isReady: boolean;

  // Actions
  generateBriefing: (options?: BriefingOptions) => Promise<void>;
  refreshBriefing: () => Promise<void>;
  updateItemStatus: (itemId: string, status: ItemStatus) => void;
  markItemRead: (itemId: string) => void;
  dismissItem: (itemId: string) => void;

  // History
  getHistoricalBriefing: (date: string) => DailyBriefing | null;
  briefingHistory: DailyBriefing[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for daily briefing operations.
 * Combines intelligence store with document context and AI generation.
 *
 * @param projectId - Optional project ID to scope documents
 *
 * @example
 * function BriefingPage({ projectId }) {
 *   const {
 *     briefing,
 *     isLoading,
 *     needsRefresh,
 *     generateBriefing,
 *     updateItemStatus,
 *   } = useBriefing(projectId);
 *
 *   useEffect(() => {
 *     if (needsRefresh && !isLoading) {
 *       generateBriefing();
 *     }
 *   }, [needsRefresh, isLoading, generateBriefing]);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   return <BriefingDisplay briefing={briefing} />;
 * }
 */
export function useBriefing(projectId?: string): UseBriefingReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Get wallet state
  const { isConnected, accountId } = useWallet();

  // Get encryption state (needed for document decryption)
  const { isReady: isEncryptionReady } = useEncryption();

  // Get documents for context building
  const { documents, downloadDocument } = useDocuments(projectId);

  // Get intelligence store state
  const briefing = useCurrentBriefing();
  const isLoading = useIsBriefingLoading();
  const error = useBriefingError();
  const progress = useGenerationProgress();
  const briefingHistoryArray = useBriefingHistory();

  // Get store actions
  const setBriefing = useIntelligenceStore((state) => state.setBriefing);
  const setLoading = useIntelligenceStore((state) => state.setLoading);
  const setError = useIntelligenceStore((state) => state.setError);
  const setGenerationProgress = useIntelligenceStore(
    (state) => state.setGenerationProgress
  );
  const updateItemStatusAction = useIntelligenceStore(
    (state) => state.updateItemStatus
  );
  const markItemReadAction = useIntelligenceStore((state) => state.markItemRead);
  const dismissItemAction = useIntelligenceStore((state) => state.dismissItem);
  const getBriefingByDate = useIntelligenceStore(
    (state) => state.getBriefingByDate
  );
  const isBriefingStale = useIntelligenceStore((state) => state.isBriefingStale);

  // Check readiness
  const isReady = isConnected && isEncryptionReady;

  // Check if refresh is needed
  const needsRefresh = !isLoading && isBriefingStale();

  /**
   * Load and decrypt documents for context.
   */
  const loadDocumentContents = useCallback(async (): Promise<ContextDocument[]> => {
    const contextDocs: ContextDocument[] = [];

    // Limit to recent documents to keep context manageable
    const recentDocs = documents.slice(0, 10);

    for (const doc of recentDocs) {
      try {
        const file = await downloadDocument(doc.id);
        const content = await file.text();

        contextDocs.push({
          id: doc.id,
          title: doc.metadata.name,
          type: doc.metadata.type,
          content,
          updatedAt: new Date(doc.metadata.updatedAt).toISOString(),
        });
      } catch (err) {
        console.warn(`[useBriefing] Failed to load document ${doc.id}:`, err);
        // Continue with other documents
      }
    }

    return contextDocs;
  }, [documents, downloadDocument]);

  /**
   * Generate a new daily briefing.
   */
  const generateBriefing = useCallback(
    async (options: BriefingOptions = {}) => {
      if (!isConnected || !accountId) {
        setError('Please connect your wallet to generate a briefing');
        return;
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setGenerationProgress(0);

      try {
        // Load document contents for context
        setGenerationProgress(5);
        let contextDocs: ContextDocument[] = [];

        if (isEncryptionReady && documents.length > 0) {
          try {
            contextDocs = await loadDocumentContents();
          } catch (err) {
            console.warn('[useBriefing] Failed to load documents:', err);
            // Continue without documents
          }
        }

        setGenerationProgress(15);

        // Build generation context
        // TODO: In a full implementation, we'd also load deadlines and projects
        // from their respective stores/APIs
        const context: BriefingGenerationContext = {
          documents: contextDocs,
          deadlines: [], // Placeholder - would come from deadline tracking
          projects: [], // Placeholder - would come from project store
          accountId,
        };

        // Generate briefing with progress updates
        const newBriefing = await generateDailyBriefing(context, {
          ...options,
          onProgress: (p) => {
            // Map AI progress (0-100) to overall progress (15-100)
            const mappedProgress = 15 + (p * 0.85);
            setGenerationProgress(mappedProgress);
            options.onProgress?.(p);
          },
          abortController: abortControllerRef.current,
        });

        // Store the briefing
        setBriefing(newBriefing);
        retryCountRef.current = 0;

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useBriefing] Generated briefing:', newBriefing.id);
        }
      } catch (err) {
        // Handle abort
        if (err instanceof Error && err.name === 'AbortError') {
          setLoading(false);
          return;
        }

        // Retry logic
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.warn(
            `[useBriefing] Retry ${retryCountRef.current}/${MAX_RETRIES}`
          );

          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return generateBriefing(options);
        }

        // Max retries reached - fall back to default briefing
        console.error('[useBriefing] Generation failed, using default:', err);

        const defaultBriefing = generateDefaultBriefing(accountId);
        setBriefing(defaultBriefing);

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate briefing. Showing default briefing.'
        );
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      isConnected,
      accountId,
      isEncryptionReady,
      documents,
      loadDocumentContents,
      setLoading,
      setError,
      setGenerationProgress,
      setBriefing,
    ]
  );

  /**
   * Refresh the current briefing.
   */
  const refreshBriefing = useCallback(async () => {
    retryCountRef.current = 0;
    await generateBriefing();
  }, [generateBriefing]);

  /**
   * Update an item's status.
   */
  const updateItemStatus = useCallback(
    (itemId: string, status: ItemStatus) => {
      updateItemStatusAction(itemId, status);
    },
    [updateItemStatusAction]
  );

  /**
   * Mark an item as read.
   */
  const markItemRead = useCallback(
    (itemId: string) => {
      markItemReadAction(itemId);
    },
    [markItemReadAction]
  );

  /**
   * Dismiss an item.
   */
  const dismissItem = useCallback(
    (itemId: string) => {
      dismissItemAction(itemId);
    },
    [dismissItemAction]
  );

  /**
   * Get a historical briefing by date.
   */
  const getHistoricalBriefing = useCallback(
    (date: string): DailyBriefing | null => {
      return getBriefingByDate(date);
    },
    [getBriefingByDate]
  );

  return {
    // State
    briefing,
    isLoading,
    error,
    progress,
    needsRefresh,
    isConnected,
    isReady,

    // Actions
    generateBriefing,
    refreshBriefing,
    updateItemStatus,
    markItemRead,
    dismissItem,

    // History
    getHistoricalBriefing,
    briefingHistory: briefingHistoryArray,
  };
}
