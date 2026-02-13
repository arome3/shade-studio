/**
 * Zero-knowledge proof types for Private Grant Studio.
 * Handles ZK credential generation and verification for privacy-preserving attestations.
 *
 * Circuits:
 * - verified-builder: Prove activity history without revealing specific actions
 * - grant-track-record: Prove grant history without revealing amounts/details
 * - team-attestation: Prove team endorsements without revealing attesters
 */

/** ZK circuit identifiers — matches compiled Circom circuit names */
export type ZKCircuit =
  | 'verified-builder'
  | 'grant-track-record'
  | 'team-attestation';

/** ZK proof status */
export type ProofStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'verified'
  | 'failed'
  | 'expired';

/** ZK circuit artifacts */
export interface CircuitArtifacts {
  /** Circuit identifier */
  circuitId: ZKCircuit;
  /** WASM file URL/path */
  wasmUrl: string;
  /** Proving key URL/path */
  zkeyUrl: string;
  /** Verification key */
  verificationKey: object;
  /** Circuit version */
  version: string;
  /** Last updated */
  updatedAt: string;
}

/** Public inputs for ZK proof */
export interface PublicInputs {
  /** Circuit-specific public inputs */
  [key: string]: string | number | boolean | string[] | number[];
}

/** Private inputs (witness) for ZK proof */
export interface PrivateInputs {
  /** Circuit-specific private inputs */
  [key: string]: string | number | boolean | string[] | number[];
}

/** ZK proof data structure */
export interface ZKProof {
  /** Proof identifier */
  id: string;
  /** Circuit used */
  circuit: ZKCircuit;
  /** Proof data (pi_a, pi_b, pi_c for Groth16) */
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: 'groth16';
    curve: 'bn128';
  };
  /** Public inputs/signals */
  publicSignals: string[];
  /** Proof status */
  status: ProofStatus;
  /** Generation timestamp */
  generatedAt: string;
  /** Verification timestamp if verified */
  verifiedAt?: string;
  /** Expiration timestamp */
  expiresAt?: string;
}

/** Bundle of multiple proofs for composite credential verification */
export interface ProofBundle {
  /** Bundle identifier */
  id: string;
  /** Generated proofs */
  proofs: ZKProof[];
  /** Circuits included in this bundle */
  circuits: ZKCircuit[];
  /** Bundle generation status */
  status: 'pending' | 'generating' | 'complete' | 'partial' | 'failed';
  /** Bundle creation timestamp */
  createdAt: string;
  /** Bundle completion timestamp */
  completedAt?: string;
  /** Per-circuit errors if any */
  errors: Array<{ circuit: ZKCircuit; error: string }>;
}

/** ZK credential for on-chain verification */
export interface ZKCredential {
  /** Credential identifier */
  id: string;
  /** Holder's NEAR account ID */
  holderId: string;
  /** Credential type */
  type: ZKCircuit;
  /** Associated proof */
  proof: ZKProof;
  /** Credential metadata (public) */
  metadata: {
    issuer: string;
    issuedAt: string;
    expiresAt?: string;
    revocable: boolean;
  };
  /** On-chain verification transaction if verified */
  verificationTx?: string;
  /** Creation timestamp */
  createdAt: string;
}

/** Verified builder circuit inputs — proves activity history */
export interface VerifiedBuilderInputs {
  /** Public: Merkle root of the activity tree */
  activityRoot: string;
  /** Public: Minimum active days required */
  minDays: number;
  /** Public: Current timestamp for range validation */
  currentTimestamp: number;
  /** Private: Activity date hashes (Poseidon-hashed timestamps) */
  activityDates: string[];
  /** Private: Merkle proof siblings for each activity */
  activityProofSiblings: string[][];
  /** Private: Merkle proof path indices */
  activityProofPathIndices: number[][];
}

