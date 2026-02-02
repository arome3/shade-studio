/**
 * IPFS Client Library for Shade Studio
 *
 * Provides client-side interface for IPFS operations via the server-side proxy.
 * All uploads/downloads go through /api/ipfs to keep Pinata credentials server-side.
 */

import { API_ROUTES, IPFS_CONSTANTS } from '@/lib/constants';

/**
 * Result from an IPFS upload operation.
 */
export interface IPFSUploadResult {
  /** IPFS content identifier (CID) */
  cid: string;
  /** Size of the uploaded content in bytes */
  size: number;
  /** ISO 8601 timestamp of the upload */
  timestamp: string;
}

/**
 * Configuration options for the IPFS client.
 */
export interface IPFSClientConfig {
  /** API endpoint for IPFS operations (default: /api/ipfs) */
  apiEndpoint: string;
  /** IPFS gateway URL for direct content access */
  gatewayUrl: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout: number;
}

/**
 * Error thrown for IPFS-related failures.
 */
export class IPFSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'IPFSError';
  }
}

/**
 * IPFS error codes.
 */
export const IPFSErrorCode = {
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  INVALID_CID: 'INVALID_CID',
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
} as const;

export type IPFSErrorCodeType = (typeof IPFSErrorCode)[keyof typeof IPFSErrorCode];

/**
 * Validate a CID format.
 */
export function isValidCid(cid: string): boolean {
  return IPFS_CONSTANTS.CID_REGEX.test(cid);
}

/**
 * IPFS Client class for interacting with IPFS via the server proxy.
 */
export class IPFSClient {
  private config: IPFSClientConfig;

  constructor(config?: Partial<IPFSClientConfig>) {
    this.config = {
      apiEndpoint: config?.apiEndpoint ?? API_ROUTES.IPFS,
      gatewayUrl: config?.gatewayUrl ?? process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs',
      timeout: config?.timeout ?? IPFS_CONSTANTS.REQUEST_TIMEOUT,
    };
  }

