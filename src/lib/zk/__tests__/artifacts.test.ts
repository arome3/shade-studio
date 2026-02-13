import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadCircuitArtifacts,
  clearArtifactCache,
  isArtifactCached,
} from '../artifacts';

// Mock fetch for artifact loading tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createMockResponse(data: unknown, ok = true, contentType = 'application/octet-stream') {
  const jsonText = JSON.stringify(data);
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    headers: new Headers({ 'content-type': contentType }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(jsonText),
    body: null, // No streaming in tests
  };
}

describe('Artifact Loading', () => {
  beforeEach(() => {
    clearArtifactCache();
    mockFetch.mockReset();
  });

  describe('loadCircuitArtifacts', () => {
    it('loads all 3 artifact types for a circuit', async () => {
      const mockVkey = { protocol: 'groth16', curve: 'bn128' };

      // WASM fetch, zkey fetch, vkey fetch
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null)) // wasm
        .mockResolvedValueOnce(createMockResponse(null)) // zkey
        .mockResolvedValueOnce(createMockResponse(mockVkey, true, 'application/json')); // vkey

      const artifacts = await loadCircuitArtifacts('verified-builder');

      expect(artifacts.wasm).toBeInstanceOf(ArrayBuffer);
      expect(artifacts.zkey).toBeInstanceOf(ArrayBuffer);
      expect(artifacts.vkey).toEqual(mockVkey);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('returns cached artifacts on second call', async () => {
      const mockVkey = { protocol: 'groth16' };
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(mockVkey, true, 'application/json'));

      await loadCircuitArtifacts('verified-builder');
      const second = await loadCircuitArtifacts('verified-builder');

      expect(second.vkey).toEqual(mockVkey);
      // Should NOT have fetched again
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws ArtifactLoadError on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, false));

      await expect(
        loadCircuitArtifacts('verified-builder')
      ).rejects.toThrow('Failed to load');
    });
  });

  describe('clearArtifactCache', () => {
    it('clears specific circuit cache', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse({}, true, 'application/json'));

      await loadCircuitArtifacts('verified-builder');
      expect(isArtifactCached('verified-builder')).toBe(true);

      clearArtifactCache('verified-builder');
      expect(isArtifactCached('verified-builder')).toBe(false);
    });

    it('clears all caches when called without argument', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse({}, true, 'application/json'));

      await loadCircuitArtifacts('verified-builder');
      clearArtifactCache();
      expect(isArtifactCached('verified-builder')).toBe(false);
    });
  });

  describe('isArtifactCached', () => {
    it('returns false for uncached circuits', () => {
      expect(isArtifactCached('grant-track-record')).toBe(false);
    });
  });

  describe('SHA256 integrity checks', () => {
    // Helper to compute SHA-256 of an ArrayBuffer for test setup
    async function sha256hex(buffer: ArrayBuffer): Promise<string> {
      const hash = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    it('loads successfully when hashes match', async () => {
      const wasmBuf = new ArrayBuffer(8);
      new Uint8Array(wasmBuf).fill(0x01);
      const zkeyBuf = new ArrayBuffer(8);
      new Uint8Array(zkeyBuf).fill(0x02);
      const vkeyObj = { protocol: 'groth16', curve: 'bn128' };
      const vkeyText = JSON.stringify(vkeyObj);
      const vkeyBytes = new TextEncoder().encode(vkeyText);

      // Precompute correct hashes
      const wasmHash = await sha256hex(wasmBuf);
      const zkeyHash = await sha256hex(zkeyBuf);
      const vkeyHash = await sha256hex(vkeyBytes.buffer);

      // Mock the circuit registry to return hashes
      const registry = await import('../circuit-registry');
      const originalGetConfig = registry.getCircuitConfig;
      const config = originalGetConfig('verified-builder');
      vi.spyOn(registry, 'getCircuitConfig').mockReturnValue({
        ...config,
        wasmHash,
        zkeyHash,
        vkeyHash,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true, status: 200, statusText: 'OK',
          headers: new Headers({}),
          arrayBuffer: () => Promise.resolve(wasmBuf),
          body: null,
        })
        .mockResolvedValueOnce({
          ok: true, status: 200, statusText: 'OK',
          headers: new Headers({}),
          arrayBuffer: () => Promise.resolve(zkeyBuf),
          body: null,
        })
        .mockResolvedValueOnce({
          ok: true, status: 200, statusText: 'OK',
          headers: new Headers({}),
          text: () => Promise.resolve(vkeyText),
          body: null,
        });

      const artifacts = await loadCircuitArtifacts('verified-builder');
      expect(artifacts.wasm).toBeInstanceOf(ArrayBuffer);
      expect(artifacts.vkey).toEqual(vkeyObj);

      vi.restoreAllMocks();
    });

    it('throws ArtifactLoadError on hash mismatch', async () => {
      const wasmBuf = new ArrayBuffer(8);
      new Uint8Array(wasmBuf).fill(0x01);

      // Mock the circuit registry with a wrong hash
      const registry = await import('../circuit-registry');
      const config = registry.getCircuitConfig('verified-builder');
      vi.spyOn(registry, 'getCircuitConfig').mockReturnValue({
        ...config,
        wasmHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        headers: new Headers({}),
        arrayBuffer: () => Promise.resolve(wasmBuf),
        body: null,
      });

      await expect(
        loadCircuitArtifacts('verified-builder')
      ).rejects.toThrow('Integrity check failed');

      vi.restoreAllMocks();
    });

    it('skips check when no hash configured', async () => {
      const mockVkey = { protocol: 'groth16' };

      // Default config has undefined hashes — check should be skipped
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(null))
        .mockResolvedValueOnce(createMockResponse(mockVkey, true, 'application/json'));

      // Should succeed without integrity errors
      const artifacts = await loadCircuitArtifacts('verified-builder');
      expect(artifacts.vkey).toEqual(mockVkey);
    });
  });
});
