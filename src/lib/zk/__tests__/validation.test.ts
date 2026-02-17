import { describe, it, expect } from 'vitest';
import { validateCircuitInputs, getCircuitSchema } from '../validation';
import { InputValidationError } from '../errors';

/** Helper to create a valid verified-builder input */
function makeValidVerifiedBuilderInputs() {
  const maxDays = 30;
  const merkleDepth = 20;
  return {
    activityRoot: '12345678901234567890',
    minDays: 3,
    currentTimestamp: 1700000000,
    activityDates: Array(maxDays).fill('0'),
    activityProofSiblings: Array(maxDays).fill(Array(merkleDepth).fill('0')),
    activityProofPathIndices: Array(maxDays).fill(Array(merkleDepth).fill(0)),
  };
}

/** Helper to create a valid grant-track-record input */
function makeValidGrantTrackRecordInputs() {
  const maxGrants = 10;
  const grantDepth = 15;
  const programDepth = 10;
  return {
    grantRoot: '12345678901234567890',
    minGrants: 3,
    programsRoot: '98765432109876543210',
    grantIds: Array(maxGrants).fill('0'),
    grantCompletionFlags: Array(maxGrants).fill(0),
    grantProofSiblings: Array(maxGrants).fill(Array(grantDepth).fill('0')),
    grantProofPathIndices: Array(maxGrants).fill(Array(grantDepth).fill(0)),
    programIds: Array(maxGrants).fill('0'),
    programProofSiblings: Array(maxGrants).fill(Array(programDepth).fill('0')),
    programProofPathIndices: Array(maxGrants).fill(Array(programDepth).fill(0)),
  };
}

/** Helper to create valid team-attestation inputs */
function makeValidTeamAttestationInputs() {
  const maxAttestations = 5;
  const depth = 20;
  return {
    attestersRoot: '12345678901234567890',
    minAttestations: 2,
    credentialType: 1,
    attesterPubKeys: Array(maxAttestations).fill(['0', '0']),
    attestationSignatures: Array(maxAttestations).fill(['0', '0', '0']),
    attestationMessages: Array(maxAttestations).fill('0'),
    attesterProofSiblings: Array(maxAttestations).fill(Array(depth).fill('0')),
    attesterProofPathIndices: Array(maxAttestations).fill(Array(depth).fill(0)),
  };
}

describe('Input Validation', () => {
  describe('verified-builder', () => {
    it('accepts valid inputs', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      const result = validateCircuitInputs('verified-builder', inputs);
      expect(result.minDays).toBe(3);
      expect(result.activityDates).toHaveLength(30);
    });

    it('rejects missing activityRoot', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      delete (inputs as Record<string, unknown>).activityRoot;
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects minDays = 0', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.minDays = 0;
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects minDays > maxDays', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.minDays = 500;
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects wrong array length for activityDates', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityDates = Array(10).fill('0'); // Not 30
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects non-decimal string in field elements', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = 'not-a-number';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('error includes detailed field info', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.minDays = -1;
      try {
        validateCircuitInputs('verified-builder', inputs);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InputValidationError);
        const validationErr = err as InstanceType<typeof InputValidationError>;
        expect(validationErr.validationErrors.length).toBeGreaterThan(0);
        expect(validationErr.validationErrors[0]?.path).toBeTruthy();
      }
    });
  });

  describe('grant-track-record', () => {
    it('accepts valid inputs', () => {
      const inputs = makeValidGrantTrackRecordInputs();
      const result = validateCircuitInputs('grant-track-record', inputs);
      expect(result.minGrants).toBe(3);
      expect(result.grantIds).toHaveLength(10);
    });

    it('rejects invalid completion flags', () => {
      const inputs = makeValidGrantTrackRecordInputs();
      inputs.grantCompletionFlags[0] = 2; // Must be 0 or 1
      expect(() =>
        validateCircuitInputs('grant-track-record', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects mismatched array lengths', () => {
      const inputs = makeValidGrantTrackRecordInputs();
      inputs.grantIds = Array(5).fill('0'); // Should be 10
      expect(() =>
        validateCircuitInputs('grant-track-record', inputs)
      ).toThrow(InputValidationError);
    });
  });

  describe('team-attestation', () => {
    it('accepts valid inputs', () => {
      const inputs = makeValidTeamAttestationInputs();
      const result = validateCircuitInputs('team-attestation', inputs);
      expect(result.minAttestations).toBe(2);
      expect(result.attesterPubKeys).toHaveLength(5);
    });

    it('rejects negative credentialType', () => {
      const inputs = makeValidTeamAttestationInputs();
      inputs.credentialType = -1;
      expect(() =>
        validateCircuitInputs('team-attestation', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects wrong pubkey dimensions', () => {
      const inputs = makeValidTeamAttestationInputs();
      inputs.attesterPubKeys[0] = ['0']; // Should be [X, Y]
      expect(() =>
        validateCircuitInputs('team-attestation', inputs)
      ).toThrow(InputValidationError);
    });
  });

  describe('field element BN128 range', () => {
    it('rejects values exceeding the BN128 field prime', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      // BN128 field prime
      inputs.activityRoot =
        '21888242871839275222246405745257275088548364400416034343698204186575808495617';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('accepts values just below the BN128 field prime', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot =
        '21888242871839275222246405745257275088548364400416034343698204186575808495616';
      const result = validateCircuitInputs('verified-builder', inputs);
      expect(result.activityRoot).toBe(inputs.activityRoot);
    });
  });

  describe('malicious field element formats', () => {
    it('rejects hex strings ("0x1234")', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '0x1234';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects scientific notation ("1e10")', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '1e10';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects negative values ("-1")', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '-1';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects leading zeros ("000123")', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '000123';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects strings with whitespace', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = ' 123 ';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects empty string as field element', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });

    it('rejects decimal numbers ("3.14")', () => {
      const inputs = makeValidVerifiedBuilderInputs();
      inputs.activityRoot = '3.14';
      expect(() =>
        validateCircuitInputs('verified-builder', inputs)
      ).toThrow(InputValidationError);
    });
  });

  describe('getCircuitSchema', () => {
    it('returns a Zod schema for each circuit', () => {
      const schema = getCircuitSchema('verified-builder');
      expect(schema).toBeDefined();
      expect(typeof schema.safeParse).toBe('function');
    });
  });
});
