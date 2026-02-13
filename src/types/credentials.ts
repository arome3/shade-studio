/**
 * ZK Credentials UI Types
 *
 * Bridge types that unify local ZKProof and OnChainCredential into a single
 * UICredential model consumed by the credentials dashboard components.
 */

import type { ZKCircuit, ZKProof, OnChainCredential } from '@/types/zk';

/** Where the credential data originates */
export type CredentialSource = 'local' | 'on-chain';

/** Unified credential status combining proof status + on-chain state */
export type UICredentialStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'verified'
  | 'on-chain'
  | 'failed'
  | 'expired';

/** Unified credential for UI rendering */
export interface UICredential {
  id: string;
  circuit: ZKCircuit;
  source: CredentialSource;
  status: UICredentialStatus;
  createdAt: string;
  verifiedAt?: string;
  expiresAt?: string;
  isExpired: boolean;
  publicSignals: string[];
  claim?: string;
  owner?: string;
  /** Present only when source === 'local' */
  proof?: ZKProof;
  /** Present only when source === 'on-chain' */
  onChainCredential?: OnChainCredential;
}

/** Filter criteria for credential list */
export interface CredentialFilter {
  circuit?: ZKCircuit;
  status?: UICredentialStatus;
  source?: CredentialSource;
}

/** Aggregate statistics for the credentials dashboard */
export interface CredentialStats {
  total: number;
  localProofs: number;
  onChain: number;
  verified: number;
  expired: number;
  byCircuit: Record<ZKCircuit, number>;
}

/** Display metadata for each circuit type (colors, labels, descriptions) */
export interface CircuitDisplayInfo {
  id: ZKCircuit;
  name: string;
  description: string;
  requirement: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}
