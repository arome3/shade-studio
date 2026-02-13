'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from './use-wallet';
import { useZKProof } from './useZKProof';
import {
  useCredentialStore,
  useCredentialsRecord,
  useCredentialOrder,
  useCredentialsFetching,
  useCredentialsError,
} from '@/stores/credential-store';
import {
  getCredentialsByOwner,
  verifyProofOnContract,
  removeOnChainCredential,
  getCredentialStorageCost,
} from '@/lib/zk/contract-client';
import { getWalletSelector } from '@/lib/near/wallet';
import {
  ContractPausedError,
  InsufficientDepositError,
  ContractCallError,
  ZKError,
} from '@/lib/zk/errors';
import type { ZKCircuit, ZKProof, OnChainCredential } from '@/types/zk';
import type {
  UICredential,
  UICredentialStatus,
  CredentialFilter,
  CredentialStats,
} from '@/types/credentials';

// Re-export canonical circuit display config for backward compatibility
export { CIRCUIT_DISPLAY } from '@/lib/zk/circuit-display';

// ============================================================================
// Helpers
// ============================================================================

function proofStatusToUI(proof: ZKProof): UICredentialStatus {
  if (proof.expiresAt && new Date(proof.expiresAt).getTime() < Date.now()) {
    return 'expired';
  }
  return proof.status as UICredentialStatus;
}

function proofToUICredential(proof: ZKProof): UICredential {
  const isExpired = !!proof.expiresAt && new Date(proof.expiresAt).getTime() < Date.now();
  return {
    id: proof.id,
    circuit: proof.circuit,
    source: 'local',
    status: proofStatusToUI(proof),
    createdAt: proof.generatedAt,
    verifiedAt: proof.verifiedAt,
    expiresAt: proof.expiresAt,
    isExpired,
    publicSignals: proof.publicSignals,
    proof,
  };
}

function onChainToUICredential(cred: OnChainCredential): UICredential {
  const isExpired = cred.expiresAt > 0 && cred.expiresAt * 1000 < Date.now();
  return {
    id: cred.id,
    circuit: cred.circuitType,
    source: 'on-chain',
    status: isExpired ? 'expired' : 'on-chain',
    createdAt: new Date(cred.verifiedAt * 1000).toISOString(),
    verifiedAt: new Date(cred.verifiedAt * 1000).toISOString(),
    expiresAt: cred.expiresAt > 0 ? new Date(cred.expiresAt * 1000).toISOString() : undefined,
    isExpired,
    publicSignals: cred.publicSignals,
    claim: cred.claim,
    owner: cred.owner,
    onChainCredential: cred,
  };
}

/** Build a fingerprint for deduplication: circuit + sorted public signals */
function credentialFingerprint(circuit: ZKCircuit, publicSignals: string[]): string {
  return `${circuit}:${[...publicSignals].sort().join('\0')}`;
}

