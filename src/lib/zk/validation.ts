/**
 * Circuit Input Validation
 *
 * Zod schemas for validating circuit inputs before proof generation.
 * Catches dimension mismatches, out-of-range values, and missing fields
 * before they reach the WASM prover (which gives cryptic errors).
 */

import { z } from 'zod';
import type { ZKCircuit, CircuitInputsMap } from '@/types/zk';
import { ZK_CIRCUIT_PARAMS } from '@/lib/constants';
import { InputValidationError } from './errors';

/** BN128 curve field prime — values must be strictly less than this */
const BN128_FIELD_SIZE = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

/** Bigint-compatible string (canonical decimal representation of a field element within BN128 range) */
const fieldElement = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, 'Must be a canonical decimal string (no leading zeros, no hex, no sign)')
  .refine((val) => {
    try {
      return BigInt(val) < BN128_FIELD_SIZE;
    } catch {
      return false;
    }
  }, 'Value must be less than the BN128 field prime');

/** Binary flag (0 or 1) */
const binaryFlag = z.number().int().min(0).max(1);

// ---------------------------------------------------------------------------
// Per-circuit schemas
// ---------------------------------------------------------------------------

const { maxDays, merkleDepth } = ZK_CIRCUIT_PARAMS['verified-builder'];

const verifiedBuilderSchema = z.object({
  activityRoot: fieldElement,
  minDays: z.number().int().min(1).max(maxDays),
  currentTimestamp: z.number().int().positive(),
  activityDates: z
    .array(fieldElement)
    .length(maxDays, `Must have exactly ${maxDays} entries (zero-pad unused slots)`),
  activityProofSiblings: z
    .array(z.array(fieldElement).length(merkleDepth))
    .length(maxDays),
  activityProofPathIndices: z
    .array(z.array(binaryFlag).length(merkleDepth))
    .length(maxDays),
});

const {
  maxGrants,
  grantMerkleDepth,
  programMerkleDepth,
} = ZK_CIRCUIT_PARAMS['grant-track-record'];

const grantTrackRecordSchema = z.object({
  grantRoot: fieldElement,
  minGrants: z.number().int().min(1).max(maxGrants),
  programsRoot: fieldElement,
  grantIds: z
    .array(fieldElement)
    .length(maxGrants, `Must have exactly ${maxGrants} entries (zero-pad unused slots)`),
  grantCompletionFlags: z.array(binaryFlag).length(maxGrants),
  grantProofSiblings: z
    .array(z.array(fieldElement).length(grantMerkleDepth))
    .length(maxGrants),
  grantProofPathIndices: z
    .array(z.array(binaryFlag).length(grantMerkleDepth))
    .length(maxGrants),
  programIds: z.array(fieldElement).length(maxGrants),
  programProofSiblings: z
    .array(z.array(fieldElement).length(programMerkleDepth))
    .length(maxGrants),
  programProofPathIndices: z
    .array(z.array(binaryFlag).length(programMerkleDepth))
    .length(maxGrants),
});

const { maxAttestations, merkleDepth: attesterMerkleDepth } =
  ZK_CIRCUIT_PARAMS['team-attestation'];

const teamAttestationSchema = z.object({
  attestersRoot: fieldElement,
  minAttestations: z.number().int().min(1).max(maxAttestations),
  credentialType: z.number().int().nonnegative(),
  attesterPubKeys: z
    .array(z.array(fieldElement).length(2))
    .length(maxAttestations, `Must have exactly ${maxAttestations} entries`),
  attestationSignatures: z
    .array(z.array(fieldElement).length(3))
    .length(maxAttestations),
  attestationMessages: z.array(fieldElement).length(maxAttestations),
  attesterProofSiblings: z
    .array(z.array(fieldElement).length(attesterMerkleDepth))
    .length(maxAttestations),
  attesterProofPathIndices: z
    .array(z.array(binaryFlag).length(attesterMerkleDepth))
    .length(maxAttestations),
});

/** Map of circuit IDs to their Zod schemas */
const CIRCUIT_SCHEMAS: Record<ZKCircuit, z.ZodType> = {
  'verified-builder': verifiedBuilderSchema,
  'grant-track-record': grantTrackRecordSchema,
  'team-attestation': teamAttestationSchema,
};

/**
 * Validate circuit inputs against the appropriate schema.
 *
 * @param circuitId - Circuit to validate inputs for
 * @param inputs - Raw inputs to validate
 * @throws InputValidationError with detailed field-level errors
 * @returns Validated and typed inputs
 */
export function validateCircuitInputs<T extends ZKCircuit>(
  circuitId: T,
  inputs: unknown
): CircuitInputsMap[T] {
  const schema = CIRCUIT_SCHEMAS[circuitId];
  const result = schema.safeParse(inputs);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new InputValidationError(circuitId, errors);
  }

  return result.data as CircuitInputsMap[T];
}

/**
 * Get the Zod schema for a specific circuit (useful for external validation).
 */
export function getCircuitSchema(circuitId: ZKCircuit): z.ZodType {
  return CIRCUIT_SCHEMAS[circuitId];
}
