/**
 * Zero-knowledge proof types for Private Grant Studio.
 * Handles ZK credential generation and verification for privacy-preserving attestations.
 */

/** ZK circuit identifiers */
export type ZKCircuit =
  | 'grant-eligibility'
  | 'milestone-completion'
  | 'fund-usage'
  | 'team-verification'
  | 'credential-ownership';

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

/** Grant eligibility proof inputs */
export interface GrantEligibilityInputs {
  /** Public: Minimum funding threshold met (boolean as 0/1) */
  meetsMinimum: number;
  /** Public: Grant program identifier hash */
  programHash: string;
  /** Private: Actual requested amount */
  requestedAmount: number;
  /** Private: Team size */
  teamSize: number;
  /** Private: Project category */
  category: string;
}

/** Milestone completion proof inputs */
export interface MilestoneCompletionInputs {
  /** Public: Milestone identifier hash */
  milestoneHash: string;
  /** Public: Completion claimed (boolean as 0/1) */
  isComplete: number;
  /** Private: Deliverables hashes */
  deliverableHashes: string[];
  /** Private: Evidence hashes */
  evidenceHashes: string[];
  /** Private: Completion date timestamp */
  completionTimestamp: number;
}

/** Fund usage proof inputs */
export interface FundUsageInputs {
  /** Public: Total funds received */
  totalReceived: string;
  /** Public: Percentage used within budget (0-100) */
  percentageUsed: number;
  /** Private: Individual expense amounts */
  expenses: number[];
  /** Private: Expense category hashes */
  categoryHashes: string[];
  /** Private: Remaining balance */
  remainingBalance: number;
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
