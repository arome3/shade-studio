/**
 * Local Cache using IndexedDB
 *
 * Provides persistent caching for IPFS content to reduce network requests
 * and improve performance. Cache is automatically pruned when it exceeds
 * the maximum size.
 */

import { IPFS_CONSTANTS } from '@/lib/constants';

/**
 * Cache entry stored in IndexedDB.
 */
export interface CacheEntry {
  /** IPFS content identifier */
  cid: string;
  /** Cached content as ArrayBuffer */
  data: ArrayBuffer;
  /** Timestamp when the entry was cached (ms since epoch) */
  timestamp: number;
  /** Size of the cached content in bytes */
  size: number;
}

/**
 * Cache metadata for tracking entries without loading full data.
 */
export interface CacheMetadata {
  cid: string;
  timestamp: number;
  size: number;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Number of entries in the cache */
  count: number;
  /** Total size of all cached content in bytes */
  totalSize: number;
}

/**
 * Error thrown for cache-related failures.
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export const CacheErrorCode = {
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  INIT_FAILED: 'INIT_FAILED',
  WRITE_FAILED: 'WRITE_FAILED',
  READ_FAILED: 'READ_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
} as const;

export type CacheErrorCodeType = (typeof CacheErrorCode)[keyof typeof CacheErrorCode];

/**
 * Check if IndexedDB is available in the current environment.
 */
function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * LocalCache class for caching IPFS content in IndexedDB.
 */
export class LocalCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB connection.
   * This is called automatically on first use.
   */
  async init(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Already initialized
    if (this.db) {
      return;
    }

    // Check if IndexedDB is available
    if (!isIndexedDBAvailable()) {
      throw new CacheError(
        'IndexedDB is not available in this environment',
        CacheErrorCode.NOT_AVAILABLE
      );
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(
        IPFS_CONSTANTS.DB_NAME,
        IPFS_CONSTANTS.DB_VERSION
      );

      request.onerror = () => {
        this.initPromise = null;
        reject(
          new CacheError(
            'Failed to open IndexedDB',
            CacheErrorCode.INIT_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create content store if it doesn't exist
        if (!db.objectStoreNames.contains(IPFS_CONSTANTS.CONTENT_STORE)) {
          const store = db.createObjectStore(IPFS_CONSTANTS.CONTENT_STORE, {
            keyPath: 'cid',
          });
          // Index by timestamp for pruning (oldest first)
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create metadata store if it doesn't exist
        if (!db.objectStoreNames.contains(IPFS_CONSTANTS.METADATA_STORE)) {
          db.createObjectStore(IPFS_CONSTANTS.METADATA_STORE, {
            keyPath: 'cid',
          });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure the database is initialized.
   */
  private async ensureInit(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new CacheError(
        'Database not initialized',
        CacheErrorCode.INIT_FAILED
      );
    }
    return this.db;
  }

  /**
   * Store content in the cache.
   *
   * @param cid - IPFS content identifier
   * @param data - Content to cache
   *
   * @example
   * const cache = new LocalCache();
   * await cache.set('Qm...', arrayBuffer);
   */
  async set(cid: string, data: ArrayBuffer): Promise<void> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readwrite');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      const entry: CacheEntry = {
        cid,
        data,
        timestamp: Date.now(),
        size: data.byteLength,
      };

      const request = store.put(entry);

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to write to cache',
            CacheErrorCode.WRITE_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Retrieve content from the cache.
   *
   * @param cid - IPFS content identifier
   * @returns Cached content or null if not found
   *
   * @example
   * const data = await cache.get('Qm...');
   * if (data) {
   *   // Use cached data
   * }
   */
  async get(cid: string): Promise<ArrayBuffer | null> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readonly');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      const request = store.get(cid);

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to read from cache',
            CacheErrorCode.READ_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry?.data ?? null);
      };
    });
  }

  /**
   * Check if content is cached.
   *
   * @param cid - IPFS content identifier
   * @returns true if content is cached
   */
  async has(cid: string): Promise<boolean> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readonly');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      const request = store.count(cid);

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to check cache',
            CacheErrorCode.READ_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        resolve(request.result > 0);
      };
    });
  }

  /**
   * Remove content from the cache.
   *
   * @param cid - IPFS content identifier
   */
  async delete(cid: string): Promise<void> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readwrite');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      const request = store.delete(cid);

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to delete from cache',
            CacheErrorCode.DELETE_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all cached content.
   */
  async clear(): Promise<void> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readwrite');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      const request = store.clear();

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to clear cache',
            CacheErrorCode.DELETE_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get cache statistics.
   *
   * @returns Object with count and totalSize
   */
  async getStats(): Promise<CacheStats> {
    const db = await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readonly');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);

      let count = 0;
      let totalSize = 0;

      const request = store.openCursor();

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to get cache stats',
            CacheErrorCode.READ_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          count++;
          totalSize += entry.size;
          cursor.continue();
        } else {
          resolve({ count, totalSize });
        }
      };
    });
  }

  /**
   * Prune the cache to stay under a size limit.
   * Removes oldest entries first until under the limit.
   *
   * @param maxBytes - Maximum cache size in bytes (default: MAX_CACHE_SIZE)
   * @returns Number of entries removed
   *
   * @example
   * // Prune to 50MB
   * const removed = await cache.prune(50 * 1024 * 1024);
   */
  async prune(maxBytes: number = IPFS_CONSTANTS.MAX_CACHE_SIZE): Promise<number> {
    const db = await this.ensureInit();
    const stats = await this.getStats();

    if (stats.totalSize <= maxBytes) {
      return 0;
    }

    // Get all entries sorted by timestamp (oldest first)
    const entries = await new Promise<CacheMetadata[]>((resolve, reject) => {
      const transaction = db.transaction(IPFS_CONSTANTS.CONTENT_STORE, 'readonly');
      const store = transaction.objectStore(IPFS_CONSTANTS.CONTENT_STORE);
      const index = store.index('timestamp');

      const entries: CacheMetadata[] = [];
      const request = index.openCursor();

      request.onerror = () => {
        reject(
          new CacheError(
            'Failed to read cache entries',
            CacheErrorCode.READ_FAILED,
            request.error
          )
        );
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          entries.push({
            cid: entry.cid,
            timestamp: entry.timestamp,
            size: entry.size,
          });
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
    });

    // Calculate how much to remove
    let currentSize = stats.totalSize;
    const toRemove: string[] = [];

    for (const entry of entries) {
      if (currentSize <= maxBytes) {
        break;
      }
      toRemove.push(entry.cid);
      currentSize -= entry.size;
    }

    // Remove entries
    for (const cid of toRemove) {
      await this.delete(cid);
    }

    return toRemove.length;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Singleton instance
let defaultCache: LocalCache | null = null;

/**
 * Get the default local cache instance.
 */
export function getLocalCache(): LocalCache {
  if (!defaultCache) {
    defaultCache = new LocalCache();
  }
  return defaultCache;
}
