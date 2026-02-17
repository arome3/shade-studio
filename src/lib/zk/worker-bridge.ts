/**
 * Worker Bridge — Promise API over the ZK proof Web Worker.
 *
 * Provides:
 * - workerFullProve(): runs snarkjs.groth16.fullProve in a worker thread
 * - workerVerify(): runs snarkjs.groth16.verify in a worker thread
 * - Synthetic time-based progress estimation (caps at 90% until done)
 * - Abort / cancellation via AbortSignal
 * - Automatic fallback to main-thread when Worker fails or times out
 */

import { nanoid } from 'nanoid';
import type { WorkerResponse } from './proof-worker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerFullProveOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Progress callback: receives 0-100 */
  onProgress?: (percent: number) => void;
  /** Estimated proving time in ms (for synthetic progress) */
  estimatedMs?: number;
}

// ---------------------------------------------------------------------------
// Singleton worker
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
/**
 * Worker disabled: Next.js webpack doesn't reliably bundle dynamic imports
 * inside Web Workers (snarkjs import hangs in dev and often in production).
 * Main-thread proving works fine — the UI freezes for ~30-60s but completes.
 */
let workerHealthy = false;

function getOrCreateWorker(): Worker | null {
  if (!workerHealthy) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./proof-worker.ts', import.meta.url));
    } catch {
      workerHealthy = false;
      return null;
    }
  }
  return worker;
}

function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

// ---------------------------------------------------------------------------
// SSR detection
// ---------------------------------------------------------------------------

function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined' && workerHealthy;
}

// ---------------------------------------------------------------------------
// workerFullProve
// ---------------------------------------------------------------------------

/**
 * Run Groth16 fullProve in a Web Worker with synthetic progress.
 *
 * Falls back to main-thread snarkjs if:
 * - Worker is not available (SSR)
 * - Worker fails to respond within timeout (estimatedMs * 3)
 * - Worker errors out
 */
export function workerFullProve(
  circuitSignals: Record<string, unknown>,
  wasm: ArrayBuffer,
  zkey: ArrayBuffer,
  options: WorkerFullProveOptions = {}
): Promise<{ proof: object; publicSignals: string[] }> {
  const { signal, onProgress, estimatedMs = 60000 } = options;

  // SSR fallback — run on main thread
  if (!isWorkerAvailable()) {
    return mainThreadFullProveWithProgress(
      circuitSignals, wasm, zkey, signal, onProgress, estimatedMs
    );
  }

  return new Promise((resolve, reject) => {
    const id = nanoid(8);
    const maybeWorker = getOrCreateWorker();

    // Worker creation failed — fall back to main thread
    if (!maybeWorker) {
      resolve(
        mainThreadFullProveWithProgress(
          circuitSignals, wasm, zkey, signal, onProgress, estimatedMs
        )
      );
      return;
    }

    const w = maybeWorker;

    // --- Synthetic progress ---
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const startTime = Date.now();

    if (onProgress) {
      onProgress(0);
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(90, Math.round((elapsed / estimatedMs) * 90));
        onProgress(percent);
      }, 500);
    }

    // --- Timeout: fall back to main thread if worker is unresponsive ---
    const timeoutMs = Math.max(estimatedMs * 3, 180_000); // at least 3 minutes
    const timeoutId = setTimeout(() => {
      cleanup();
      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      terminateWorker();
      workerHealthy = false;
      console.warn('[ZK] Worker timed out, falling back to main thread');
      resolve(
        mainThreadFullProveWithProgress(
          circuitSignals, wasm, zkey, signal, onProgress, estimatedMs
        )
      );
    }, timeoutMs);

    function cleanup() {
      if (progressTimer !== null) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      clearTimeout(timeoutId);
    }

    // --- Abort handling ---
    function onAbort() {
      cleanup();
      terminateWorker();
      const err = new Error('Proof generation aborted');
      err.name = 'AbortError';
      reject(err);
    }

    if (signal?.aborted) {
      cleanup();
      const err = new Error('Proof generation aborted');
      err.name = 'AbortError';
      reject(err);
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });

    // --- Error handler ---
    function onError(event: ErrorEvent) {
      cleanup();
      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      terminateWorker();
      workerHealthy = false;
      console.warn('[ZK] Worker error, falling back to main thread:', event.message);
      resolve(
        mainThreadFullProveWithProgress(
          circuitSignals, wasm, zkey, signal, onProgress, estimatedMs
        )
      );
    }

    // --- Message handler ---
    function onMessage(event: MessageEvent<WorkerResponse>) {
      const msg = event.data;
      if (msg.id !== id) return; // Not our message

      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      cleanup();

      if (msg.type === 'fullProve:result') {
        onProgress?.(100);
        resolve({ proof: msg.proof, publicSignals: msg.publicSignals });
      } else if (msg.type === 'fullProve:error') {
        // Worker reported an error — fall back to main thread
        console.warn('[ZK] Worker proof error, falling back to main thread:', msg.error);
        workerHealthy = false;
        terminateWorker();
        resolve(
          mainThreadFullProveWithProgress(
            circuitSignals, wasm, zkey, signal, onProgress, estimatedMs
          )
        );
      }
    }

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);

    // --- Send to worker ---
    w.postMessage({ type: 'fullProve', id, circuitSignals, wasm, zkey });
  });
}

