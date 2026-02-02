'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import {
  IPFSClient,
  IPFSError,
  IPFSErrorCode,
  LocalCache,
  type IPFSUploadResult,
} from '@/lib/storage';

/**
 * State for IPFS operations.
 */
export interface IPFSState {
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Whether a download is in progress */
  isDownloading: boolean;
  /** Operation progress (0-100), if available */
  progress: number;
  /** Last error that occurred, if any */
  error: string | null;
}

/**
 * Return type for the useIPFS hook.
 */
export interface UseIPFSReturn extends IPFSState {
  /**
   * Upload data to IPFS.
   * @param data - File, Blob, or ArrayBuffer to upload
   * @param name - Optional name for the content
   * @returns Upload result with CID
   */
  upload: (data: File | Blob | ArrayBuffer, name?: string) => Promise<IPFSUploadResult>;

  /**
   * Download data from IPFS with caching.
   * Checks local cache first, then fetches from network.
   * @param cid - IPFS content identifier
   * @returns Downloaded content as ArrayBuffer
   */
  download: (cid: string) => Promise<ArrayBuffer>;

  /**
   * Get the gateway URL for a CID.
   * @param cid - IPFS content identifier
   * @returns Direct gateway URL
   */
  getUrl: (cid: string) => string;

  /**
   * Delete (unpin) content from IPFS.
   * Also removes from local cache.
   * @param cid - IPFS content identifier
   */
  deleteContent: (cid: string) => Promise<void>;

  /**
   * Clear all locally cached IPFS content.
   */
  clearCache: () => Promise<void>;

  /**
   * Check if content is available (in cache or on IPFS).
   * @param cid - IPFS content identifier
   * @returns true if content exists
   */
  exists: (cid: string) => Promise<boolean>;

  /**
   * Get cache statistics.
   * @returns Object with count and totalSize
   */
  getCacheStats: () => Promise<{ count: number; totalSize: number }>;
}

/**
 * Hook for IPFS operations with local caching.
 *
 * Provides a simple API for uploading and downloading files to/from IPFS,
 * with automatic local caching to improve performance and reduce network usage.
 *
 * @example
 * function FileUploader() {
 *   const { upload, download, isUploading, error } = useIPFS();
 *
 *   const handleUpload = async (file: File) => {
 *     const { cid } = await upload(file, file.name);
 *     console.log('Uploaded to:', cid);
 *   };
 *
 *   const handleDownload = async (cid: string) => {
 *     const data = await download(cid); // Uses cache if available
 *     // Process data...
 *   };
 *
 *   return (
 *     <div>
 *       {isUploading && <span>Uploading...</span>}
 *       {error && <span>Error: {error}</span>}
 *     </div>
 *   );
 * }
 */
