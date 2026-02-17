/**
 * Circuit Artifact Loader
 *
 * Loads compiled circuit artifacts (WASM, zkey, vkey) from the public/ directory
 * via fetch. Two-tier caching strategy:
 *   L1: in-memory Map (microsecond access, lost on tab close)
 *   L2: IndexedDB via ArtifactCache (ms access, persists across sessions)
 *   L3: network fetch from public/circuits/
 *
 * Next.js serves public/ statically, so browser fetches work directly.
 */

import type { ZKCircuit } from '@/types/zk';
import { getCircuitConfig } from './circuit-registry';
import { ArtifactLoadError } from './errors';
import { getArtifactCache } from './artifact-cache';

/** Progress callback for artifact downloads */
export interface ArtifactLoadProgress {
  phase: 'wasm' | 'zkey' | 'vkey';
  bytesLoaded: number;
  totalBytes: number | null;
}

/** Loaded artifacts ready for proof generation */
export interface LoadedArtifacts {
  wasm: ArrayBuffer;
  zkey: ArrayBuffer;
  vkey: object;
}

/**
 * Compute SHA-256 hash of an ArrayBuffer using the Web Crypto API.
 * Returns lowercase hex string.
 */
async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify integrity of a fetched artifact against an expected SHA-256 hash.
 * If expectedHash is undefined, the check is skipped (backward compatible).
 */
async function verifyIntegrity(
  data: ArrayBuffer,
  expectedHash: string | undefined,
  circuitId: string,
  artifactType: string
): Promise<void> {
  if (!expectedHash) return; // No hash configured — skip check
  const actualHash = await computeSHA256(data);
  if (actualHash !== expectedHash) {
    throw new ArtifactLoadError(
      circuitId,
      artifactType,
      `Integrity check failed: expected ${expectedHash.slice(0, 16)}…, got ${actualHash.slice(0, 16)}…`
    );
  }
}

/** In-memory artifact cache keyed by circuit ID (L1) */
const artifactCache = new Map<ZKCircuit, LoadedArtifacts>();

/**
 * Fetch a binary artifact with progress tracking.
 */
async function fetchArtifact(
  url: string,
  onProgress?: (loaded: number, total: number | null) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // If no progress callback or no body reader, use simple fetch
  if (!onProgress || !response.body) {
    return response.arrayBuffer();
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }

  // Combine chunks into single ArrayBuffer
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Load all artifacts for a circuit.
 *
 * Cache hierarchy: L1 (in-memory) → L2 (IndexedDB) → L3 (network fetch).
 * Progress callback receives updates for each artifact phase.
 *
 * @param circuitId - Circuit to load artifacts for
 * @param onProgress - Optional progress callback
 * @returns Loaded artifacts (WASM buffer, zkey buffer, vkey JSON)
 * @throws ArtifactLoadError if any artifact fails to load
 */
export async function loadCircuitArtifacts(
  circuitId: ZKCircuit,
  onProgress?: (progress: ArtifactLoadProgress) => void
): Promise<LoadedArtifacts> {
  // L1: Return in-memory cached if available
  const cached = artifactCache.get(circuitId);
  if (cached) return cached;

  const config = getCircuitConfig(circuitId);
  const persistentCache = getArtifactCache();

  // L2: Try IndexedDB persistent cache
  try {
    const [cachedWasm, cachedZkey, cachedVkey] = await Promise.all([
      persistentCache.getBinary(circuitId, 'wasm', config.version),
      persistentCache.getBinary(circuitId, 'zkey', config.version),
      persistentCache.getVkey(circuitId, config.version),
    ]);

    if (cachedWasm && cachedZkey && cachedVkey) {
      const artifacts: LoadedArtifacts = {
        wasm: cachedWasm,
        zkey: cachedZkey,
        vkey: cachedVkey,
      };
      // Promote to L1
      artifactCache.set(circuitId, artifacts);
      return artifacts;
    }
  } catch {
    // Non-fatal: fall through to network fetch
  }

  // L3: Network fetch
  try {
    // Load WASM
    const wasm = await fetchArtifact(config.wasmPath, (loaded, total) => {
      onProgress?.({ phase: 'wasm', bytesLoaded: loaded, totalBytes: total });
    });
    await verifyIntegrity(wasm, config.wasmHash, circuitId, 'wasm');

    // Load zkey
    const zkey = await fetchArtifact(config.zkeyPath, (loaded, total) => {
      onProgress?.({ phase: 'zkey', bytesLoaded: loaded, totalBytes: total });
    });
    await verifyIntegrity(zkey, config.zkeyHash, circuitId, 'zkey');

    // Load verification key — fetch as text first for hash integrity, then parse
    const vkeyResponse = await fetch(config.vkeyPath);
    if (!vkeyResponse.ok) {
      throw new Error(`HTTP ${vkeyResponse.status}: ${vkeyResponse.statusText}`);
    }
    const vkeyText = await vkeyResponse.text();
    const vkeyBytes = new TextEncoder().encode(vkeyText);
    await verifyIntegrity(vkeyBytes.buffer, config.vkeyHash, circuitId, 'vkey');
    const vkey = JSON.parse(vkeyText);
    onProgress?.({ phase: 'vkey', bytesLoaded: vkeyBytes.byteLength, totalBytes: null });

    const artifacts: LoadedArtifacts = { wasm, zkey, vkey };

    // Store in L1
    artifactCache.set(circuitId, artifacts);

    // Persist to L2 (fire-and-forget, non-blocking)
    persistentCache.setBinary(circuitId, 'wasm', config.version, wasm).catch(() => {});
    persistentCache.setBinary(circuitId, 'zkey', config.version, zkey).catch(() => {});
    persistentCache.setVkey(circuitId, config.version, vkey).catch(() => {});

    return artifacts;
  } catch (error) {
    throw new ArtifactLoadError(
      circuitId,
      'artifacts',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Clear cached artifacts for a specific circuit or all circuits.
 * Clears both L1 (in-memory) cache only.
 */
export function clearArtifactCache(circuitId?: ZKCircuit): void {
  if (circuitId) {
    artifactCache.delete(circuitId);
  } else {
    artifactCache.clear();
  }
}

/**
 * Clear the persistent IndexedDB artifact cache.
 * Also clears the in-memory L1 cache.
 */
export async function clearPersistentArtifactCache(): Promise<void> {
  artifactCache.clear();
  await getArtifactCache().clear();
}

/**
 * Check if artifacts are cached for a circuit (L1 only).
 */
export function isArtifactCached(circuitId: ZKCircuit): boolean {
  return artifactCache.has(circuitId);
}