// ---------------------------------------------------------------------------
// workerVerify
// ---------------------------------------------------------------------------

/**
 * Run Groth16 verify in a Web Worker.
 *
 * Falls back to main-thread snarkjs when Worker is unavailable.
 */
export function workerVerify(
  vkey: object,
  publicSignals: string[],
  proof: object,
  signal?: AbortSignal
): Promise<boolean> {
  if (!isWorkerAvailable()) {
    return mainThreadVerify(vkey, publicSignals, proof);
  }

  return new Promise((resolve, reject) => {
    const id = nanoid(8);
    const maybeW = getOrCreateWorker();

    if (!maybeW) {
      resolve(mainThreadVerify(vkey, publicSignals, proof));
      return;
    }

    const w = maybeW;

    function onAbort() {
      terminateWorker();
      const err = new Error('Verification aborted');
      err.name = 'AbortError';
      reject(err);
    }

    if (signal?.aborted) {
      const err = new Error('Verification aborted');
      err.name = 'AbortError';
      reject(err);
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });

    // Timeout for verification (should be fast)
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);
      terminateWorker();
      resolve(mainThreadVerify(vkey, publicSignals, proof));
    }, 30_000);

    function onMessage(event: MessageEvent<WorkerResponse>) {
      const msg = event.data;
      if (msg.id !== id) return;

      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);

      if (msg.type === 'verify:result') {
        resolve(msg.isValid);
      } else if (msg.type === 'verify:error') {
        // Fall back to main thread
        resolve(mainThreadVerify(vkey, publicSignals, proof));
      }
    }

    w.addEventListener('message', onMessage);

    w.postMessage({ type: 'verify', id, vkey, publicSignals, proof });
  });
}

// ---------------------------------------------------------------------------
// Main-thread implementations
// ---------------------------------------------------------------------------

async function mainThreadFullProve(
  circuitSignals: Record<string, unknown>,
  wasm: ArrayBuffer,
  zkey: ArrayBuffer,
  signal?: AbortSignal
): Promise<{ proof: object; publicSignals: string[] }> {
  if (signal?.aborted) {
    const err = new Error('Proof generation aborted');
    err.name = 'AbortError';
    throw err;
  }

  const snarkjs = await import('snarkjs');
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitSignals as Record<string, string | string[] | string[][] | number | number[] | number[][]>,
    new Uint8Array(wasm),
    new Uint8Array(zkey)
  );

  return { proof, publicSignals };
}

/**
 * Main-thread fullProve with synthetic progress reporting.
 */
async function mainThreadFullProveWithProgress(
  circuitSignals: Record<string, unknown>,
  wasm: ArrayBuffer,
  zkey: ArrayBuffer,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
  estimatedMs = 60000
): Promise<{ proof: object; publicSignals: string[] }> {
  const startTime = Date.now();
  let progressTimer: ReturnType<typeof setInterval> | null = null;

  if (onProgress) {
    onProgress(0);
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min(90, Math.round((elapsed / estimatedMs) * 90));
      onProgress(percent);
    }, 500);
  }

  try {
    const result = await mainThreadFullProve(circuitSignals, wasm, zkey, signal);
    onProgress?.(100);
    return result;
  } finally {
    if (progressTimer !== null) {
      clearInterval(progressTimer);
    }
  }
}

async function mainThreadVerify(
  vkey: object,
  publicSignals: string[],
  proof: object
): Promise<boolean> {
  const snarkjs = await import('snarkjs');
  return snarkjs.groth16.verify(
    vkey,
    publicSignals,
    proof as Parameters<typeof snarkjs.groth16.verify>[2]
  );
}
