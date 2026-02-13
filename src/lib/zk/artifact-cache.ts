/**
 * IndexedDB Persistent Cache for ZK Circuit Artifacts
 *
 * Follows the LocalCache pattern from src/lib/storage/local.ts:
 * singleton class, init()/ensureInit(), isIndexedDBAvailable() guard.
 *
 * Separate DB from the IPFS cache to avoid migration conflicts.
 * All public methods are non-fatal: they catch internally and return
 * null/void on failure so that a broken cache never blocks proof generation.
 */

import { ZK_CACHE_CONSTANTS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Artifact types stored in the binary store */
export type ArtifactType = 'wasm' | 'zkey';

interface BinaryArtifactEntry {
  key: string;
  data: ArrayBuffer;
  circuitId: string;
  type: ArtifactType;
  version: string;
  size: number;
  timestamp: number;
}

interface VkeyArtifactEntry {
  key: string;
  data: object;
  circuitId: string;
  version: string;
  timestamp: number;
}

export interface ArtifactCacheStats {
  binaryCount: number;
  binarySize: number;
  vkeyCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function buildKey(circuitId: string, version: string, type: string): string {
  return `${circuitId}:${version}:${type}`;
}

// ---------------------------------------------------------------------------
// ArtifactCache
// ---------------------------------------------------------------------------

export class ArtifactCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Initialize the IndexedDB connection. Auto-called on first use. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    if (!isIndexedDBAvailable()) {
      return;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(
        ZK_CACHE_CONSTANTS.DB_NAME,
        ZK_CACHE_CONSTANTS.DB_VERSION
      );

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(ZK_CACHE_CONSTANTS.BINARY_STORE)) {
          db.createObjectStore(ZK_CACHE_CONSTANTS.BINARY_STORE, {
            keyPath: 'key',
          });
        }

        if (!db.objectStoreNames.contains(ZK_CACHE_CONSTANTS.VKEY_STORE)) {
          db.createObjectStore(ZK_CACHE_CONSTANTS.VKEY_STORE, {
            keyPath: 'key',
          });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureInit(): Promise<IDBDatabase | null> {
    try {
      await this.init();
      return this.db;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Binary artifacts (wasm, zkey)
  // -------------------------------------------------------------------------

  /** Get a binary artifact from cache. Returns null on miss or error. Touches timestamp for LRU. */
  async getBinary(
    circuitId: string,
    type: ArtifactType,
    version: string
  ): Promise<ArrayBuffer | null> {
    try {
      const db = await this.ensureInit();
      if (!db) return null;

      const key = buildKey(circuitId, version, type);

      return new Promise((resolve) => {
        const tx = db.transaction(ZK_CACHE_CONSTANTS.BINARY_STORE, 'readwrite');
        const store = tx.objectStore(ZK_CACHE_CONSTANTS.BINARY_STORE);
        const request = store.get(key);

        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const entry = request.result as BinaryArtifactEntry | undefined;
          if (entry) {
            // Touch timestamp for LRU (fire-and-forget)
            entry.timestamp = Date.now();
            store.put(entry);
          }
          resolve(entry?.data ?? null);
        };
      });
    } catch {
      return null;
    }
  }

  /** Store a binary artifact in cache. Evicts oldest entries if cache exceeds MAX_CACHE_SIZE. Non-fatal on error. */
  async setBinary(
    circuitId: string,
    type: ArtifactType,
    version: string,
    data: ArrayBuffer
  ): Promise<void> {
    try {
      const db = await this.ensureInit();
      if (!db) return;

      // Evict oldest entries if adding this would exceed the size limit
      await this.evictIfNeeded(db, data.byteLength);

      const entry: BinaryArtifactEntry = {
        key: buildKey(circuitId, version, type),
        data,
        circuitId,
        type,
        version,
        size: data.byteLength,
        timestamp: Date.now(),
      };

      return new Promise((resolve) => {
        const tx = db.transaction(ZK_CACHE_CONSTANTS.BINARY_STORE, 'readwrite');
        const store = tx.objectStore(ZK_CACHE_CONSTANTS.BINARY_STORE);
        const request = store.put(entry);

        request.onerror = () => resolve();
        request.onsuccess = () => resolve();
      });
    } catch {
      // Non-fatal
    }
  }

  // -------------------------------------------------------------------------
  // Verification keys (JSON objects)
  // -------------------------------------------------------------------------

  /** Get a verification key from cache. Returns null on miss or error. */
  async getVkey(circuitId: string, version: string): Promise<object | null> {
    try {
      const db = await this.ensureInit();
      if (!db) return null;

      const key = buildKey(circuitId, version, 'vkey');

      return new Promise((resolve) => {
        const tx = db.transaction(ZK_CACHE_CONSTANTS.VKEY_STORE, 'readonly');
        const store = tx.objectStore(ZK_CACHE_CONSTANTS.VKEY_STORE);
        const request = store.get(key);

        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const entry = request.result as VkeyArtifactEntry | undefined;
          resolve(entry?.data ?? null);
        };
      });
    } catch {
      return null;
    }
  }

  /** Store a verification key in cache. Non-fatal on error. */
  async setVkey(
    circuitId: string,
    version: string,
    data: object
  ): Promise<void> {
    try {
      const db = await this.ensureInit();
      if (!db) return;

      const entry: VkeyArtifactEntry = {
        key: buildKey(circuitId, version, 'vkey'),
        data,
        circuitId,
        version,
        timestamp: Date.now(),
      };

      return new Promise((resolve) => {
        const tx = db.transaction(ZK_CACHE_CONSTANTS.VKEY_STORE, 'readwrite');
        const store = tx.objectStore(ZK_CACHE_CONSTANTS.VKEY_STORE);
        const request = store.put(entry);

        request.onerror = () => resolve();
        request.onsuccess = () => resolve();
      });
    } catch {
      // Non-fatal
    }
  }

  // -------------------------------------------------------------------------
  // Queries & maintenance
  // -------------------------------------------------------------------------

  /** Check if all artifacts for a circuit+version are cached. */
  async has(circuitId: string, version: string): Promise<boolean> {
    try {
      const [wasm, zkey, vkey] = await Promise.all([
        this.getBinary(circuitId, 'wasm', version),
        this.getBinary(circuitId, 'zkey', version),
        this.getVkey(circuitId, version),
      ]);
      return wasm !== null && zkey !== null && vkey !== null;
    } catch {
      return false;
    }
  }

  /** Invalidate all cached artifacts for a circuit (all versions). */
  async invalidateCircuit(circuitId: string): Promise<void> {
    try {
      const db = await this.ensureInit();
      if (!db) return;

      // Remove from binary store
      await this.removeByCircuit(db, ZK_CACHE_CONSTANTS.BINARY_STORE, circuitId);
      // Remove from vkey store
      await this.removeByCircuit(db, ZK_CACHE_CONSTANTS.VKEY_STORE, circuitId);
    } catch {
      // Non-fatal
    }
  }

  /** Get metadata for all binary entries (key, size, timestamp). */
  private getAllBinaryEntries(
    db: IDBDatabase
  ): Promise<Array<{ key: string; size: number; timestamp: number }>> {
    return new Promise((resolve) => {
      const entries: Array<{ key: string; size: number; timestamp: number }> = [];

      const tx = db.transaction(ZK_CACHE_CONSTANTS.BINARY_STORE, 'readonly');
      const store = tx.objectStore(ZK_CACHE_CONSTANTS.BINARY_STORE);
      const request = store.openCursor();

      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as BinaryArtifactEntry;
          entries.push({
            key: entry.key,
            size: entry.size,
            timestamp: entry.timestamp,
          });
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
    });
  }

  /** Evict oldest binary entries until totalSize + newEntrySize <= MAX_CACHE_SIZE. */
  private async evictIfNeeded(
    db: IDBDatabase,
    newEntrySize: number
  ): Promise<void> {
    const entries = await this.getAllBinaryEntries(db);
    let totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    if (totalSize + newEntrySize <= ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE) {
      return; // Fits without eviction
    }

    // Sort oldest-first (ascending timestamp)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    const keysToDelete: string[] = [];
    for (const entry of entries) {
      if (totalSize + newEntrySize <= ZK_CACHE_CONSTANTS.MAX_CACHE_SIZE) break;
      keysToDelete.push(entry.key);
      totalSize -= entry.size;
    }

    if (keysToDelete.length === 0) return;

    return new Promise((resolve) => {
      const tx = db.transaction(ZK_CACHE_CONSTANTS.BINARY_STORE, 'readwrite');
      const store = tx.objectStore(ZK_CACHE_CONSTANTS.BINARY_STORE);

      let completed = 0;
      for (const key of keysToDelete) {
        const req = store.delete(key);
        req.onsuccess = () => {
          completed++;
          if (completed === keysToDelete.length) resolve();
        };
        req.onerror = () => {
          completed++;
          if (completed === keysToDelete.length) resolve();
        };
      }
    });
  }

  private removeByCircuit(
    db: IDBDatabase,
    storeName: string,
    circuitId: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.openCursor();

      request.onerror = () => resolve();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as { circuitId: string };
          if (entry.circuitId === circuitId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /** Clear all cached artifacts. */
  async clear(): Promise<void> {
    try {
      const db = await this.ensureInit();
      if (!db) return;

      await Promise.all([
        this.clearStore(db, ZK_CACHE_CONSTANTS.BINARY_STORE),
        this.clearStore(db, ZK_CACHE_CONSTANTS.VKEY_STORE),
      ]);
    } catch {
      // Non-fatal
    }
  }

  private clearStore(db: IDBDatabase, storeName: string): Promise<void> {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  }

  /** Get cache statistics. */
  async getStats(): Promise<ArtifactCacheStats> {
    try {
      const db = await this.ensureInit();
      if (!db) return { binaryCount: 0, binarySize: 0, vkeyCount: 0 };

      const [binaryStats, vkeyCount] = await Promise.all([
        this.countBinaryStore(db),
        this.countStore(db, ZK_CACHE_CONSTANTS.VKEY_STORE),
      ]);

      return { ...binaryStats, vkeyCount };
    } catch {
      return { binaryCount: 0, binarySize: 0, vkeyCount: 0 };
    }
  }

  private countBinaryStore(
    db: IDBDatabase
  ): Promise<{ binaryCount: number; binarySize: number }> {
    return new Promise((resolve) => {
      let count = 0;
      let size = 0;

      const tx = db.transaction(ZK_CACHE_CONSTANTS.BINARY_STORE, 'readonly');
      const store = tx.objectStore(ZK_CACHE_CONSTANTS.BINARY_STORE);
      const request = store.openCursor();

      request.onerror = () => resolve({ binaryCount: 0, binarySize: 0 });
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as BinaryArtifactEntry;
          count++;
          size += entry.size;
          cursor.continue();
        } else {
          resolve({ binaryCount: count, binarySize: size });
        }
      };
    });
  }

  private countStore(db: IDBDatabase, storeName: string): Promise<number> {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onerror = () => resolve(0);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /** Close the database connection. */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: ArtifactCache | null = null;

/** Get the singleton ArtifactCache instance. */
export function getArtifactCache(): ArtifactCache {
  if (!instance) {
    instance = new ArtifactCache();
  }
  return instance;
}
