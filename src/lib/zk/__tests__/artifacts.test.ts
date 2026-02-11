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
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    headers: new Headers({ 'content-type': contentType }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    json: () => Promise.resolve(data),
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
});
