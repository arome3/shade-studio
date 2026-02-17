import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prepareVerifiedBuilderInputs,
  prepareGrantTrackRecordInputs,
  prepareTeamAttestationInputs,
  verifiedBuilderToCircuitSignals,
  grantTrackRecordToCircuitSignals,
  teamAttestationToCircuitSignals,
} from '../input-preparation';
import type {
  VerifiedBuilderData,
  GrantTrackRecordData,
  TeamAttestationData,
} from '../input-preparation';

// Mock poseidon since circomlibjs WASM isn't available in test
vi.mock('../poseidon', () => ({
  poseidonHash: vi.fn(async (inputs: bigint[]) => {
    // Simple mock: return stringified first input
    return inputs[0]?.toString() ?? '0';
  }),
  poseidonHashString: vi.fn(async (value: string) => {
    // Mock: return a deterministic hash based on character codes
    if (value === '') return '0';
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) % 1000000;
    }
    return hash.toString();
  }),
}));

describe('Input Preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareVerifiedBuilderInputs', () => {
    it('pads activityDates to maxDays (30)', async () => {
      const data: VerifiedBuilderData = {
        activityTimestamps: [1700000000, 1700086400, 1700172800],
        activityProofs: [
          { siblings: Array(20).fill('1'), pathIndices: Array(20).fill(0) },
          { siblings: Array(20).fill('2'), pathIndices: Array(20).fill(1) },
          { siblings: Array(20).fill('3'), pathIndices: Array(20).fill(0) },
        ],
        activityRoot: '999',
        minDays: 3,
        currentTimestamp: 1700200000,
      };

      const inputs = await prepareVerifiedBuilderInputs(data);

      // Should pad to 30
      expect(inputs.activityDates).toHaveLength(30);
      // First 3 should be hashed values (mock returns string of input)
      expect(inputs.activityDates[0]).toBeTruthy();
      expect(inputs.activityDates[0]).not.toBe('0');
      // Remaining should be zero-padded
      expect(inputs.activityDates[29]).toBe('0');

      // Merkle proofs should also be padded
      expect(inputs.activityProofSiblings).toHaveLength(30);
      expect(inputs.activityProofPathIndices).toHaveLength(30);
      expect(inputs.activityProofSiblings[0]).toHaveLength(20);

      // Public inputs should pass through
      expect(inputs.activityRoot).toBe('999');
      expect(inputs.minDays).toBe(3);
      expect(inputs.currentTimestamp).toBe(1700200000);
    });

    it('handles empty activity list', async () => {
      const data: VerifiedBuilderData = {
        activityTimestamps: [],
        activityProofs: [],
        activityRoot: '0',
        minDays: 1,
        currentTimestamp: 1700000000,
      };

      const inputs = await prepareVerifiedBuilderInputs(data);
      expect(inputs.activityDates).toHaveLength(30);
      expect(inputs.activityDates.every((d) => d === '0')).toBe(true);
    });

    it('rejects oversized activity arrays (Fix #9)', async () => {
      const data: VerifiedBuilderData = {
        activityTimestamps: Array(400).fill(1700000000),
        activityProofs: Array(400).fill({
          siblings: Array(20).fill('1'),
          pathIndices: Array(20).fill(0),
        }),
        activityRoot: '999',
        minDays: 3,
        currentTimestamp: 1700200000,
      };

      await expect(prepareVerifiedBuilderInputs(data)).rejects.toThrow(
        /exceeds target/
      );
    });
  });

  describe('prepareGrantTrackRecordInputs', () => {
    it('hashes grant and program IDs and pads to maxGrants (10)', async () => {
      const data: GrantTrackRecordData = {
        grants: [
          {
            grantId: 'grant-001',
            isCompleted: true,
            grantProof: {
              siblings: Array(15).fill('1'),
              pathIndices: Array(15).fill(0),
            },
            programId: 'program-001',
            programProof: {
              siblings: Array(10).fill('2'),
              pathIndices: Array(10).fill(0),
            },
          },
        ],
        grantRoot: '111',
        programsRoot: '222',
        minGrants: 1,
      };

      const inputs = await prepareGrantTrackRecordInputs(data);

      // Should pad to 10
      expect(inputs.grantIds).toHaveLength(10);
      expect(inputs.programIds).toHaveLength(10);
      expect(inputs.grantCompletionFlags).toHaveLength(10);

      // First entry should be hashed (non-zero from mock)
      expect(inputs.grantIds[0]).not.toBe('0');
      expect(inputs.programIds[0]).not.toBe('0');
      expect(inputs.grantCompletionFlags[0]).toBe(1);

      // Padded entries should be zero
      expect(inputs.grantIds[9]).toBe('0');
      expect(inputs.grantCompletionFlags[9]).toBe(0);

      // Merkle proofs padded
      expect(inputs.grantProofSiblings).toHaveLength(10);
      expect(inputs.grantProofSiblings[0]).toHaveLength(15);
      expect(inputs.programProofSiblings).toHaveLength(10);
      expect(inputs.programProofSiblings[0]).toHaveLength(10);

      // Public inputs pass through
      expect(inputs.grantRoot).toBe('111');
      expect(inputs.programsRoot).toBe('222');
      expect(inputs.minGrants).toBe(1);
    });

    it('handles empty grants list', async () => {
      const data: GrantTrackRecordData = {
        grants: [],
        grantRoot: '0',
        programsRoot: '0',
        minGrants: 0,
      };

      const inputs = await prepareGrantTrackRecordInputs(data);
      expect(inputs.grantIds).toHaveLength(10);
      expect(inputs.grantIds.every((id) => id === '0')).toBe(true);
    });

    it('rejects oversized grants arrays (Fix #9)', async () => {
      const data: GrantTrackRecordData = {
        grants: Array(15)
          .fill(null)
          .map((_, i) => ({
            grantId: `grant-${i}`,
            isCompleted: true,
            grantProof: {
              siblings: Array(15).fill('1'),
              pathIndices: Array(15).fill(0),
            },
            programId: `program-${i}`,
            programProof: {
              siblings: Array(10).fill('2'),
              pathIndices: Array(10).fill(0),
            },
          })),
        grantRoot: '111',
        programsRoot: '222',
        minGrants: 1,
      };

      await expect(prepareGrantTrackRecordInputs(data)).rejects.toThrow(
        /exceeds target/
      );
    });

    it('uses poseidonHashString instead of stringToHex (Fix #2)', async () => {
      const { poseidonHashString: mockHashString } = await import('../poseidon');

      const data: GrantTrackRecordData = {
        grants: [
          {
            grantId: 'grant-with-long-id-that-exceeds-31-bytes-easily',
            isCompleted: true,
            grantProof: {
              siblings: Array(15).fill('1'),
              pathIndices: Array(15).fill(0),
            },
            programId: 'program-with-long-id-also-over-31',
            programProof: {
              siblings: Array(10).fill('2'),
              pathIndices: Array(10).fill(0),
            },
          },
        ],
        grantRoot: '111',
        programsRoot: '222',
        minGrants: 1,
      };

      await prepareGrantTrackRecordInputs(data);

      // poseidonHashString should be called for grant and program IDs
      expect(mockHashString).toHaveBeenCalledWith(
        'grant-with-long-id-that-exceeds-31-bytes-easily'
      );
      expect(mockHashString).toHaveBeenCalledWith(
        'program-with-long-id-also-over-31'
      );
    });
  });

  describe('prepareTeamAttestationInputs', () => {
    it('pads attestations to maxAttestations (5)', async () => {
      const data: TeamAttestationData = {
        attestations: [
          {
            pubKey: ['100', '200'],
            signature: ['10', '20', '30'],
            message: '999',
            attesterProof: {
              siblings: Array(20).fill('1'),
              pathIndices: Array(20).fill(0),
            },
          },
        ],
        attestersRoot: '888',
        minAttestations: 1,
        credentialType: 1,
      };

      const inputs = await prepareTeamAttestationInputs(data);

      // Should pad to 5
      expect(inputs.attesterPubKeys).toHaveLength(5);
      expect(inputs.attestationSignatures).toHaveLength(5);
      expect(inputs.attestationMessages).toHaveLength(5);

      // First entry should have real data
      expect(inputs.attesterPubKeys[0]).toEqual(['100', '200']);
      expect(inputs.attestationSignatures[0]).toEqual(['10', '20', '30']);

      // Padded entries should be zero
      expect(inputs.attesterPubKeys[4]).toEqual(['0', '0']);
      expect(inputs.attestationSignatures[4]).toEqual(['0', '0', '0']);

      // Merkle proofs padded
      expect(inputs.attesterProofSiblings).toHaveLength(5);
      expect(inputs.attesterProofSiblings[0]).toHaveLength(20);

      // Public inputs
      expect(inputs.attestersRoot).toBe('888');
      expect(inputs.minAttestations).toBe(1);
      expect(inputs.credentialType).toBe(1);
    });

    it('handles empty attestations', async () => {
      const data: TeamAttestationData = {
        attestations: [],
        attestersRoot: '0',
        minAttestations: 0,
        credentialType: 0,
      };

      const inputs = await prepareTeamAttestationInputs(data);
      expect(inputs.attesterPubKeys).toHaveLength(5);
      expect(inputs.attesterPubKeys.every((pk) => pk[0] === '0' && pk[1] === '0')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Signal Name Mappers (Fix #5)
  // -------------------------------------------------------------------------

  describe('verifiedBuilderToCircuitSignals', () => {
    it('maps activityProofSiblings → pathElements', () => {
      const inputs = {
        activityRoot: '999',
        minDays: 3,
        currentTimestamp: 1700000000,
        activityDates: ['1', '2', '0'],
        activityProofSiblings: [['a'], ['b'], ['c']],
        activityProofPathIndices: [[0], [1], [0]],
      };

      const signals = verifiedBuilderToCircuitSignals(inputs);

      expect(signals.pathElements).toBe(inputs.activityProofSiblings);
      expect(signals.pathIndices).toBe(inputs.activityProofPathIndices);
      expect(signals.activityRoot).toBe('999');
      expect(signals.activityDates).toBe(inputs.activityDates);
      expect(signals).not.toHaveProperty('activityProofSiblings');
    });
  });

  describe('grantTrackRecordToCircuitSignals', () => {
    it('maps grantCompletionFlags → completionFlags', () => {
      const inputs = {
        grantRoot: '111',
        minGrants: 1,
        programsRoot: '222',
        grantIds: ['1'],
        grantCompletionFlags: [1],
        grantProofSiblings: [['a']],
        grantProofPathIndices: [[0]],
        programIds: ['3'],
        programProofSiblings: [['b']],
        programProofPathIndices: [[1]],
      };

      const signals = grantTrackRecordToCircuitSignals(inputs);

      expect(signals.completionFlags).toBe(inputs.grantCompletionFlags);
      expect(signals.grantPathElements).toBe(inputs.grantProofSiblings);
      expect(signals.grantPathIndices).toBe(inputs.grantProofPathIndices);
      expect(signals.programPathElements).toBe(inputs.programProofSiblings);
      expect(signals.programPathIndices).toBe(inputs.programProofPathIndices);
      expect(signals).not.toHaveProperty('grantCompletionFlags');
      expect(signals).not.toHaveProperty('grantProofSiblings');
    });
  });

  describe('teamAttestationToCircuitSignals', () => {
    it('splits attesterPubKeys into X/Y arrays', () => {
      const inputs = {
        attestersRoot: '888',
        minAttestations: 1,
        credentialType: 1,
        attesterPubKeys: [
          ['100', '200'],
          ['300', '400'],
        ],
        attestationSignatures: [
          ['10', '20', '30'],
          ['40', '50', '60'],
        ],
        attestationMessages: ['msg1', 'msg2'],
        attesterProofSiblings: [['a'], ['b']],
        attesterProofPathIndices: [[0], [1]],
      };

      const signals = teamAttestationToCircuitSignals(inputs);

      expect(signals.attesterPubKeyX).toEqual(['100', '300']);
      expect(signals.attesterPubKeyY).toEqual(['200', '400']);
      expect(signals.signatureR8X).toEqual(['10', '40']);
      expect(signals.signatureR8Y).toEqual(['20', '50']);
      expect(signals.signatureS).toEqual(['30', '60']);
      expect(signals.attesterPathElements).toBe(inputs.attesterProofSiblings);
      expect(signals.attesterPathIndices).toBe(inputs.attesterProofPathIndices);
      expect(signals).not.toHaveProperty('attesterPubKeys');
      expect(signals).not.toHaveProperty('attestationSignatures');
    });
  });
});