/** Grant track record circuit inputs — proves grant history */
export interface GrantTrackRecordInputs {
  /** Public: Merkle root of the grant tree */
  grantRoot: string;
  /** Public: Minimum number of grants completed */
  minGrants: number;
  /** Public: Merkle root of the programs tree */
  programsRoot: string;
  /** Private: Grant ID hashes */
  grantIds: string[];
  /** Private: Grant completion status flags (0 or 1) */
  grantCompletionFlags: number[];
  /** Private: Merkle proof siblings for grant tree */
  grantProofSiblings: string[][];
  /** Private: Merkle proof path indices for grant tree */
  grantProofPathIndices: number[][];
  /** Private: Program ID hashes for each grant */
  programIds: string[];
  /** Private: Merkle proof siblings for program tree */
  programProofSiblings: string[][];
  /** Private: Merkle proof path indices for program tree */
  programProofPathIndices: number[][];
}

/** Team attestation circuit inputs — proves team endorsements */
export interface TeamAttestationInputs {
  /** Public: Merkle root of the attesters tree */
  attestersRoot: string;
  /** Public: Minimum number of attestations required */
  minAttestations: number;
  /** Public: Credential type being attested */
  credentialType: number;
  /** Private: Attester public keys (EdDSA) */
  attesterPubKeys: string[][];
  /** Private: Attestation signatures (EdDSA Poseidon) */
  attestationSignatures: string[][];
  /** Private: Attestation message hashes */
  attestationMessages: string[];
  /** Private: Merkle proof siblings for attesters tree */
  attesterProofSiblings: string[][];
  /** Private: Merkle proof path indices for attesters tree */
  attesterProofPathIndices: number[][];
}

/** Maps circuit names to their typed inputs */
export interface CircuitInputsMap {
  'verified-builder': VerifiedBuilderInputs;
  'grant-track-record': GrantTrackRecordInputs;
  'team-attestation': TeamAttestationInputs;
}

/** Circuit configuration metadata */
export interface CircuitConfig {
  /** Circuit identifier */
  id: ZKCircuit;
  /** Human-readable display name */
  name: string;
  /** Description of what the circuit proves */
  description: string;
  /** Circuit version */
  version: string;
  /** Circuit-specific parameters (max array sizes, Merkle depths, etc.) */
  params: Record<string, number>;
  /** Estimated constraint count */
  estimatedConstraints: number;
  /** Path to WASM artifact (relative to public/) */
  wasmPath: string;
  /** Path to zkey artifact (relative to public/) */
  zkeyPath: string;
  /** Path to verification key JSON */
  vkeyPath: string;
  /** SHA-256 hex hash of WASM artifact (optional — check skipped if absent) */
  wasmHash?: string;
  /** SHA-256 hex hash of zkey artifact (optional — check skipped if absent) */
  zkeyHash?: string;
  /** SHA-256 hex hash of vkey JSON file (optional — check skipped if absent) */
  vkeyHash?: string;
}

/** Proof generation request */
export interface ProofGenerationRequest {
  /** Circuit to use */
  circuit: ZKCircuit;
  /** Public inputs */
  publicInputs: PublicInputs;
  /** Private inputs (witness) */
  privateInputs: PrivateInputs;
  /** Optional callback URL for async generation */
  callbackUrl?: string;
}

/** Proof verification request */
export interface ProofVerificationRequest {
  /** Proof to verify */
  proof: ZKProof;
  /** Expected public signals (for validation) */
  expectedPublicSignals?: string[];
}

/** Proof verification result */
export interface ProofVerificationResult {
  /** Whether proof is valid */
  isValid: boolean;
  /** Verification timestamp */
  timestamp: string;
  /** Error message if invalid */
  error?: string;
  /** Verification method used */
  method: 'local' | 'on-chain';
  /** Transaction hash if on-chain */
  transactionHash?: string;
}

/** ZK prover state */
export interface ProverState {
  /** Whether prover is initialized */
  isInitialized: boolean;
  /** Loaded circuits */
  loadedCircuits: ZKCircuit[];
  /** Current operation if any */
  currentOperation?: {
    circuit: ZKCircuit;
    status: 'loading' | 'proving' | 'verifying';
    progress: number;
  };
  /** Last error if any */
  lastError?: string;
}

/** Circuit loading progress */
export interface CircuitLoadProgress {
  /** Circuit being loaded */
  circuit: ZKCircuit;
  /** Current phase */
  phase: 'downloading' | 'parsing' | 'initializing';
  /** Progress percentage (0-100) */
  progress: number;
  /** Bytes downloaded */
  bytesDownloaded?: number;
  /** Total bytes */
  totalBytes?: number;
}
