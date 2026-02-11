/**
 * Circuit Artifact Loader
 *
 * Loads compiled circuit artifacts (WASM, zkey, vkey) from the public/ directory
 * via fetch. Includes an in-memory cache to avoid re-downloading large files.
 * Next.js serves public/ statically, so browser fetches work directly.
 */

import type { ZKCircuit } from '@/types/zk';
import { getCircuitConfig } from './circuit-registry';
import { ArtifactLoadError } from './errors';

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

/** In-memory artifact cache keyed by circuit ID */
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
 * Returns cached artifacts if available. Downloads from public/ otherwise.
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
  // Return cached if available
  const cached = artifactCache.get(circuitId);
  if (cached) return cached;

  const config = getCircuitConfig(circuitId);

  try {
    // Load WASM
    const wasm = await fetchArtifact(config.wasmPath, (loaded, total) => {
      onProgress?.({ phase: 'wasm', bytesLoaded: loaded, totalBytes: total });
    });

    // Load zkey
    const zkey = await fetchArtifact(config.zkeyPath, (loaded, total) => {
      onProgress?.({ phase: 'zkey', bytesLoaded: loaded, totalBytes: total });
    });

    // Load verification key (JSON)
    const vkeyResponse = await fetch(config.vkeyPath);
    if (!vkeyResponse.ok) {
      throw new Error(`HTTP ${vkeyResponse.status}: ${vkeyResponse.statusText}`);
    }
    const vkey = await vkeyResponse.json();
    onProgress?.({ phase: 'vkey', bytesLoaded: 0, totalBytes: null });

    const artifacts: LoadedArtifacts = { wasm, zkey, vkey };
    artifactCache.set(circuitId, artifacts);
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
 */
export function clearArtifactCache(circuitId?: ZKCircuit): void {
  if (circuitId) {
    artifactCache.delete(circuitId);
  } else {
    artifactCache.clear();
  }
}

/**
 * Check if artifacts are cached for a circuit.
 */
export function isArtifactCached(circuitId: ZKCircuit): boolean {
  return artifactCache.has(circuitId);
}