/** Classify errors into user-friendly messages. */
function classifyHookError(err: unknown, fallback: string): string {
  if (err instanceof ContractPausedError) {
    return 'ZK verifier contract is currently paused. Please try again later.';
  }
  if (err instanceof InsufficientDepositError) {
    const raw = err.details?.required;
    const requiredNear = typeof raw === 'string' && raw !== ''
      ? Number(BigInt(raw)) / 1e24
      : 0;
    return `Insufficient deposit. Required: ${requiredNear.toFixed(4)} NEAR.`;
  }
  if (err instanceof ContractCallError) {
    return `Contract error: ${err.message}`;
  }
  if (err instanceof ZKError) {
    return err.message;
  }
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

// ============================================================================
// Hook return type
// ============================================================================

export interface UseCredentialsReturn {
  // Data
  credentials: UICredential[];
  stats: CredentialStats;

  // State
  isFetching: boolean;
  isStoring: boolean;
  error: string | null;
  isConnected: boolean;
  accountId: string | null;

  // ZK proof delegation
  proofOperation: ReturnType<typeof useZKProof>['currentOperation'];
  isBusy: boolean;

  // Filter
  filter: CredentialFilter;
  setFilter: (filter: CredentialFilter) => void;

  // Actions
  fetchOnChainCredentials: () => Promise<void>;
  storeOnChain: (proofId: string, claim?: string) => Promise<string | null>;
  removeCredential: (id: string, source: 'local' | 'on-chain') => Promise<void>;
  getStorageCost: () => Promise<string>;
  clearError: () => void;
  retryLastAction: () => void;

  // Pass-through from useZKProof
  zkProof: ReturnType<typeof useZKProof>;
}

// ============================================================================
// Hook
// ============================================================================

export function useCredentials(): UseCredentialsReturn {
  const { accountId, isConnected } = useWallet();
  const zkProof = useZKProof();
  const [filter, setFilter] = useState<CredentialFilter>({});
  const [isStoring, setIsStoring] = useState(false);
  const hasFetchedRef = useRef(false);
  const retryActionRef = useRef<(() => void) | null>(null);

  // Credential store selectors
  const credentialsRecord = useCredentialsRecord();
  const credentialOrder = useCredentialOrder();
  const isFetching = useCredentialsFetching();
  const credStoreError = useCredentialsError();

  // Store actions
  const setCredentials = useCredentialStore((s) => s.setCredentials);
  const setFetching = useCredentialStore((s) => s.setFetching);
  const setCredError = useCredentialStore((s) => s.setError);
  const storeRemoveCredential = useCredentialStore((s) => s.removeCredential);

  // Combined error
  const error = credStoreError || zkProof.error;

  // -------------------------------------------------------------------------
  // Merge local proofs + on-chain credentials → UICredential[]
  // -------------------------------------------------------------------------
  const allCredentials = useMemo(() => {
    const onChainFingerprints = new Set<string>();
    const merged: UICredential[] = [];

    // On-chain credentials first (authoritative)
    for (const id of credentialOrder) {
      const cred = credentialsRecord[id];
      if (!cred) continue;
      const ui = onChainToUICredential(cred);
      merged.push(ui);
      onChainFingerprints.add(credentialFingerprint(cred.circuitType, cred.publicSignals));
    }

    // Local proofs — skip duplicates that exist on-chain
    for (const proof of zkProof.proofs) {
      const fp = credentialFingerprint(proof.circuit, proof.publicSignals);
      if (onChainFingerprints.has(fp)) continue;
      merged.push(proofToUICredential(proof));
    }

    // Sort: on-chain first, then by date descending
    merged.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'on-chain' ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return merged;
  }, [credentialsRecord, credentialOrder, zkProof.proofs]);

  // -------------------------------------------------------------------------
  // Filtered credentials
  // -------------------------------------------------------------------------
  const credentials = useMemo(() => {
    return allCredentials.filter((c) => {
      if (filter.circuit && c.circuit !== filter.circuit) return false;
      if (filter.status && c.status !== filter.status) return false;
      if (filter.source && c.source !== filter.source) return false;
      return true;
    });
  }, [allCredentials, filter]);

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  const stats = useMemo((): CredentialStats => {
    const byCircuit: Record<ZKCircuit, number> = {
      'verified-builder': 0,
      'grant-track-record': 0,
      'team-attestation': 0,
    };
    let localProofs = 0;
    let onChain = 0;
    let verified = 0;
    let expired = 0;

    for (const c of allCredentials) {
      byCircuit[c.circuit]++;
      if (c.source === 'local') localProofs++;
      if (c.source === 'on-chain') onChain++;
      if (c.status === 'verified' || c.status === 'on-chain') verified++;
      if (c.isExpired) expired++;
    }

    return {
      total: allCredentials.length,
      localProofs,
      onChain,
      verified,
      expired,
      byCircuit,
    };
  }, [allCredentials]);

  // -------------------------------------------------------------------------
  // Auto-fetch on-chain credentials when wallet connects
  // -------------------------------------------------------------------------
  const fetchOnChainCredentials = useCallback(async () => {
    if (!accountId) return;
    setFetching(true);
    try {
      const PAGE_LIMIT = 50;
      const MAX_PAGES = 100; // Safety cap: 5000 credentials max
      let offset = 0;
      let page = 0;
      const allCredentials: import('@/types/zk').OnChainCredential[] = [];

      // Paginate through all pages
      while (page < MAX_PAGES) {
        const result = await getCredentialsByOwner(accountId, true, undefined, offset, PAGE_LIMIT);
        allCredentials.push(...result.credentials);
        if (!result.has_more) break;
        offset += PAGE_LIMIT;
        page++;
      }

      setCredentials(allCredentials);
    } catch (err) {
      const msg = classifyHookError(err, 'Failed to fetch credentials');
      setCredError(msg);
      retryActionRef.current = () => fetchOnChainCredentials();
    }
  }, [accountId, setFetching, setCredentials, setCredError]);

  useEffect(() => {
    if (isConnected && accountId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchOnChainCredentials();
    }
    if (!isConnected) {
      hasFetchedRef.current = false;
    }
  }, [isConnected, accountId, fetchOnChainCredentials]);

  // -------------------------------------------------------------------------
  // Store proof on-chain (with optimistic update)
  // -------------------------------------------------------------------------
  const storeOnChain = useCallback(
    async (proofId: string, claim?: string): Promise<string | null> => {
      const proof = zkProof.proofs.find((p) => p.id === proofId);
      if (!proof) return null;

      const selector = getWalletSelector();
      if (!selector) return null;

      setIsStoring(true);
      const tempId = `temp-${proofId}`;

      // Optimistic: add placeholder credential to store immediately
      const optimisticCred: OnChainCredential = {
        id: tempId,
        owner: accountId ?? '',
        circuitType: proof.circuit,
        publicSignals: proof.publicSignals,
        verifiedAt: Math.floor(Date.now() / 1000),
        expiresAt: 0,
        claim,
      };
      useCredentialStore.getState().addCredential(optimisticCred);

      try {
        const storageCost = await getCredentialStorageCost();
        const result = await verifyProofOnContract(proof, selector, {
          storeCredential: true,
          claim,
          deposit: storageCost,
        });

        // Remove optimistic placeholder before refresh
        useCredentialStore.getState().removeCredential(tempId);

        if (result.valid && result.credential_id) {
          // Refresh with real on-chain data
          await fetchOnChainCredentials();
          return result.credential_id;
        }
        return null;
      } catch (err) {
        // Rollback optimistic update
        useCredentialStore.getState().removeCredential(tempId);
        const msg = classifyHookError(err, 'Failed to store on chain');
        setCredError(msg);
        retryActionRef.current = () => storeOnChain(proofId, claim);
        return null;
      } finally {
        setIsStoring(false);
      }
    },
    [zkProof.proofs, accountId, fetchOnChainCredentials, setCredError]
  );

  // -------------------------------------------------------------------------
  // Remove credential (with optimistic update for on-chain)
  // -------------------------------------------------------------------------
  const removeCredential = useCallback(
    async (id: string, source: 'local' | 'on-chain') => {
      if (source === 'local') {
        zkProof.removeProof(id);
        return;
      }

      const selector = getWalletSelector();
      if (!selector) return;

      // Save snapshot for rollback
      const snapshot = useCredentialStore.getState().credentials[id];

      // Optimistic: remove from store immediately
      storeRemoveCredential(id);

      try {
        await removeOnChainCredential(id, selector);
      } catch (err) {
        // Rollback: re-add the credential from snapshot
        if (snapshot) {
          useCredentialStore.getState().addCredential(snapshot);
        }
        const msg = classifyHookError(err, 'Failed to remove credential');
        setCredError(msg);
        retryActionRef.current = () => removeCredential(id, source);
      }
    },
    [zkProof, storeRemoveCredential, setCredError]
  );

  // -------------------------------------------------------------------------
  // Storage cost helper
  // -------------------------------------------------------------------------
  const getStorageCost = useCallback(async (): Promise<string> => {
    return getCredentialStorageCost();
  }, []);

  // -------------------------------------------------------------------------
  // Error recovery
  // -------------------------------------------------------------------------
  const clearError = useCallback(() => {
    useCredentialStore.getState().clearError();
    retryActionRef.current = null;
  }, []);

  const retryLastAction = useCallback(() => { retryActionRef.current?.(); }, []);

  return {
    credentials,
    stats,
    isFetching,
    isStoring,
    error,
    isConnected,
    accountId,
    proofOperation: zkProof.currentOperation,
    isBusy: zkProof.isBusy,
    filter,
    setFilter,
    fetchOnChainCredentials,
    storeOnChain,
    removeCredential,
    getStorageCost,
    clearError,
    retryLastAction,
    zkProof,
  };
}
