/**
 * ZK Proof Web Worker
 *
 * Runs snarkjs Groth16 operations in a dedicated thread so the main
 * thread / UI remains responsive during proof generation.
 *
 * Communication protocol:
 *   Request:  { type: 'fullProve', id, circuitSignals, wasm, zkey }
 *             { type: 'verify',    id, vkey, publicSignals, proof }
 *   Response: { type: 'fullProve:result', id, proof, publicSignals }
 *             { type: 'fullProve:error',  id, error }
 *             { type: 'verify:result',    id, isValid }
 *             { type: 'verify:error',     id, error }
 *
 * Artifacts (wasm, zkey) are sent as transferable ArrayBuffers (zero-copy).
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface FullProveRequest {
  type: 'fullProve';
  id: string;
  circuitSignals: Record<string, unknown>;
  wasm: ArrayBuffer;
  zkey: ArrayBuffer;
}

export interface VerifyRequest {
  type: 'verify';
  id: string;
  vkey: object;
  publicSignals: string[];
  proof: object;
}

export type WorkerRequest = FullProveRequest | VerifyRequest;

export interface FullProveResult {
  type: 'fullProve:result';
  id: string;
  proof: object;
  publicSignals: string[];
}

export interface FullProveError {
  type: 'fullProve:error';
  id: string;
  error: string;
}

export interface VerifyResult {
  type: 'verify:result';
  id: string;
  isValid: boolean;
}

export interface VerifyError {
  type: 'verify:error';
  id: string;
  error: string;
}

export type WorkerResponse =
  | FullProveResult
  | FullProveError
  | VerifyResult
  | VerifyError;

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

const ctx = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'fullProve') {
    try {
      const snarkjs = await import('snarkjs');

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        msg.circuitSignals as Record<string, string | string[] | string[][] | number | number[] | number[][]>,
        new Uint8Array(msg.wasm),
        new Uint8Array(msg.zkey)
      );

      ctx.postMessage({
        type: 'fullProve:result',
        id: msg.id,
        proof,
        publicSignals,
      } satisfies FullProveResult);
    } catch (error) {
      ctx.postMessage({
        type: 'fullProve:error',
        id: msg.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies FullProveError);
    }
  } else if (msg.type === 'verify') {
    try {
      const snarkjs = await import('snarkjs');

      const isValid = await snarkjs.groth16.verify(
        msg.vkey,
        msg.publicSignals,
        msg.proof as Parameters<typeof snarkjs.groth16.verify>[2]
      );

      ctx.postMessage({
        type: 'verify:result',
        id: msg.id,
        isValid,
      } satisfies VerifyResult);
    } catch (error) {
      ctx.postMessage({
        type: 'verify:error',
        id: msg.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies VerifyError);
    }
  }
};
