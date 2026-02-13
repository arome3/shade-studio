/**
 * Tests for the ZK proof generator.
 *
 * Mocks snarkjs (via worker-bridge), artifacts, validation, signal mappers,
 * and concurrency to test the generation flow in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockWorkerFullProve = vi.fn();
const mockWorkerVerify = vi.fn();

vi.mock('../worker-bridge', () => ({
  workerFullProve: (...args: unknown[]) => mockWorkerFullProve(...args),
  workerVerify: (...args: unknown[]) => mockWorkerVerify(...args),
}));

const mockExportSolidityCallData = vi.fn();
vi.mock('snarkjs', () => ({
  groth16: {
    exportSolidityCallData: (...args: unknown[]) =>
      mockExportSolidityCallData(...args),
  },
}));

vi.mock('../artifacts', () => ({
  loadCircuitArtifacts: vi.fn().mockResolvedValue({
    wasm: new ArrayBuffer(8),
    zkey: new ArrayBuffer(8),
    vkey: { protocol: 'groth16' },
  }),
}));

vi.mock('../validation', () => ({
  validateCircuitInputs: vi.fn((_id: string, inputs: unknown) => inputs),
}));

vi.mock('../input-preparation', () => ({
  verifiedBuilderToCircuitSignals: vi.fn((inputs: unknown) => ({
    ...inputs as Record<string, unknown>,
    mapped: true,
  })),
  grantTrackRecordToCircuitSignals: vi.fn((inputs: unknown) => ({
    ...inputs as Record<string, unknown>,
    mapped: true,
  })),
  teamAttestationToCircuitSignals: vi.fn((inputs: unknown) => ({
    ...inputs as Record<string, unknown>,
    mapped: true,
  })),
}));

vi.mock('../circuit-registry', () => ({
  getCircuitConfig: vi.fn(() => ({
    id: 'verified-builder',
    estimatedConstraints: 10_000,
    version: '1.0.0',
  })),
}));

// Mock concurrency — immediate release
vi.mock('../concurrency', () => ({
  getProofSemaphore: vi.fn(() => ({
    acquire: vi.fn().mockResolvedValue(() => {}),
  })),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-proof-id'),
}));

import {
  generateProof,
  verifyProofLocally,
  exportProofCalldata,
  exportProofToJson,
  importProofFromJson,
  isProofExpired,
  estimateProofTime,
} from '../proof-generator';
import type { CircuitInputsMap, ZKProof } from '@/types/zk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid inputs for verified-builder (just needs to pass mocked validation). */
const mockInputs = {
  activityRoot: '123',
  minDays: 10,
  currentTimestamp: 1700000000,
  activityDates: [],
  activityProofSiblings: [],
  activityProofPathIndices: [],
} as unknown as CircuitInputsMap['verified-builder'];

const mockProofResult = {
  pi_a: ['1', '2', '3'],
  pi_b: [['4', '5'], ['6', '7']],
  pi_c: ['8', '9', '10'],
  protocol: 'groth16',
  curve: 'bn128',
};