export function useIPFS(): UseIPFSReturn {
  const [state, setState] = useState<IPFSState>({
    isUploading: false,
    isDownloading: false,
    progress: 0,
    error: null,
  });

  // Refs for client and cache to persist across renders
  const clientRef = useRef<IPFSClient | null>(null);
  const cacheRef = useRef<LocalCache | null>(null);
  const isMountedRef = useRef(true);

  // Initialize on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Initialize client and cache
    if (!clientRef.current) {
      clientRef.current = new IPFSClient();
    }
    if (!cacheRef.current) {
      cacheRef.current = new LocalCache();
      // Pre-initialize cache (non-blocking)
      cacheRef.current.init().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useIPFS] Cache initialization failed:', err);
        }
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Safely update state only if component is mounted.
   */
  const safeSetState = useCallback((updates: Partial<IPFSState>) => {
    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Convert error to user-friendly message.
   */
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof IPFSError) {
      switch (error.code) {
        case IPFSErrorCode.NOT_CONFIGURED:
          return 'IPFS storage is not configured. Please contact support.';
        case IPFSErrorCode.TIMEOUT:
          return 'The request timed out. Please try again.';
        case IPFSErrorCode.NOT_FOUND:
          return 'Content not found on IPFS.';
        case IPFSErrorCode.INVALID_CID:
          return 'Invalid content identifier.';
        case IPFSErrorCode.NETWORK_ERROR:
          return 'Network error. Please check your connection.';
        default:
          return error.message;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred.';
  }, []);

  /**
   * Upload data to IPFS.
   */
  const upload = useCallback(
    async (data: File | Blob | ArrayBuffer, name?: string): Promise<IPFSUploadResult> => {
      if (!clientRef.current) {
        throw new Error('IPFS client not initialized');
      }

      safeSetState({ isUploading: true, progress: 0, error: null });

      try {
        const result = await clientRef.current.upload(data, name);

        // Cache the uploaded content locally
        if (cacheRef.current) {
          try {
            // Convert to ArrayBuffer if needed
            let arrayBuffer: ArrayBuffer;
            if (data instanceof ArrayBuffer) {
              arrayBuffer = data;
            } else if (data instanceof Blob) {
              arrayBuffer = await data.arrayBuffer();
            } else {
              arrayBuffer = await (data as File).arrayBuffer();
            }
            await cacheRef.current.set(result.cid, arrayBuffer);
          } catch (cacheError) {
            // Cache failure is non-fatal
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useIPFS] Failed to cache uploaded content:', cacheError);
            }
          }
        }

        safeSetState({ isUploading: false, progress: 100 });
        return result;
      } catch (error) {
        const message = getErrorMessage(error);
        safeSetState({ isUploading: false, progress: 0, error: message });
        throw error;
      }
    },
    [safeSetState, getErrorMessage]
  );

  /**
   * Download data from IPFS with cache-first strategy.
   */
  const download = useCallback(
    async (cid: string): Promise<ArrayBuffer> => {
      if (!clientRef.current) {
        throw new Error('IPFS client not initialized');
      }

      safeSetState({ isDownloading: true, progress: 0, error: null });

      try {
        // Check cache first
        if (cacheRef.current) {
          try {
            const cached = await cacheRef.current.get(cid);
            if (cached) {
              safeSetState({ isDownloading: false, progress: 100 });
              return cached;
            }
          } catch (cacheError) {
            // Cache read failure is non-fatal, proceed to network
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useIPFS] Cache read failed:', cacheError);
            }
          }
        }

        // Fetch from IPFS
        const data = await clientRef.current.download(cid);

        // Cache the downloaded content
        if (cacheRef.current) {
          try {
            await cacheRef.current.set(cid, data);
          } catch (cacheError) {
            // Cache write failure is non-fatal
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useIPFS] Failed to cache downloaded content:', cacheError);
            }
          }
        }

        safeSetState({ isDownloading: false, progress: 100 });
        return data;
      } catch (error) {
        const message = getErrorMessage(error);
        safeSetState({ isDownloading: false, progress: 0, error: message });
        throw error;
      }
    },
    [safeSetState, getErrorMessage]
  );

  /**
   * Get gateway URL for a CID.
   */
  const getUrl = useCallback((cid: string): string => {
    if (!clientRef.current) {
      throw new Error('IPFS client not initialized');
    }
    return clientRef.current.getGatewayUrl(cid);
  }, []);

  /**
   * Delete content from IPFS and local cache.
   */
  const deleteContent = useCallback(
    async (cid: string): Promise<void> => {
      if (!clientRef.current) {
        throw new Error('IPFS client not initialized');
      }

      safeSetState({ error: null });

      try {
        // Delete from IPFS (unpin)
        await clientRef.current.delete(cid);

        // Remove from local cache
        if (cacheRef.current) {
          try {
            await cacheRef.current.delete(cid);
          } catch (cacheError) {
            // Cache delete failure is non-fatal
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useIPFS] Failed to remove from cache:', cacheError);
            }
          }
        }
      } catch (error) {
        const message = getErrorMessage(error);
        safeSetState({ error: message });
        throw error;
      }
    },
    [safeSetState, getErrorMessage]
  );

  /**
   * Clear all cached content.
   */
  const clearCache = useCallback(async (): Promise<void> => {
    if (!cacheRef.current) {
      return;
    }

    try {
      await cacheRef.current.clear();
    } catch (error) {
      const message = getErrorMessage(error);
      safeSetState({ error: message });
      throw error;
    }
  }, [safeSetState, getErrorMessage]);

  /**
   * Check if content exists (in cache or on IPFS).
   */
  const exists = useCallback(async (cid: string): Promise<boolean> => {
    // Check cache first
    if (cacheRef.current) {
      try {
        const inCache = await cacheRef.current.has(cid);
        if (inCache) {
          return true;
        }
      } catch {
        // Cache check failure, proceed to network
      }
    }

    // Check IPFS
    if (clientRef.current) {
      return clientRef.current.exists(cid);
    }

    return false;
  }, []);

  /**
   * Get cache statistics.
   */
  const getCacheStats = useCallback(async (): Promise<{ count: number; totalSize: number }> => {
    if (!cacheRef.current) {
      return { count: 0, totalSize: 0 };
    }
    return cacheRef.current.getStats();
  }, []);

  return {
    // State
    isUploading: state.isUploading,
    isDownloading: state.isDownloading,
    progress: state.progress,
    error: state.error,

    // Actions
    upload,
    download,
    getUrl,
    deleteContent,
    clearCache,
    exists,
    getCacheStats,
  };
}
