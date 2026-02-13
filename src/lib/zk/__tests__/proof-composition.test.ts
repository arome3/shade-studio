/**
 * Tests for proof-composition.ts
 *
 * Mocks generateProof and verifyProofLocally to test:
 * - Sequential generation
 * - Partial failure
 * - Full failure
 * - Abort mid-sequence
 * - Progress callbacks
 * - Bundle verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateProof = vi.fn();
const mockVerifyProofLocally = vi.fn();

vi.mock('../proof-generator', () => ({
  generateProof: (...args: unknown[]) => mockGenerateProof(...args),
  verifyProofLocally: (...args: unknown[]) => mockVerifyProofLocally(...args),
}));

import {
  generateCompositeCredential,
  verifyProofBundle,
} from '../proof-composition';
import type { ZKProof, ProofBundle } from '@/types/zk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProof(circuit: string, id: string): ZKProof {
  return {
    id,
    circuit: circuit as ZKProof['circuit'],
    proof: {
      pi_a: ['1', '2', '3'],
      pi_b: [['4', '5'], ['6', '7']],
      pi_c: ['8', '9', '10'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: ['100'],
    status: 'verified',
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateCompositeCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate all proofs sequentially and return complete bundle', async () => {
    mockGenerateProof
      .mockResolvedValueOnce(createMockProof('verified-builder', 'p1'))
      .mockResolvedValueOnce(createMockProof('grant-track-record', 'p2'));

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
        { circuitId: 'grant-track-record', inputs: {} as never },
      ],
    });

    expect(bundle.status).toBe('complete');
    expect(bundle.proofs).toHaveLength(2);
    expect(bundle.errors).toHaveLength(0);
    expect(bundle.completedAt).toBeDefined();
    expect(mockGenerateProof).toHaveBeenCalledTimes(2);
  });

  it('should handle partial failure — some succeed, some fail', async () => {
    mockGenerateProof
      .mockResolvedValueOnce(createMockProof('verified-builder', 'p1'))
      .mockRejectedValueOnce(new Error('Circuit failed'));

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
        { circuitId: 'grant-track-record', inputs: {} as never },
      ],
    });

    expect(bundle.status).toBe('partial');
    expect(bundle.proofs).toHaveLength(1);
    expect(bundle.errors).toHaveLength(1);
    expect(bundle.errors[0]!.circuit).toBe('grant-track-record');
    expect(bundle.errors[0]!.error).toBe('Circuit failed');
  });

  it('should handle full failure — all circuits fail', async () => {
    mockGenerateProof
      .mockRejectedValueOnce(new Error('Failed 1'))
      .mockRejectedValueOnce(new Error('Failed 2'));

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
        { circuitId: 'grant-track-record', inputs: {} as never },
      ],
    });

    expect(bundle.status).toBe('failed');
    expect(bundle.proofs).toHaveLength(0);
    expect(bundle.errors).toHaveLength(2);
  });

  it('should stop on abort and return partial if some succeeded', async () => {
    const controller = new AbortController();

    mockGenerateProof.mockImplementation(async () => {
      // Abort after first proof generation completes
      controller.abort();
      return createMockProof('verified-builder', 'p1');
    });

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
        { circuitId: 'grant-track-record', inputs: {} as never },
      ],
      signal: controller.signal,
    });

    // First proof succeeded, then abort was checked before second
    expect(bundle.proofs).toHaveLength(1);
    expect(bundle.status).toBe('partial');
  });

  it('should stop on abort and return failed if none succeeded', async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
      ],
      signal: controller.signal,
    });

    expect(bundle.status).toBe('failed');
    expect(bundle.proofs).toHaveLength(0);
  });

  it('should call progress callback with circuit progress', async () => {
    mockGenerateProof.mockImplementation(async (_circuitId: unknown, _inputs: unknown, options: { onProvingProgress?: (p: number) => void }) => {
      // Simulate progress
      options?.onProvingProgress?.(50);
      options?.onProvingProgress?.(100);
      return createMockProof('verified-builder', 'p1');
    });

    const onProgress = vi.fn();

    await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
      ],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
    // Last call should be progress = 100 for the circuit
    const progressCalls = onProgress.mock.calls;
    const lastCall = progressCalls[progressCalls.length - 1]!;
    expect(lastCall[0]!).toBe(0); // circuitIndex
    expect(lastCall[1]!).toBe(1); // totalCircuits
    expect(lastCall[2]!).toBe(100); // circuitProgress
  });

  it('should handle abort error from generateProof', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockGenerateProof
      .mockResolvedValueOnce(createMockProof('verified-builder', 'p1'))
      .mockRejectedValueOnce(abortError);

    const bundle = await generateCompositeCredential({
      circuits: [
        { circuitId: 'verified-builder', inputs: {} as never },
        { circuitId: 'grant-track-record', inputs: {} as never },
      ],
    });

    expect(bundle.status).toBe('partial');
    expect(bundle.proofs).toHaveLength(1);
  });
});

describe('verifyProofBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify all proofs and return aggregate result', async () => {
    mockVerifyProofLocally.mockResolvedValue({
      isValid: true,
      timestamp: new Date().toISOString(),
      method: 'local',
    });

    const bundle: ProofBundle = {
      id: 'bundle-1',
      proofs: [
        createMockProof('verified-builder', 'p1'),
        createMockProof('grant-track-record', 'p2'),
      ],
      circuits: ['verified-builder', 'grant-track-record'],
      status: 'complete',
      createdAt: new Date().toISOString(),
      errors: [],
    };

    const result = await verifyProofBundle(bundle);

    expect(result.allValid).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.isValid)).toBe(true);
  });

  it('should report allValid=false when any proof fails', async () => {
    mockVerifyProofLocally
      .mockResolvedValueOnce({ isValid: true, timestamp: '', method: 'local' })
      .mockResolvedValueOnce({ isValid: false, timestamp: '', method: 'local', error: 'bad' });

    const bundle: ProofBundle = {
      id: 'bundle-1',
      proofs: [
        createMockProof('verified-builder', 'p1'),
        createMockProof('grant-track-record', 'p2'),
      ],
      circuits: ['verified-builder', 'grant-track-record'],
      status: 'complete',
      createdAt: new Date().toISOString(),
      errors: [],
    };

    const result = await verifyProofBundle(bundle);

    expect(result.allValid).toBe(false);
    expect(result.results[1]!.error).toBe('bad');
  });

  it('should handle empty bundle', async () => {
    const bundle: ProofBundle = {
      id: 'bundle-1',
      proofs: [],
      circuits: [],
      status: 'failed',
      createdAt: new Date().toISOString(),
      errors: [],
    };

    const result = await verifyProofBundle(bundle);

    expect(result.allValid).toBe(false);
    expect(result.results).toHaveLength(0);
  });

  it('should catch verification errors', async () => {
    mockVerifyProofLocally.mockRejectedValue(new Error('WASM crash'));

    const bundle: ProofBundle = {
      id: 'bundle-1',
      proofs: [createMockProof('verified-builder', 'p1')],
      circuits: ['verified-builder'],
      status: 'complete',
      createdAt: new Date().toISOString(),
      errors: [],
    };

    const result = await verifyProofBundle(bundle);

    expect(result.allValid).toBe(false);
    expect(result.results[0]!.error).toBe('WASM crash');
  });
});
