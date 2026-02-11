/**
 * Circuit Input Preparation
 *
 * Transforms high-level application data into circuit-ready inputs.
 * Handles: Poseidon hashing of IDs, zero-padding arrays to fixed sizes,
 * and structuring Merkle proofs. This layer sits between the application
 * (which has variable-length data) and the circuits (which need fixed-size arrays).
 */

import type {
  VerifiedBuilderInputs,
  GrantTrackRecordInputs,
  TeamAttestationInputs,
} from '@/types/zk';
import { ZK_CIRCUIT_PARAMS } from '@/lib/constants';
import { poseidonHash, poseidonHashString } from './poseidon';

/** Merkle proof for a single leaf */
interface MerkleProofData {
  siblings: string[];
  pathIndices: number[];
}

/** Zero-pad an array of strings to a fixed length */
function padStringArray(arr: string[], targetLength: number): string[] {
  if (arr.length > targetLength) {
    throw new Error(
      `Array length ${arr.length} exceeds target length ${targetLength}`
    );
  }
  const result = [...arr];
  while (result.length < targetLength) {
    result.push('0');
  }
  return result;
}

/** Zero-pad an array of numbers to a fixed length */
function padNumberArray(arr: number[], targetLength: number): number[] {
  if (arr.length > targetLength) {
    throw new Error(
      `Array length ${arr.length} exceeds target length ${targetLength}`
    );
  }
  const result = [...arr];
  while (result.length < targetLength) {
    result.push(0);
  }
  return result;
}

/** Zero-pad Merkle proof arrays to fixed dimensions */
function padMerkleProofs(
  proofs: MerkleProofData[],
  targetCount: number,
  merkleDepth: number
): { siblings: string[][]; pathIndices: number[][] } {
  if (proofs.length > targetCount) {
    throw new Error(
      `Proof count ${proofs.length} exceeds target count ${targetCount}`
    );
  }

  const emptyProof: MerkleProofData = {
    siblings: new Array(merkleDepth).fill('0'),
    pathIndices: new Array(merkleDepth).fill(0),
  };

  const paddedProofs = [...proofs];
  while (paddedProofs.length < targetCount) {
    paddedProofs.push(emptyProof);
  }

  return {
    siblings: paddedProofs.map((p) => padStringArray(p.siblings, merkleDepth)),
    pathIndices: paddedProofs.map((p) => padNumberArray(p.pathIndices, merkleDepth)),
  };
}

// ---------------------------------------------------------------------------
// Verified Builder
// ---------------------------------------------------------------------------

/** Raw application data for verified builder proof */
export interface VerifiedBuilderData {
  /** UNIX timestamps of active days */
  activityTimestamps: number[];
  /** Merkle proofs for each activity in the activity tree */
  activityProofs: MerkleProofData[];
  /** Merkle root of the activity tree */
  activityRoot: string;
  /** Minimum days to prove */
  minDays: number;
  /** Current UNIX timestamp */
  currentTimestamp: number;
}

/**
 * Prepare inputs for the verified-builder circuit.
 *
 * Hashes each activity timestamp via Poseidon and pads arrays
 * to the circuit's fixed maxDays size.
 */
export async function prepareVerifiedBuilderInputs(
  data: VerifiedBuilderData
): Promise<VerifiedBuilderInputs> {
  const { maxDays, merkleDepth } = ZK_CIRCUIT_PARAMS['verified-builder'];

  // Hash each activity timestamp
  const hashedDates: string[] = [];
  for (const ts of data.activityTimestamps) {
    const hash = await poseidonHash([BigInt(ts)]);
    hashedDates.push(hash);
  }

  // Pad to fixed size
  const activityDates = padStringArray(hashedDates, maxDays);
  const { siblings, pathIndices } = padMerkleProofs(
    data.activityProofs,
    maxDays,
    merkleDepth
  );

  return {
    activityRoot: data.activityRoot,
    minDays: data.minDays,
    currentTimestamp: data.currentTimestamp,
    activityDates,
    activityProofSiblings: siblings,
    activityProofPathIndices: pathIndices,
  };
}

// ---------------------------------------------------------------------------
// Grant Track Record
// ---------------------------------------------------------------------------

