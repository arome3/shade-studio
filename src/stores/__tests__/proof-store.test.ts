/**
 * Tests for the proof store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useProofStore,
  useProofsRecord,
  useProofById,
  useProofOrder,
  useProofOperation,
  useProofBusy,
  useProofError,
} from '../proof-store';
import type { ZKProof } from '@/types/zk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockProof = (overrides: Partial<ZKProof> = {}): ZKProof => ({
  id: 'proof-1',
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProofStore', () => {
  beforeEach(() => {
    useProofStore.getState().reset();
  });

  describe('addProof', () => {
    it('should add a proof and prepend to order', () => {
      const proof = createMockProof();

      act(() => {
        useProofStore.getState().addProof(proof);
      });

      const state = useProofStore.getState();
      expect(state.proofs['proof-1']).toEqual(proof);
      expect(state.proofOrder).toEqual(['proof-1']);
    });

    it('should prepend new proofs (newest first)', () => {
      const p1 = createMockProof({ id: 'proof-1' });
      const p2 = createMockProof({ id: 'proof-2' });

      act(() => {
        useProofStore.getState().addProof(p1);
        useProofStore.getState().addProof(p2);
      });

      expect(useProofStore.getState().proofOrder).toEqual([
        'proof-2',
        'proof-1',
      ]);
    });
  });

  describe('updateProof', () => {
    it('should update an existing proof', () => {
      const proof = createMockProof();

      act(() => {
        useProofStore.getState().addProof(proof);
        useProofStore.getState().updateProof('proof-1', {
          status: 'expired',
        });
      });

      expect(useProofStore.getState().proofs['proof-1']?.status).toBe(
        'expired'
      );
    });

    it('should not modify state for non-existent proof', () => {
      act(() => {
        useProofStore.getState().updateProof('non-existent', {
          status: 'failed',
        });
      });

      expect(Object.keys(useProofStore.getState().proofs)).toHaveLength(0);
    });
  });

  describe('removeProof', () => {
    it('should remove a proof and its order entry', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof({ id: 'proof-1' }));
        useProofStore.getState().addProof(createMockProof({ id: 'proof-2' }));
        useProofStore.getState().removeProof('proof-1');
      });

      const state = useProofStore.getState();
      expect(state.proofs['proof-1']).toBeUndefined();
      expect(state.proofOrder).toEqual(['proof-2']);
    });
  });

  describe('operation tracking', () => {
    it('should set and clear operation', () => {
      act(() => {
        useProofStore.getState().setOperation({
          circuit: 'verified-builder',
          phase: 'proving',
          progress: 50,
        });
      });

      expect(useProofStore.getState().currentOperation).toEqual({
        circuit: 'verified-builder',
        phase: 'proving',
        progress: 50,
      });
      // Setting operation should clear error
      expect(useProofStore.getState().error).toBeNull();

      act(() => {
        useProofStore.getState().clearOperation();
      });

      expect(useProofStore.getState().currentOperation).toBeNull();
    });

    it('should update operation progress', () => {
      act(() => {
        useProofStore.getState().setOperation({
          circuit: 'verified-builder',
          phase: 'loading',
          progress: 0,
        });
        useProofStore.getState().updateOperationProgress(75);
      });

      expect(useProofStore.getState().currentOperation?.progress).toBe(75);
    });

    it('should no-op progress update when no operation is active', () => {
      act(() => {
        useProofStore.getState().updateOperationProgress(50);
      });

      expect(useProofStore.getState().currentOperation).toBeNull();
    });
  });

  describe('getProofsByCircuit', () => {
    it('should filter proofs by circuit', () => {
      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'p1', circuit: 'verified-builder' })
        );
        useProofStore.getState().addProof(
          createMockProof({ id: 'p2', circuit: 'grant-track-record' })
        );
        useProofStore.getState().addProof(
          createMockProof({ id: 'p3', circuit: 'verified-builder' })
        );
      });

      const builderProofs =
        useProofStore.getState().getProofsByCircuit('verified-builder');
      expect(builderProofs).toHaveLength(2);
      expect(builderProofs.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
    });
  });

  describe('getProofsByStatus', () => {
    it('should filter proofs by status', () => {
      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'p1', status: 'verified' })
        );
        useProofStore.getState().addProof(
          createMockProof({ id: 'p2', status: 'ready' })
        );
        useProofStore.getState().addProof(
          createMockProof({ id: 'p3', status: 'verified' })
        );
      });

      const verified =
        useProofStore.getState().getProofsByStatus('verified');
      expect(verified).toHaveLength(2);

      const ready = useProofStore.getState().getProofsByStatus('ready');
      expect(ready).toHaveLength(1);
    });
  });

  describe('pruneExpired', () => {
    it('should remove expired proofs', () => {
      const expired = createMockProof({
        id: 'old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const valid = createMockProof({
        id: 'new',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      act(() => {
        useProofStore.getState().addProof(expired);
        useProofStore.getState().addProof(valid);
      });

      let count = 0;
      act(() => {
        count = useProofStore.getState().pruneExpired();
      });

      expect(count).toBe(1);
      expect(useProofStore.getState().proofs['old']).toBeUndefined();
      expect(useProofStore.getState().proofs['new']).toBeDefined();
      expect(useProofStore.getState().proofOrder).toEqual(['new']);
    });

    it('should return 0 when nothing is expired', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      let count = 0;
      act(() => {
        count = useProofStore.getState().pruneExpired();
      });

      expect(count).toBe(0);
    });
  });

  describe('exportData / importData', () => {
    it('should export correct shape', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
      });

      const exported = useProofStore.getState().exportData();
      expect(exported.proofs['proof-1']).toBeDefined();
      expect(exported.proofOrder).toEqual(['proof-1']);
      expect(exported.exportedAt).toBeGreaterThan(0);
    });

    it('should merge new proofs on import', () => {
      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'existing' })
        );
      });

      act(() => {
        useProofStore.getState().importData({
          proofs: {
            'new-proof': createMockProof({ id: 'new-proof' }),
          },
        });
      });

      const state = useProofStore.getState();
      expect(Object.keys(state.proofs)).toHaveLength(2);
      expect(state.proofOrder).toContain('new-proof');
    });

    it('should skip proofs with existing IDs on import', () => {
      act(() => {
        useProofStore.getState().addProof(
          createMockProof({ id: 'proof-1', status: 'verified' })
        );
      });

      act(() => {
        useProofStore.getState().importData({
          proofs: {
            'proof-1': createMockProof({ id: 'proof-1', status: 'failed' }),
          },
        });
      });

      expect(useProofStore.getState().proofs['proof-1']?.status).toBe(
        'verified'
      );
    });
  });

  describe('error handling', () => {
    it('should set error and clear operation', () => {
      act(() => {
        useProofStore.getState().setOperation({
          circuit: 'verified-builder',
          phase: 'proving',
          progress: 50,
        });
        useProofStore.getState().setError('Test error');
      });

      const state = useProofStore.getState();
      expect(state.error).toBe('Test error');
      expect(state.currentOperation).toBeNull();
    });

    it('should clear error', () => {
      act(() => {
        useProofStore.getState().setError('Some error');
        useProofStore.getState().clearError();
      });

      expect(useProofStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useProofStore.getState().addProof(createMockProof());
        useProofStore.getState().setError('Error');
        useProofStore.getState().reset();
      });

      const state = useProofStore.getState();
      expect(Object.keys(state.proofs)).toHaveLength(0);
      expect(state.proofOrder).toEqual([]);
      expect(state.currentOperation).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});

describe('selector hooks', () => {
  beforeEach(() => {
    useProofStore.getState().reset();
  });

  it('useProofsRecord should return proofs record', () => {
    const p1 = createMockProof({ id: 'proof-1' });
    const p2 = createMockProof({ id: 'proof-2' });

    act(() => {
      useProofStore.getState().addProof(p1);
      useProofStore.getState().addProof(p2);
    });

    const { result } = renderHook(() => useProofsRecord());
    expect(Object.keys(result.current)).toHaveLength(2);
  });

  it('useProofById should return a specific proof', () => {
    const proof = createMockProof({ id: 'proof-1' });

    act(() => {
      useProofStore.getState().addProof(proof);
    });

    const { result } = renderHook(() => useProofById('proof-1'));
    expect(result.current).toEqual(proof);
  });

  it('useProofById should return null for non-existent ID', () => {
    const { result } = renderHook(() => useProofById('non-existent'));
    expect(result.current).toBeNull();
  });

  it('useProofOrder should return order array', () => {
    act(() => {
      useProofStore.getState().addProof(createMockProof({ id: 'p1' }));
      useProofStore.getState().addProof(createMockProof({ id: 'p2' }));
    });

    const { result } = renderHook(() => useProofOrder());
    expect(result.current).toEqual(['p2', 'p1']);
  });

  it('useProofOperation should return current operation', () => {
    act(() => {
      useProofStore.getState().setOperation({
        circuit: 'verified-builder',
        phase: 'proving',
        progress: 42,
      });
    });

    const { result } = renderHook(() => useProofOperation());
    expect(result.current?.progress).toBe(42);
  });

  it('useProofBusy should reflect operation presence', () => {
    const { result } = renderHook(() => useProofBusy());
    expect(result.current).toBe(false);

    act(() => {
      useProofStore.getState().setOperation({
        circuit: 'verified-builder',
        phase: 'loading',
        progress: 0,
      });
    });

    const { result: result2 } = renderHook(() => useProofBusy());
    expect(result2.current).toBe(true);
  });

  it('useProofError should return error', () => {
    act(() => {
      useProofStore.getState().setError('Test error');
    });

    const { result } = renderHook(() => useProofError());
    expect(result.current).toBe('Test error');
  });
});