function createMockZKProof(overrides: Partial<ZKProof> = {}): ZKProof {
  return {
    id: 'test-proof-id',
    circuit: 'verified-builder',
    proof: {
      pi_a: ['1', '2', '3'],
      pi_b: [['4', '5'], ['6', '7']],
      pi_c: ['8', '9', '10'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: ['100', '200'],
    status: 'verified',
    generatedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerFullProve.mockResolvedValue({
      proof: mockProofResult,
      publicSignals: ['100', '200'],
    });
    mockWorkerVerify.mockResolvedValue(true);
  });

  it('should generate and self-verify a proof via worker bridge', async () => {
    const result = await generateProof('verified-builder', mockInputs);

    expect(result.id).toBe('test-proof-id');
    expect(result.circuit).toBe('verified-builder');
    expect(result.status).toBe('verified');
    expect(result.proof.protocol).toBe('groth16');
    expect(result.publicSignals).toEqual(['100', '200']);
    expect(result.verifiedAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    expect(mockWorkerFullProve).toHaveBeenCalledTimes(1);
    expect(mockWorkerVerify).toHaveBeenCalledTimes(1);
  });

  it('should skip self-verification when selfVerify is false', async () => {
    const result = await generateProof('verified-builder', mockInputs, {
      selfVerify: false,
    });

    expect(result.status).toBe('ready');
    expect(result.verifiedAt).toBeUndefined();
    expect(mockWorkerVerify).not.toHaveBeenCalled();
  });

  it('should throw ProofVerificationError when self-verify fails', async () => {
    mockWorkerVerify.mockResolvedValue(false);

    await expect(
      generateProof('verified-builder', mockInputs)
    ).rejects.toThrow('Self-verification failed');
  });

  it('should throw on abort', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateProof('verified-builder', mockInputs, {
        signal: controller.signal,
      })
    ).rejects.toThrow('aborted');
  });

  it('should pass progress callback to loadCircuitArtifacts', async () => {
    const onProgress = vi.fn();
    await generateProof('verified-builder', mockInputs, { onProgress });

    const { loadCircuitArtifacts: mockLoad } = await import('../artifacts');
    expect(mockLoad).toHaveBeenCalledWith('verified-builder', onProgress);
  });

  it('should pass onProvingProgress to workerFullProve', async () => {
    const onProvingProgress = vi.fn();
    await generateProof('verified-builder', mockInputs, { onProvingProgress });

    expect(mockWorkerFullProve).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      expect.objectContaining({ onProgress: onProvingProgress })
    );
  });

  it('should wrap unknown errors in ProofGenerationError', async () => {
    mockWorkerFullProve.mockRejectedValue(new Error('snarkjs exploded'));

    await expect(
      generateProof('verified-builder', mockInputs)
    ).rejects.toThrow('snarkjs exploded');
  });

  it('should generate proof for grant-track-record circuit', async () => {
    const grantInputs = {
      grantRoot: '456',
      minGrants: 3,
    } as unknown as CircuitInputsMap['grant-track-record'];

    const result = await generateProof('grant-track-record', grantInputs);
    expect(result.circuit).toBe('grant-track-record');
  });

  it('should generate proof for team-attestation circuit', async () => {
    const teamInputs = {
      attestersRoot: '789',
      minAttestations: 2,
    } as unknown as CircuitInputsMap['team-attestation'];

    const result = await generateProof('team-attestation', teamInputs);
    expect(result.circuit).toBe('team-attestation');
  });
});

describe('verifyProofLocally', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid result when proof passes via worker', async () => {
    mockWorkerVerify.mockResolvedValue(true);

    const proof = createMockZKProof();
    const result = await verifyProofLocally(proof);

    expect(result.isValid).toBe(true);
    expect(result.method).toBe('local');
    expect(result.timestamp).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return invalid result when proof fails', async () => {
    mockWorkerVerify.mockResolvedValue(false);

    const proof = createMockZKProof();
    const result = await verifyProofLocally(proof);

    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should catch errors and return invalid result', async () => {
    mockWorkerVerify.mockRejectedValue(new Error('WASM crash'));

    const proof = createMockZKProof();
    const result = await verifyProofLocally(proof);

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('WASM crash');
  });
});

describe('exportProofCalldata', () => {
  it('should delegate to snarkjs.groth16.exportSolidityCallData', async () => {
    mockExportSolidityCallData.mockResolvedValue('0xCALLDATA');

    const proof = createMockZKProof();
    const calldata = await exportProofCalldata(proof);

    expect(calldata).toBe('0xCALLDATA');
    expect(mockExportSolidityCallData).toHaveBeenCalledTimes(1);
  });
});

describe('exportProofToJson / importProofFromJson', () => {
  it('should round-trip a proof through JSON', () => {
    const proof = createMockZKProof();
    const json = exportProofToJson(proof);
    const restored = importProofFromJson(json);

    expect(restored).toEqual(proof);
  });

  it('should reject invalid JSON', () => {
    expect(() => importProofFromJson('{}')).toThrow('Invalid ZKProof JSON');
  });

  it('should reject non-JSON string', () => {
    expect(() => importProofFromJson('not json')).toThrow();
  });
});

describe('isProofExpired', () => {
  it('should return false for non-expired proof', () => {
    const proof = createMockZKProof({
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(isProofExpired(proof)).toBe(false);
  });

  it('should return true for expired proof', () => {
    const proof = createMockZKProof({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(isProofExpired(proof)).toBe(true);
  });

  it('should return false when no expiresAt is set', () => {
    const proof = createMockZKProof({ expiresAt: undefined });
    expect(isProofExpired(proof)).toBe(false);
  });
});

describe('estimateProofTime', () => {
  it('should return at least 1000ms', () => {
    const time = estimateProofTime('verified-builder');
    expect(time).toBeGreaterThanOrEqual(1000);
  });
});