/** Raw application data for grant track record proof */
export interface GrantTrackRecordData {
  /** Grant records with IDs, completion status, and proofs */
  grants: Array<{
    grantId: string;
    isCompleted: boolean;
    grantProof: MerkleProofData;
    programId: string;
    programProof: MerkleProofData;
  }>;
  /** Merkle root of the grant tree */
  grantRoot: string;
  /** Merkle root of the programs tree */
  programsRoot: string;
  /** Minimum completed grants to prove */
  minGrants: number;
}

/**
 * Prepare inputs for the grant-track-record circuit.
 *
 * Hashes grant and program IDs via Poseidon (chunked for long strings),
 * converts booleans to flags, and pads all arrays to fixed sizes.
 */
export async function prepareGrantTrackRecordInputs(
  data: GrantTrackRecordData
): Promise<GrantTrackRecordInputs> {
  const { maxGrants, grantMerkleDepth, programMerkleDepth } =
    ZK_CIRCUIT_PARAMS['grant-track-record'];

  // Hash IDs and prepare flags
  const grantIds: string[] = [];
  const completionFlags: number[] = [];
  const grantProofs: MerkleProofData[] = [];
  const programIds: string[] = [];
  const programProofs: MerkleProofData[] = [];

  for (const grant of data.grants) {
    const grantIdHash = await poseidonHashString(grant.grantId);
    grantIds.push(grantIdHash);
    completionFlags.push(grant.isCompleted ? 1 : 0);
    grantProofs.push(grant.grantProof);

    const programIdHash = await poseidonHashString(grant.programId);
    programIds.push(programIdHash);
    programProofs.push(grant.programProof);
  }

  // Pad to fixed sizes
  const paddedGrantIds = padStringArray(grantIds, maxGrants);
  const paddedCompletionFlags = padNumberArray(completionFlags, maxGrants);
  const paddedProgramIds = padStringArray(programIds, maxGrants);

  const paddedGrantProofs = padMerkleProofs(grantProofs, maxGrants, grantMerkleDepth);
  const paddedProgramProofs = padMerkleProofs(programProofs, maxGrants, programMerkleDepth);

  return {
    grantRoot: data.grantRoot,
    minGrants: data.minGrants,
    programsRoot: data.programsRoot,
    grantIds: paddedGrantIds,
    grantCompletionFlags: paddedCompletionFlags,
    grantProofSiblings: paddedGrantProofs.siblings,
    grantProofPathIndices: paddedGrantProofs.pathIndices,
    programIds: paddedProgramIds,
    programProofSiblings: paddedProgramProofs.siblings,
    programProofPathIndices: paddedProgramProofs.pathIndices,
  };
}

// ---------------------------------------------------------------------------
// Team Attestation
// ---------------------------------------------------------------------------

/** Raw application data for team attestation proof */
export interface TeamAttestationData {
  /** Attestation records */
  attestations: Array<{
    /** Attester's EdDSA public key [X, Y] */
    pubKey: [string, string];
    /** Signature [R8x, R8y, S] */
    signature: [string, string, string];
    /** Hashed message that was signed */
    message: string;
    /** Merkle proof for attester in the attesters tree */
    attesterProof: MerkleProofData;
  }>;
  /** Merkle root of the recognized attesters tree */
  attestersRoot: string;
  /** Minimum attestations to prove */
  minAttestations: number;
  /** Credential type being attested */
  credentialType: number;
}

/**
 * Prepare inputs for the team-attestation circuit.
 *
 * Structures EdDSA signature components and pads arrays
 * to the circuit's fixed maxAttestations size.
 */
export async function prepareTeamAttestationInputs(
  data: TeamAttestationData
): Promise<TeamAttestationInputs> {
  const { maxAttestations, merkleDepth: attesterMerkleDepth } =
    ZK_CIRCUIT_PARAMS['team-attestation'];

  // Extract components from attestation data
  const pubKeys: string[][] = data.attestations.map((a) => [...a.pubKey]);
  const signatures: string[][] = data.attestations.map((a) => [...a.signature]);
  const messages: string[] = data.attestations.map((a) => a.message);
  const proofs: MerkleProofData[] = data.attestations.map((a) => a.attesterProof);

  // Pad pubkeys (each is [X, Y])
  while (pubKeys.length < maxAttestations) {
    pubKeys.push(['0', '0']);
  }

  // Pad signatures (each is [R8x, R8y, S])
  while (signatures.length < maxAttestations) {
    signatures.push(['0', '0', '0']);
  }

  // Pad messages
  const paddedMessages = padStringArray(messages, maxAttestations);

  // Pad Merkle proofs
  const paddedProofs = padMerkleProofs(proofs, maxAttestations, attesterMerkleDepth);

  return {
    attestersRoot: data.attestersRoot,
    minAttestations: data.minAttestations,
    credentialType: data.credentialType,
    attesterPubKeys: pubKeys,
    attestationSignatures: signatures,
    attestationMessages: paddedMessages,
    attesterProofSiblings: paddedProofs.siblings,
    attesterProofPathIndices: paddedProofs.pathIndices,
  };
}

