/**
 * Storage Module
 *
 * Provides IPFS storage via Pinata and local caching via IndexedDB.
 *
 * @example
 * import { uploadToIPFS, downloadFromIPFS, getLocalCache } from '@/lib/storage';
 *
 * // Upload encrypted content
 * const { cid } = await uploadToIPFS(encryptedBlob, 'document.enc');
 *
 * // Download and cache
 * const cache = getLocalCache();
 * let data = await cache.get(cid);
 * if (!data) {
 *   data = await downloadFromIPFS(cid);
 *   await cache.set(cid, data);
 * }
 */

// IPFS Client
export {
  IPFSClient,
  IPFSError,
  IPFSErrorCode,
  type IPFSUploadResult,
  type IPFSClientConfig,
  type IPFSErrorCodeType,
  getIPFSClient,
  uploadToIPFS,
  downloadFromIPFS,
  getIPFSUrl,
  isValidCid,
} from './ipfs';

// Local Cache
export {
  LocalCache,
  CacheError,
  CacheErrorCode,
  type CacheEntry,
  type CacheMetadata,
  type CacheStats,
  type CacheErrorCodeType,
  getLocalCache,
} from './local';
