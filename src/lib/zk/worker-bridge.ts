/**
 * Worker Bridge — Promise API over the ZK proof Web Worker.
 *
 * Provides:
 * - workerFullProve(): runs snarkjs.groth16.fullProve in a worker thread
 * - workerVerify(): runs snarkjs.groth16.verify in a worker thread
 * - Synthetic time-based progress estimation (caps at 90% until done)
 * - Abort / cancellation via AbortSignal
 * - SSR fallback: falls back to main-thread snarkjs when Worker is unavailable
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

function getOrCreateWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./proof-worker.ts', import.meta.url));
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
  return typeof Worker !== 'undefined';
}

// ---------------------------------------------------------------------------
// workerFullProve
// ---------------------------------------------------------------------------

/**
 * Run Groth16 fullProve in a Web Worker with synthetic progress.
 *
 * Falls back to main-thread snarkjs in SSR / environments without Worker.
 */
export function workerFullProve(
  circuitSignals: Record<string, unknown>,
  wasm: ArrayBuffer,
  zkey: ArrayBuffer,
  options: WorkerFullProveOptions = {}
): Promise<{ proof: object; publicSignals: string[] }> {
  const { signal, onProgress, estimatedMs = 5000 } = options;

  // SSR fallback — run on main thread
  if (!isWorkerAvailable()) {
    return mainThreadFullProve(circuitSignals, wasm, zkey, signal);
  }

  return new Promise((resolve, reject) => {
    const id = nanoid(8);
    const w = getOrCreateWorker();

    // --- Synthetic progress ---
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const startTime = Date.now();

    if (onProgress) {
      onProgress(0);
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(90, Math.round((elapsed / estimatedMs) * 90));
        onProgress(percent);
      }, 200);
    }

    function cleanup() {
      if (progressTimer !== null) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
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

    // --- Message handler ---
    function onMessage(event: MessageEvent<WorkerResponse>) {
      const msg = event.data;
      if (msg.id !== id) return; // Not our message

      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);
      cleanup();

      if (msg.type === 'fullProve:result') {
        onProgress?.(100);
        resolve({ proof: msg.proof, publicSignals: msg.publicSignals });
      } else if (msg.type === 'fullProve:error') {
        reject(new Error(msg.error));
      }
    }

    w.addEventListener('message', onMessage);

    // --- Send to worker (transfer buffers for zero-copy) ---
    const wasmCopy = wasm.slice(0);
    const zkeyCopy = zkey.slice(0);

    w.postMessage(
      { type: 'fullProve', id, circuitSignals, wasm: wasmCopy, zkey: zkeyCopy },
      [wasmCopy, zkeyCopy]
    );
  });
}

// ---------------------------------------------------------------------------
// workerVerify
// ---------------------------------------------------------------------------

/**
 * Run Groth16 verify in a Web Worker.
 *
 * Falls back to main-thread snarkjs in SSR / environments without Worker.
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
    const w = getOrCreateWorker();

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

    function onMessage(event: MessageEvent<WorkerResponse>) {
      const msg = event.data;
      if (msg.id !== id) return;

      signal?.removeEventListener('abort', onAbort);
      w.removeEventListener('message', onMessage);

      if (msg.type === 'verify:result') {
        resolve(msg.isValid);
      } else if (msg.type === 'verify:error') {
        reject(new Error(msg.error));
      }
    }

    w.addEventListener('message', onMessage);

    w.postMessage({ type: 'verify', id, vkey, publicSignals, proof });
  });
}

// ---------------------------------------------------------------------------
// Main-thread fallbacks (SSR / test environments)
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
