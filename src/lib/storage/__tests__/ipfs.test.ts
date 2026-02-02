import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  IPFSClient,
  IPFSError,
  IPFSErrorCode,
  isValidCid,
} from '../ipfs';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('storage/ipfs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidCid', () => {
    it('should return true for valid CIDv0 (Qm...)', () => {
      // Valid CIDv0 format: Qm followed by 44 base58 characters
      const validCidV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      expect(isValidCid(validCidV0)).toBe(true);
    });

    it('should return true for valid CIDv1 (bafy...)', () => {
      // Valid CIDv1 format: bafy followed by 55+ alphanumeric characters
      const validCidV1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      expect(isValidCid(validCidV1)).toBe(true);
    });

    it('should return false for invalid CIDs', () => {
      expect(isValidCid('')).toBe(false);
      expect(isValidCid('invalid')).toBe(false);
      expect(isValidCid('Qm')).toBe(false); // Too short
      expect(isValidCid('bafy')).toBe(false); // Too short
      expect(isValidCid('Qm' + 'a'.repeat(10))).toBe(false); // Wrong length
      expect(isValidCid('../../../etc/passwd')).toBe(false); // Path traversal attempt
    });
  });

  describe('IPFSClient', () => {
    let client: IPFSClient;

    beforeEach(() => {
      client = new IPFSClient({
        apiEndpoint: '/api/ipfs',
        gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
        timeout: 5000,
      });
    });

    describe('upload', () => {
      it('should upload file and return CID', async () => {
        const mockResponse = {
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          size: 1024,
          timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const file = new Blob(['test content'], { type: 'text/plain' });
        const result = await client.upload(file, 'test.txt');

        expect(result.cid).toBe(mockResponse.cid);
        expect(result.size).toBe(mockResponse.size);
        expect(result.timestamp).toBe(mockResponse.timestamp);

        // Verify fetch was called correctly
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/ipfs');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
      });

      it('should upload ArrayBuffer', async () => {
        const mockResponse = {
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          size: 5,
          timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const buffer = new ArrayBuffer(5);
        const result = await client.upload(buffer);

        expect(result.cid).toBe(mockResponse.cid);
      });

      it('should throw IPFSError on upload failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        });

        const file = new Blob(['test']);

        try {
          await client.upload(file);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.UPLOAD_FAILED);
        }
      });

      it('should throw NOT_CONFIGURED error when storage not configured', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'IPFS storage not configured' }),
        });

        const file = new Blob(['test']);

        try {
          await client.upload(file);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.NOT_CONFIGURED);
        }
      });

      it('should throw TIMEOUT error on request timeout', async () => {
        // Mock AbortError
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValueOnce(abortError);

        const file = new Blob(['test']);

        try {
          await client.upload(file);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.TIMEOUT);
        }
      });

      it('should throw NETWORK_ERROR on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failed'));

        const file = new Blob(['test']);

        try {
          await client.upload(file);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.NETWORK_ERROR);
        }
      });
    });

    describe('download', () => {
      it('should download content as ArrayBuffer', async () => {
        const content = new Uint8Array([1, 2, 3, 4, 5]);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(content.buffer),
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const result = await client.download(cid);

        expect(new Uint8Array(result)).toEqual(content);
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/ipfs?cid=${encodeURIComponent(cid)}`,
          expect.objectContaining({ method: 'GET' })
        );
      });

      it('should throw INVALID_CID for invalid CID format', async () => {
        await expect(client.download('invalid-cid')).rejects.toThrow(IPFSError);
        await expect(client.download('invalid-cid')).rejects.toMatchObject({
          code: IPFSErrorCode.INVALID_CID,
        });

        // Should not make any network requests
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should throw NOT_FOUND when content does not exist', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

        try {
          await client.download(cid);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.NOT_FOUND);
        }
      });

      it('should throw DOWNLOAD_FAILED on server error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

        try {
          await client.download(cid);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.DOWNLOAD_FAILED);
        }
      });
    });

    describe('downloadBlob', () => {
      it('should download content as Blob with correct type', async () => {
        const content = new Uint8Array([1, 2, 3, 4, 5]);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(content.buffer),
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const blob = await client.downloadBlob(cid, 'application/octet-stream');

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/octet-stream');
        expect(blob.size).toBe(content.length);
      });
    });

    describe('getGatewayUrl', () => {
      it('should return correct gateway URL', () => {
        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const url = client.getGatewayUrl(cid);

        expect(url).toBe(`https://gateway.pinata.cloud/ipfs/${cid}`);
      });

      it('should throw INVALID_CID for invalid CID', () => {
        expect(() => client.getGatewayUrl('invalid')).toThrow(IPFSError);
        expect(() => client.getGatewayUrl('invalid')).toThrow(
          expect.objectContaining({ code: IPFSErrorCode.INVALID_CID })
        );
      });
    });

    describe('delete', () => {
      it('should delete (unpin) content successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        await expect(client.delete(cid)).resolves.toBeUndefined();

        expect(mockFetch).toHaveBeenCalledWith(
          `/api/ipfs?cid=${encodeURIComponent(cid)}`,
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('should throw INVALID_CID for invalid CID', async () => {
        await expect(client.delete('invalid')).rejects.toThrow(IPFSError);
        await expect(client.delete('invalid')).rejects.toMatchObject({
          code: IPFSErrorCode.INVALID_CID,
        });
      });

      it('should throw DELETE_FAILED on server error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Delete failed' }),
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

        try {
          await client.delete(cid);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(IPFSError);
          expect((error as IPFSError).code).toBe(IPFSErrorCode.DELETE_FAILED);
        }
      });
    });

    describe('exists', () => {
      it('should return true when content exists', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const exists = await client.exists(cid);

        expect(exists).toBe(true);
      });

      it('should return false when content does not exist', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const exists = await client.exists(cid);

        expect(exists).toBe(false);
      });

      it('should return false for invalid CID', async () => {
        const exists = await client.exists('invalid-cid');
        expect(exists).toBe(false);
      });

      it('should return false on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failed'));

        const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
        const exists = await client.exists(cid);

        expect(exists).toBe(false);
      });
    });
  });

  describe('helper functions', () => {
    it('should export uploadToIPFS helper', async () => {
      // Import the helper function
      const { uploadToIPFS } = await import('../ipfs');
      expect(typeof uploadToIPFS).toBe('function');
    });

    it('should export downloadFromIPFS helper', async () => {
      const { downloadFromIPFS } = await import('../ipfs');
      expect(typeof downloadFromIPFS).toBe('function');
    });

    it('should export getIPFSUrl helper', async () => {
      const { getIPFSUrl } = await import('../ipfs');
      expect(typeof getIPFSUrl).toBe('function');
    });

    it('should export getIPFSClient singleton', async () => {
      const { getIPFSClient } = await import('../ipfs');
      const client1 = getIPFSClient();
      const client2 = getIPFSClient();
      expect(client1).toBe(client2); // Same instance
    });
  });
});
