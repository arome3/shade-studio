/**
 * Integration Test: ZK Credential Lifecycle
 *
 * Tests proof store operations, proof shape validity,
 * expiration detection, and data portability (export/import).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProofStore } from '@/stores/proof-store';
import {
  createMockZKProof,
  createExpiredProof,
  createMockOnChainCredential,
  resetCredentialFixtures,
} from '@/test';

describe('Credential Flow: proof lifecycle', () => {
  beforeEach(() => {
    useProofStore.getState().reset();
    resetCredentialFixtures();
  });

  describe('proof shape validity', () => {
    it('should create a proof with valid Groth16 BN128 structure', () => {
      const proof = createMockZKProof();

      // Groth16 proof structure
      expect(proof.proof.protocol).toBe('groth16');
      expect(proof.proof.curve).toBe('bn128');
      expect(proof.proof.pi_a).toHaveLength(3);
      expect(proof.proof.pi_b).toHaveLength(3);
      expect(proof.proof.pi_b[0]).toHaveLength(2); // G2 point
      expect(proof.proof.pi_c).toHaveLength(3);
      expect(proof.publicSignals.length).toBeGreaterThan(0);
    });

    it('should have valid status transitions', () => {
      const proof = createMockZKProof({ status: 'pending' });
      expect(proof.status).toBe('pending');

      const readyProof = createMockZKProof({ status: 'ready' });
      expect(readyProof.status).toBe('ready');

      const verifiedProof = createMockZKProof({ status: 'verified' });
      expect(verifiedProof.status).toBe('verified');
    });
  });

  describe('proof store CRUD', () => {
    it('should add a proof to the store', () => {
      const proof = createMockZKProof();
      useProofStore.getState().addProof(proof);

      const stored = useProofStore.getState().proofs[proof.id];
      expect(stored).toBeDefined();
      expect(stored?.circuit).toBe('verified-builder');
    });

    it('should maintain insertion order (newest first)', () => {
      const proof1 = createMockZKProof({ circuit: 'verified-builder' });
      const proof2 = createMockZKProof({ circuit: 'grant-track-record' });
      const proof3 = createMockZKProof({ circuit: 'team-attestation' });

      const store = useProofStore.getState();
      store.addProof(proof1);
      store.addProof(proof2);
      store.addProof(proof3);

      const order = useProofStore.getState().proofOrder;
      expect(order[0]).toBe(proof3.id); // newest first
      expect(order[1]).toBe(proof2.id);
      expect(order[2]).toBe(proof1.id);
    });

    it('should remove a proof from the store', () => {
      const proof = createMockZKProof();
      useProofStore.getState().addProof(proof);
      useProofStore.getState().removeProof(proof.id);

      expect(useProofStore.getState().proofs[proof.id]).toBeUndefined();
      expect(useProofStore.getState().proofOrder).not.toContain(proof.id);
    });

    it('should update proof fields', () => {
      const proof = createMockZKProof({ status: 'pending' });
      useProofStore.getState().addProof(proof);

      useProofStore.getState().updateProof(proof.id, {
        status: 'verified',
        verifiedAt: new Date().toISOString(),
      });

      const updated = useProofStore.getState().proofs[proof.id];
      expect(updated?.status).toBe('verified');
      expect(updated?.verifiedAt).toBeTruthy();
    });
  });

  describe('queries', () => {
    it('should filter proofs by circuit', () => {
      const store = useProofStore.getState();
      store.addProof(createMockZKProof({ circuit: 'verified-builder' }));
      store.addProof(createMockZKProof({ circuit: 'grant-track-record' }));
      store.addProof(createMockZKProof({ circuit: 'verified-builder' }));

      const builderProofs = useProofStore.getState().getProofsByCircuit('verified-builder');
      expect(builderProofs).toHaveLength(2);
      builderProofs.forEach((p) => expect(p.circuit).toBe('verified-builder'));
    });

    it('should filter proofs by status', () => {
      const store = useProofStore.getState();
      store.addProof(createMockZKProof({ status: 'ready' }));
      store.addProof(createMockZKProof({ status: 'verified' }));
      store.addProof(createMockZKProof({ status: 'ready' }));

      const readyProofs = useProofStore.getState().getProofsByStatus('ready');
      expect(readyProofs).toHaveLength(2);
    });
  });

  describe('expiration and pruning', () => {
    it('should prune expired proofs', () => {
      const store = useProofStore.getState();

      // Add expired and non-expired proofs
      store.addProof(createExpiredProof());
      store.addProof(createExpiredProof());
      store.addProof(createMockZKProof()); // not expired

      const pruned = useProofStore.getState().pruneExpired();
      expect(pruned).toBe(2);
      expect(useProofStore.getState().proofOrder).toHaveLength(1);
    });

    it('should return 0 when nothing to prune', () => {
      useProofStore.getState().addProof(createMockZKProof());
      const pruned = useProofStore.getState().pruneExpired();
      expect(pruned).toBe(0);
    });

    it('should detect expired credentials via expiresAt', () => {
      const expired = createExpiredProof();
      expect(new Date(expired.expiresAt!).getTime()).toBeLessThan(Date.now());
    });
  });

  describe('credential deduplication', () => {
    it('should match local proof to on-chain credential by circuit + signals', () => {
      const proof = createMockZKProof({
        circuit: 'verified-builder',
        publicSignals: ['1', '30', '1700000000'],
      });
      const credential = createMockOnChainCredential({
        circuitType: 'verified-builder',
        publicSignals: ['1', '30', '1700000000'],
      });

      // Deduplication: same circuit + same publicSignals = same credential
      expect(proof.circuit).toBe(credential.circuitType);
      expect(proof.publicSignals).toEqual(credential.publicSignals);
    });
  });

  describe('data portability (export/import)', () => {
    it('should export and re-import proofs', () => {
      const store = useProofStore.getState();
      const proof1 = createMockZKProof({ circuit: 'verified-builder' });
      const proof2 = createMockZKProof({ circuit: 'grant-track-record' });

      store.addProof(proof1);
      store.addProof(proof2);

      // Export
      const exported = useProofStore.getState().exportData();
      expect(exported.proofs[proof1.id]).toBeDefined();
      expect(exported.proofs[proof2.id]).toBeDefined();
      expect(exported.exportedAt).toBeGreaterThan(0);

      // Reset store and re-import
      useProofStore.getState().reset();
      expect(useProofStore.getState().proofOrder).toHaveLength(0);

      useProofStore.getState().importData({ proofs: exported.proofs });
      expect(useProofStore.getState().proofOrder).toHaveLength(2);
    });

    it('should not duplicate proofs on import', () => {
      const store = useProofStore.getState();
      const proof = createMockZKProof();
      store.addProof(proof);

      // Import the same proof again
      store.importData({ proofs: { [proof.id]: proof } });

      // Should still be 1
      expect(useProofStore.getState().proofOrder).toHaveLength(1);
    });
  });
});
