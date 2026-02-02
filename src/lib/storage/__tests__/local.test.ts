import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalCache, CacheError, CacheErrorCode, getLocalCache } from '../local';

// Mock IndexedDB
const mockObjectStore = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  count: vi.fn(),
  openCursor: vi.fn(),
  createIndex: vi.fn(),
  index: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
};

const mockDb = {
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => mockObjectStore),
  close: vi.fn(),
};

const mockRequest = {
  result: mockDb,
  error: null as Error | null,
  onerror: null as ((event: Event) => void) | null,
  onsuccess: null as ((event: Event) => void) | null,
  onupgradeneeded: null as ((event: Event) => void) | null,
};

describe('storage/local', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock IndexedDB
    Object.defineProperty(global, 'indexedDB', {
      value: {
        open: vi.fn(() => {
          // Simulate async behavior
          setTimeout(() => {
            if (mockRequest.onupgradeneeded) {
              mockRequest.onupgradeneeded({ target: mockRequest } as unknown as Event);
            }
            if (mockRequest.onsuccess) {
              mockRequest.onsuccess({} as Event);
            }
          }, 0);
          return mockRequest;
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LocalCache', () => {
    describe('init', () => {
      it('should initialize IndexedDB connection', async () => {
        const cache = new LocalCache();
        await cache.init();

        expect(indexedDB.open).toHaveBeenCalledWith('shade-studio', 1);
      });

      it('should reuse existing initialization', async () => {
        const cache = new LocalCache();
        await cache.init();
        await cache.init();

        // Should only open once
        expect(indexedDB.open).toHaveBeenCalledTimes(1);
      });

      it('should throw CacheError when IndexedDB is not available', async () => {
        // Remove IndexedDB by setting window to undefined scenario
        const originalWindow = global.window;
        Object.defineProperty(global, 'window', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const cache = new LocalCache();

        try {
          await cache.init();
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CacheError);
          expect((error as CacheError).code).toBe(CacheErrorCode.NOT_AVAILABLE);
        }

        // Restore
        Object.defineProperty(global, 'window', {
          value: originalWindow,
          writable: true,
          configurable: true,
        });
      });
    });

    describe('set', () => {
      it('should store content in cache', async () => {
        const cache = new LocalCache();

        // Mock successful put
        mockObjectStore.put.mockImplementation(() => {
          const req = {
            result: undefined,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        const data = new ArrayBuffer(10);
        await cache.set('test-cid', data);

        expect(mockObjectStore.put).toHaveBeenCalled();
        const putCall = mockObjectStore.put.mock.calls[0];
        expect(putCall).toBeDefined();
        const putArg = putCall![0] as { cid: string; data: ArrayBuffer; size: number; timestamp: number };
        expect(putArg.cid).toBe('test-cid');
        expect(putArg.data).toBe(data);
        expect(putArg.size).toBe(10);
        expect(typeof putArg.timestamp).toBe('number');
      });
    });

    describe('get', () => {
      it('should retrieve content from cache', async () => {
        const cache = new LocalCache();
        const data = new ArrayBuffer(10);

        // Mock successful get
        mockObjectStore.get.mockImplementation(() => {
          const req = {
            result: { cid: 'test-cid', data, timestamp: Date.now(), size: 10 },
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        const result = await cache.get('test-cid');

        expect(result).toBe(data);
      });

      it('should return null when content not found', async () => {
        const cache = new LocalCache();

        // Mock get returning undefined
        mockObjectStore.get.mockImplementation(() => {
          const req = {
            result: undefined,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        const result = await cache.get('nonexistent-cid');

        expect(result).toBeNull();
      });
    });

    describe('has', () => {
      it('should return true when content exists', async () => {
        const cache = new LocalCache();

        mockObjectStore.count.mockImplementation(() => {
          const req = {
            result: 1,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        const exists = await cache.has('test-cid');

        expect(exists).toBe(true);
      });

      it('should return false when content does not exist', async () => {
        const cache = new LocalCache();

        mockObjectStore.count.mockImplementation(() => {
          const req = {
            result: 0,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        const exists = await cache.has('nonexistent-cid');

        expect(exists).toBe(false);
      });
    });

    describe('delete', () => {
      it('should remove content from cache', async () => {
        const cache = new LocalCache();

        mockObjectStore.delete.mockImplementation(() => {
          const req = {
            result: undefined,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        await cache.delete('test-cid');

        expect(mockObjectStore.delete).toHaveBeenCalledWith('test-cid');
      });
    });

    describe('clear', () => {
      it('should clear all cached content', async () => {
        const cache = new LocalCache();

        mockObjectStore.clear.mockImplementation(() => {
          const req = {
            result: undefined,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };
          setTimeout(() => req.onsuccess?.({} as Event), 0);
          return req;
        });

        await cache.clear();

        expect(mockObjectStore.clear).toHaveBeenCalled();
      });
    });

    describe('getStats', () => {
      it('should return cache statistics', async () => {
        const cache = new LocalCache();

        // Mock cursor iteration - simplified approach
        const entries = [
          { cid: 'cid1', size: 100 },
          { cid: 'cid2', size: 200 },
        ];
        let entryIndex = 0;

        mockObjectStore.openCursor.mockImplementation(() => {
          const req = {
            result: null as unknown,
            error: null,
            onerror: null as ((event: Event) => void) | null,
            onsuccess: null as ((event: Event) => void) | null,
          };

          // Use Promise.resolve() for microtask timing instead of setTimeout
          Promise.resolve().then(() => {
            if (entryIndex < entries.length) {
              req.result = {
                value: entries[entryIndex],
                continue: () => {
                  entryIndex++;
                  Promise.resolve().then(() => {
                    if (entryIndex < entries.length) {
                      req.result = {
                        value: entries[entryIndex],
                        continue: () => {
                          entryIndex++;
                          Promise.resolve().then(() => {
                            req.result = null;
                            req.onsuccess?.({} as Event);
                          });
                        },
                      };
                    } else {
                      req.result = null;
                    }
                    req.onsuccess?.({} as Event);
                  });
                },
              };
            } else {
              req.result = null;
            }
            req.onsuccess?.({} as Event);
          });

          return req;
        });

        const stats = await cache.getStats();

        expect(stats.count).toBe(2);
        expect(stats.totalSize).toBe(300);
      });
    });

    describe('close', () => {
      it('should close the database connection', async () => {
        const cache = new LocalCache();
        await cache.init();

        cache.close();

        expect(mockDb.close).toHaveBeenCalled();
      });
    });
  });

  describe('getLocalCache', () => {
    it('should return singleton instance', () => {
      const cache1 = getLocalCache();
      const cache2 = getLocalCache();

      expect(cache1).toBe(cache2);
    });
  });
});