  /**
   * Create an AbortController with timeout.
   */
  private createTimeoutController(): { controller: AbortController; timeoutId: NodeJS.Timeout } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    return { controller, timeoutId };
  }

  /**
   * Upload data to IPFS.
   *
   * @param data - File, Blob, or ArrayBuffer to upload
   * @param name - Optional name for the uploaded content
   * @returns Upload result with CID, size, and timestamp
   *
   * @example
   * const client = new IPFSClient();
   * const file = new File(['Hello'], 'hello.txt');
   * const { cid } = await client.upload(file);
   */
  async upload(data: File | Blob | ArrayBuffer, name?: string): Promise<IPFSUploadResult> {
    const { controller, timeoutId } = this.createTimeoutController();

    try {
      // Convert ArrayBuffer to Blob if needed
      const blob = data instanceof ArrayBuffer ? new Blob([data]) : data;

      // Prepare form data
      const formData = new FormData();
      formData.append('file', blob);
      if (name) {
        formData.append('name', name);
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));

        if (response.status === 503) {
          throw new IPFSError(
            error.error || 'IPFS storage not configured',
            IPFSErrorCode.NOT_CONFIGURED
          );
        }

        throw new IPFSError(
          error.error || 'Failed to upload to IPFS',
          IPFSErrorCode.UPLOAD_FAILED
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof IPFSError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new IPFSError('Upload request timed out', IPFSErrorCode.TIMEOUT, error);
      }

      throw new IPFSError(
        'Network error during upload',
        IPFSErrorCode.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Download content from IPFS as ArrayBuffer.
   *
   * @param cid - IPFS content identifier
   * @returns Downloaded content as ArrayBuffer
   *
   * @example
   * const client = new IPFSClient();
   * const data = await client.download('Qm...');
   * const text = new TextDecoder().decode(data);
   */
  async download(cid: string): Promise<ArrayBuffer> {
    if (!isValidCid(cid)) {
      throw new IPFSError('Invalid CID format', IPFSErrorCode.INVALID_CID);
    }

    const { controller, timeoutId } = this.createTimeoutController();

    try {
      const response = await fetch(`${this.config.apiEndpoint}?cid=${encodeURIComponent(cid)}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new IPFSError('Content not found on IPFS', IPFSErrorCode.NOT_FOUND);
        }

        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new IPFSError(
          error.error || 'Failed to download from IPFS',
          IPFSErrorCode.DOWNLOAD_FAILED
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof IPFSError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new IPFSError('Download request timed out', IPFSErrorCode.TIMEOUT, error);
      }

      throw new IPFSError(
        'Network error during download',
        IPFSErrorCode.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Download content from IPFS as a Blob.
   *
   * @param cid - IPFS content identifier
   * @param type - Optional MIME type for the Blob
   * @returns Downloaded content as Blob
   */
  async downloadBlob(cid: string, type?: string): Promise<Blob> {
    const data = await this.download(cid);
    return new Blob([data], { type });
  }

  /**
   * Get the direct gateway URL for a CID.
   * Use this when you need a direct link to IPFS content.
   *
   * @param cid - IPFS content identifier
   * @returns Gateway URL for the content
   *
   * @example
   * const url = client.getGatewayUrl('Qm...');
   * // 'https://gateway.pinata.cloud/ipfs/Qm...'
   */
  getGatewayUrl(cid: string): string {
    if (!isValidCid(cid)) {
      throw new IPFSError('Invalid CID format', IPFSErrorCode.INVALID_CID);
    }
    return `${this.config.gatewayUrl}/${cid}`;
  }

  /**
   * Delete (unpin) content from IPFS.
   *
   * Note: This only unpins the content from Pinata. The content may still
   * be available on IPFS if pinned elsewhere or cached by nodes.
   *
   * @param cid - IPFS content identifier to unpin
   *
   * @example
   * await client.delete('Qm...');
   */
  async delete(cid: string): Promise<void> {
    if (!isValidCid(cid)) {
      throw new IPFSError('Invalid CID format', IPFSErrorCode.INVALID_CID);
    }

    const { controller, timeoutId } = this.createTimeoutController();

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}?cid=${encodeURIComponent(cid)}`,
        {
          method: 'DELETE',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));

        if (response.status === 503) {
          throw new IPFSError(
            error.error || 'IPFS storage not configured',
            IPFSErrorCode.NOT_CONFIGURED
          );
        }

        throw new IPFSError(
          error.error || 'Failed to delete from IPFS',
          IPFSErrorCode.DELETE_FAILED
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof IPFSError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new IPFSError('Delete request timed out', IPFSErrorCode.TIMEOUT, error);
      }

      throw new IPFSError(
        'Network error during delete',
        IPFSErrorCode.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Check if content exists on IPFS.
   *
   * @param cid - IPFS content identifier
   * @returns true if content exists, false otherwise
   */
  async exists(cid: string): Promise<boolean> {
    if (!isValidCid(cid)) {
      return false;
    }

    try {
      // Use HEAD request to check existence without downloading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for existence check

      const response = await fetch(`${this.config.apiEndpoint}?cid=${encodeURIComponent(cid)}`, {
        method: 'GET', // Note: Using GET as our proxy doesn't support HEAD
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let defaultClient: IPFSClient | null = null;

/**
 * Get the default IPFS client instance.
 */
export function getIPFSClient(): IPFSClient {
  if (!defaultClient) {
    defaultClient = new IPFSClient();
  }
  return defaultClient;
}

/**
 * Quick helper to upload data to IPFS.
 *
 * @param data - Data to upload
 * @param name - Optional name for the content
 * @returns Upload result
 *
 * @example
 * const { cid } = await uploadToIPFS(myFile, 'document.pdf');
 */
export async function uploadToIPFS(
  data: File | Blob | ArrayBuffer,
  name?: string
): Promise<IPFSUploadResult> {
  return getIPFSClient().upload(data, name);
}

/**
 * Quick helper to download data from IPFS.
 *
 * @param cid - Content identifier
 * @returns Downloaded content as ArrayBuffer
 *
 * @example
 * const data = await downloadFromIPFS('Qm...');
 */
export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  return getIPFSClient().download(cid);
}

/**
 * Quick helper to get gateway URL for a CID.
 *
 * @param cid - Content identifier
 * @returns Gateway URL
 *
 * @example
 * const url = getIPFSUrl('Qm...');
 */
export function getIPFSUrl(cid: string): string {
  return getIPFSClient().getGatewayUrl(cid);
}
