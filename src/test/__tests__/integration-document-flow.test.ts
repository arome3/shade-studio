/**
 * Integration Test: Document Encrypt → Upload → Download → Decrypt Pipeline
 *
 * Tests the full lifecycle of encrypted document storage through IPFS,
 * using MSW to intercept network calls at the HTTP boundary.
 *
 * Note: Uses raw fetch() for IPFS calls instead of IPFSClient because
 * jsdom's AbortSignal class is incompatible with MSW's fetch interceptor.
 * The IPFSClient internally creates AbortControllers for timeouts.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server, resetIPFSStore, deriveTestKeys } from '@/test';
import { encryptJson, decryptJson, encryptData, decryptData } from '@/lib/crypto/encryption';
import { createTestKey } from '@/test';
import { http, HttpResponse } from 'msw';
import type { IPFSUploadResult } from '@/lib/storage/ipfs';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetIPFSStore();
});
afterAll(() => server.close());

/**
 * Helper: Upload to IPFS via raw fetch with JSON body.
 * Uses JSON instead of FormData to avoid jsdom FormData serialization issues.
 */
async function uploadToIPFS(data: string | Blob): Promise<IPFSUploadResult> {
  const body = typeof data === 'string' ? data : await data.text();

  const response = await fetch('/api/ipfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}

/**
 * Helper: Download from IPFS via raw fetch.
 */
async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  const response = await fetch(`/api/ipfs?cid=${encodeURIComponent(cid)}`);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return response.arrayBuffer();
}

describe('Document Flow: encrypt → upload → download → decrypt', () => {
  let secretKey: Uint8Array;

  beforeEach(() => {
    const keys = deriveTestKeys('alice.near');
    secretKey = keys.secretKey;
  });

  it('should round-trip a JSON document through IPFS', async () => {
    const originalDoc = {
      title: 'My Grant Proposal',
      body: '# Overview\n\nThis project aims to build privacy tools for NEAR.',
      tags: ['defi', 'privacy'],
    };

    // 1. Encrypt
    const encrypted = encryptJson(originalDoc, secretKey);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toBeTruthy();
    expect(encrypted.version).toBe(1);

    // 2. Upload to IPFS (intercepted by MSW)
    const payload = JSON.stringify(encrypted);
    const uploadResult = await uploadToIPFS(payload);

    expect(uploadResult.cid).toBeTruthy();
    expect(uploadResult.size).toBeGreaterThan(0);
    expect(uploadResult.timestamp).toBeTruthy();

    // 3. Download from IPFS (intercepted by MSW)
    const downloaded = await downloadFromIPFS(uploadResult.cid);
    expect(downloaded).toBeInstanceOf(ArrayBuffer);

    // 4. Decrypt
    const downloadedPayload = JSON.parse(
      new TextDecoder().decode(downloaded)
    );
    const decrypted = decryptJson<typeof originalDoc>(downloadedPayload, secretKey);

    expect(decrypted).toEqual(originalDoc);
  });

  it('should round-trip binary data through IPFS', async () => {
    const originalData = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4]);

    // Encrypt
    const encrypted = encryptData(originalData, secretKey);

    // Upload
    const { cid } = await uploadToIPFS(JSON.stringify(encrypted));

    // Download
    const downloaded = await downloadFromIPFS(cid);
    const downloadedPayload = JSON.parse(new TextDecoder().decode(downloaded));

    // Decrypt
    const decrypted = decryptData(downloadedPayload, secretKey);
    expect(decrypted).toEqual(originalData);
  });

  it('should fail to decrypt with the wrong key', () => {
    const doc = { secret: 'classified data' };
    const encrypted = encryptJson(doc, secretKey);

    const wrongKey = createTestKey();

    expect(() => {
      decryptJson(encrypted, wrongKey);
    }).toThrow();
  });

  it('should handle upload failure gracefully', async () => {
    server.use(
      http.post('/api/ipfs', () => {
        return HttpResponse.json(
          { error: 'Storage service unavailable' },
          { status: 500 }
        );
      })
    );

    await expect(uploadToIPFS('test data')).rejects.toThrow();
  });

  it('should handle download of non-existent CID', async () => {
    await expect(downloadFromIPFS('QmNonExistent')).rejects.toThrow();
  });

  it('should derive same keys for same account (deterministic)', () => {
    const keys1 = deriveTestKeys('alice.near');
    const keys2 = deriveTestKeys('alice.near');

    expect(keys1.keyId).toBe(keys2.keyId);
    expect(keys1.secretKey).toEqual(keys2.secretKey);
  });

  it('should derive different keys for different accounts', () => {
    const keys1 = deriveTestKeys('alice.near');
    const keys2 = deriveTestKeys('bob.near');

    expect(keys1.keyId).not.toBe(keys2.keyId);
  });
});