// ---------------------------------------------------------------------------
// Signal Name Mappers (Fix #5)
//
// These functions bridge the gap between application-level TS types
// (e.g. activityProofSiblings) and circuit signal names (e.g. pathElements).
// They are used when passing prepared inputs to snarkjs.groth16.fullProve().
// ---------------------------------------------------------------------------

/** Circuit signal names for verified-builder */
export interface VerifiedBuilderCircuitSignals {
  activityRoot: string;
  minDays: number;
  currentTimestamp: number;
  activityDates: string[];
  pathElements: string[][];
  pathIndices: number[][];
}

/** Map VerifiedBuilderInputs to circuit signal names */
export function verifiedBuilderToCircuitSignals(
  inputs: VerifiedBuilderInputs
): VerifiedBuilderCircuitSignals {
  return {
    activityRoot: inputs.activityRoot,
    minDays: inputs.minDays,
    currentTimestamp: inputs.currentTimestamp,
    activityDates: inputs.activityDates,
    pathElements: inputs.activityProofSiblings,
    pathIndices: inputs.activityProofPathIndices,
  };
}

/** Circuit signal names for grant-track-record */
export interface GrantTrackRecordCircuitSignals {
  grantRoot: string;
  minGrants: number;
  programsRoot: string;
  grantIds: string[];
  completionFlags: number[];
  grantPathElements: string[][];
  grantPathIndices: number[][];
  programIds: string[];
  programPathElements: string[][];
  programPathIndices: number[][];
}

/** Map GrantTrackRecordInputs to circuit signal names */
export function grantTrackRecordToCircuitSignals(
  inputs: GrantTrackRecordInputs
): GrantTrackRecordCircuitSignals {
  return {
    grantRoot: inputs.grantRoot,
    minGrants: inputs.minGrants,
    programsRoot: inputs.programsRoot,
    grantIds: inputs.grantIds,
    completionFlags: inputs.grantCompletionFlags,
    grantPathElements: inputs.grantProofSiblings,
    grantPathIndices: inputs.grantProofPathIndices,
    programIds: inputs.programIds,
    programPathElements: inputs.programProofSiblings,
    programPathIndices: inputs.programProofPathIndices,
  };
}

/** Circuit signal names for team-attestation */
export interface TeamAttestationCircuitSignals {
  attestersRoot: string;
  minAttestations: number;
  credentialType: number;
  attesterPubKeyX: string[];
  attesterPubKeyY: string[];
  signatureR8X: string[];
  signatureR8Y: string[];
  signatureS: string[];
  attestationMessages: string[];
  attesterPathElements: string[][];
  attesterPathIndices: number[][];
}

/** Map TeamAttestationInputs to circuit signal names */
export function teamAttestationToCircuitSignals(
  inputs: TeamAttestationInputs
): TeamAttestationCircuitSignals {
  return {
    attestersRoot: inputs.attestersRoot,
    minAttestations: inputs.minAttestations,
    credentialType: inputs.credentialType,
    attesterPubKeyX: inputs.attesterPubKeys.map((pk) => pk[0]!),
    attesterPubKeyY: inputs.attesterPubKeys.map((pk) => pk[1]!),
    signatureR8X: inputs.attestationSignatures.map((s) => s[0]!),
    signatureR8Y: inputs.attestationSignatures.map((s) => s[1]!),
    signatureS: inputs.attestationSignatures.map((s) => s[2]!),
    attestationMessages: inputs.attestationMessages,
    attesterPathElements: inputs.attesterProofSiblings,
    attesterPathIndices: inputs.attesterProofPathIndices,
  };
}
