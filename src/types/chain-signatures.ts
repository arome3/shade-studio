/**
 * Chain Signatures types for cross-chain grant submission.
 *
 * NEAR's MPC network enables signing EVM transactions without MetaMask.
 * One NEAR account derives addresses on any EVM chain via deterministic
 * derivation paths through the MPC contract.
 */

import { z } from 'zod';

// ============================================================================
// Chain Configuration
// ============================================================================

/** Supported EVM chain identifiers */
export type EVMChainId = 'ethereum' | 'optimism' | 'arbitrum' | 'polygon' | 'base';

/** Configuration for a supported EVM chain */
export interface ChainConfig {
  /** Internal chain identifier */
  id: EVMChainId;
  /** Human-readable chain name */
  name: string;
  /** EVM numeric chain ID */
  chainId: number;
  /** JSON-RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Native currency symbol */
  symbol: string;
  /** MPC derivation path for this chain */
  mpcPath: string;
}

// ============================================================================
// MPC Signature Types
// ============================================================================

/** Raw MPC signature response from the NEAR signer contract */
export interface MPCSignatureResponse {
  big_r: {
    affine_point: string;
  };
  s: {
    scalar: string;
  };
  recovery_id: number;
}

/** Zod schema for runtime validation of MPC signature responses */
export const MPCSignatureResponseSchema = z.object({
  big_r: z.object({
    affine_point: z.string().min(1),
  }),
  s: z.object({
    scalar: z.string().min(1),
  }),
  recovery_id: z.number().int().min(0).max(3),
});

// ============================================================================
// EVM Transaction Types
// ============================================================================

/** Unsigned EVM transaction fields (EIP-1559) */
export interface UnsignedEVMTransaction {
  /** Target contract or recipient address */
  to: string;
  /** Value in wei */
  value: string;
  /** Encoded calldata */
  data: string;
  /** Sender nonce */
  nonce: number;
  /** Max fee per gas in wei */
  maxFeePerGas: string;
  /** Max priority fee (tip) per gas in wei */
  maxPriorityFeePerGas: string;
  /** Gas limit */
  gasLimit: string;
  /** EVM chain ID */
  chainId: number;
  /** Transaction type (2 = EIP-1559) */
  type: 2;
}

// ============================================================================
// Submission Flow Types
// ============================================================================

/** Steps in the cross-chain submission pipeline */
export type SubmissionStep =
  | 'deriving-address'
  | 'building-tx'
  | 'simulating'
  | 'requesting-signature'
  | 'assembling-tx'
  | 'broadcasting'
  | 'confirming'
  | 'complete'
  | 'failed';

/** Human-readable labels for each submission step */
export const SUBMISSION_STEP_LABELS: Record<SubmissionStep, string> = {
  'deriving-address': 'Deriving EVM address',
  'building-tx': 'Building transaction',
  simulating: 'Simulating transaction',
  'requesting-signature': 'Requesting MPC signature',
  'assembling-tx': 'Assembling signed transaction',
  broadcasting: 'Broadcasting to network',
  confirming: 'Waiting for confirmation',
  complete: 'Transaction confirmed',
  failed: 'Submission failed',
};

/** Ordered steps for progress tracking (excludes terminal states) */
export const SUBMISSION_STEP_ORDER: SubmissionStep[] = [
  'deriving-address',
  'building-tx',
  'simulating',
  'requesting-signature',
  'assembling-tx',
  'broadcasting',
  'confirming',
  'complete',
];

/** Full cross-chain submission record */
export interface CrossChainSubmission {
  /** Unique submission ID */
  id: string;
  /** Associated proposal ID */
  proposalId: string;
  /** Target EVM chain */
  chain: EVMChainId;
  /** Current step in the pipeline */
  currentStep: SubmissionStep;
  /** The step that was active when failure occurred */
  failedAtStep?: SubmissionStep;
  /** EVM transaction hash (set after broadcast) */
  txHash?: string;
  /** Derived EVM address used for submission */
  evmAddress?: string;
  /** Error message if failed */
  error?: string;
  /** Submission start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
}

/** Cached NEAR-to-EVM address derivation */
export interface DerivedAddress {
  /** NEAR account ID that owns this derivation */
  nearAccountId: string;
  /** Target EVM chain */
  chain: EVMChainId;
  /** Derived EVM address (0x...) */
  evmAddress: string;
  /** When the address was derived */
  derivedAt: string;
}

// ============================================================================
// Cross-Chain Submit Parameters
// ============================================================================

/** Parameters for a cross-chain grant submission */
export interface CrossChainSubmitParams {
  /** Proposal ID being submitted */
  proposalId: string;
  /** Target EVM chain */
  chain: EVMChainId;
  /** Target contract address on the EVM chain */
  contractAddress: string;
  /** ABI-encoded calldata for the submission */
  calldata: string;
  /** Value to send in wei (default: "0") */
  value?: string;
}

/** Parameters for Gitcoin Allo Protocol submission */
export interface GitcoinSubmitParams {
  proposalId: string;
  /** Allo Protocol pool ID */
  poolId: string;
  /** Project metadata IPFS CID */
  metadataCid: string;
  /** Recipient address on Ethereum */
  recipientAddress: string;
}

/** Parameters for Optimism RPGF submission */
export interface OptimismRPGFParams {
  proposalId: string;
  /** Project name */
  projectName: string;
  /** Project metadata IPFS CID */
  metadataCid: string;
  /** Application round contract address */
  roundContract: string;
}

/** Progress callback for submission steps */
export type SubmissionProgressCallback = (step: SubmissionStep) => void;
