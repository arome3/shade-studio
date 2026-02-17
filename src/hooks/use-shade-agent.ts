'use client';

/**
 * Shade Agent Composition Hook
 *
 * Composes wallet state, encryption, store selectors, and agent
 * library functions into a single coherent interface for the UI.
 *
 * Composition layers:
 * 1. useWallet() — auth state
 * 2. useEncryption() — key encryption
 * 3. Store selectors — templates, instances, activeAgentId
 * 4. useMemo — derived sorted arrays
 * 5. useCallback — all actions
 * 6. useEffect — auto-fetch on wallet connect
 * 7. useRef<AbortController> — cancellable invocations
 *
 * Pattern reference: src/hooks/use-async-ai-job.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from './use-wallet';
import { useEncryption } from './use-encryption';
import {
  useAgentStore,
  useAgentTemplates,
  useAgentInstances,
  useAgentsFetching,
  useAgentsError,
} from '@/stores/agent-store';
import {
  listTemplates,
  getMyAgents,
  verifyAgent,
  registerTemplate,
  AgentRegistryError,
  AgentNotFoundError,
} from '@/lib/agents/registry-client';
import {
  deployAgent,
  invokeAgent,
  deactivateAgent,
  AgentDeployError,
  AgentInvokeError,
} from '@/lib/agents/shade-agent';
import {
  getOrphanedDeployments,
  removeOrphanedDeployment,
  recoverOrphanedDeployment,
  cleanupOrphanedDeployment,
  type OrphanedDeployment,
} from '@/lib/agents/deploy-recovery';
import { pruneExpiredKeys, getKeyHealth, type KeyHealth } from '@/lib/agents/key-lifecycle';
import { getWalletSelector } from '@/lib/near/wallet';
import type {
  AgentTemplate,
  AgentInstance,
  AgentInvocation,
  AgentVerificationResult,
  AgentCapability,
} from '@/types/agents';

// ============================================================================
// Error Classification
// ============================================================================

function classifyHookError(err: unknown, fallback: string): string {
  if (err instanceof AgentDeployError) {
    return err.message;
  }
  if (err instanceof AgentInvokeError) {
    return err.message;
  }
  if (err instanceof AgentNotFoundError) {
    return 'Agent not found in the registry. It may have been deactivated.';
  }
  if (err instanceof AgentRegistryError) {
    return `Registry error: ${err.message}`;
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
// Return Type
// ============================================================================

export interface UseShadeAgentReturn {
  // Data
  templates: AgentTemplate[];
  myAgents: AgentInstance[];
  activeAgent: AgentInstance | null;
  orphanedDeploys: OrphanedDeployment[];
  keyHealth: { owner: KeyHealth; execution: KeyHealth } | null;

  // State
  isFetching: boolean;
  isDeploying: boolean;
  error: string | null;
  isConnected: boolean;

  // Actions
  deploy: (templateId: string, name: string, slug: string) => Promise<AgentInstance | null>;
  selectAgent: (accountId: string | null) => void;
  verify: (agentAccountId: string) => Promise<AgentVerificationResult | null>;
  invoke: (
    agentAccountId: string,
    type: string,
    payload: Record<string, unknown>
  ) => Promise<AgentInvocation | null>;
  cancelInvocation: () => void;
  deactivate: (agentAccountId: string) => Promise<boolean>;
  recoverOrphanedDeploy: (agentAccountId: string) => Promise<AgentInstance | null>;
  cleanupOrphanedDeploy: (agentAccountId: string) => Promise<boolean>;
  dismissOrphanedDeploy: (agentAccountId: string) => void;
  registerNewTemplate: (input: {
    id: string;
    name: string;
    description: string;
    version: string;
    codehash: string;
    sourceUrl: string;
    capabilities: AgentCapability[];
    requiredPermissions: Array<{
      receiverId: string;
      methodNames: string[];
      allowance: string;
      purpose: string;
    }>;
  }) => Promise<boolean>;
  refreshTemplates: () => Promise<void>;
  refreshMyAgents: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useShadeAgent(): UseShadeAgentReturn {
  const { accountId, isConnected } = useWallet();
  const { encrypt } = useEncryption();
  const [isDeploying, setIsDeploying] = useState(false);
  const [orphanVersion, setOrphanVersion] = useState(0);
  const hasFetchedRef = useRef(false);
  const invokeAbortRef = useRef<AbortController | null>(null);

  // Store selectors (Zustand v5 — no second arg)
  const templatesRecord = useAgentTemplates();
  const instancesRecord = useAgentInstances();
  const isFetching = useAgentsFetching();
  const storeError = useAgentsError();

  // Store actions
  const setTemplates = useAgentStore((s) => s.setTemplates);
  const setInstances = useAgentStore((s) => s.setInstances);
  const addInstance = useAgentStore((s) => s.addInstance);
  const addTemplate = useAgentStore((s) => s.addTemplate);
  const updateInstance = useAgentStore((s) => s.updateInstance);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setFetching = useAgentStore((s) => s.setFetching);
  const setStoreError = useAgentStore((s) => s.setError);
  const templateOrder = useAgentStore((s) => s.templateOrder);
  const instanceOrder = useAgentStore((s) => s.instanceOrder);

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------

  const templates = useMemo(() => {
    return templateOrder
      .map((id) => templatesRecord[id])
      .filter((t): t is AgentTemplate => t !== undefined);
  }, [templatesRecord, templateOrder]);

  const myAgents = useMemo(() => {
    return instanceOrder
      .map((id) => instancesRecord[id])
      .filter((i): i is AgentInstance => i !== undefined);
  }, [instancesRecord, instanceOrder]);

  const activeAgent = activeAgentId
    ? (instancesRecord[activeAgentId] ?? null)
    : null;

  // Orphaned deployments for current user — filter out any whose agent
  // is already registered on-chain (fetched into instancesRecord).
  // orphanVersion forces re-read from localStorage after manual dismissal.
  const orphanedDeploys = useMemo(() => {
    if (!accountId) return [];
    return getOrphanedDeployments(accountId).filter(
      (o) => !instancesRecord[o.agentAccountId]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, instancesRecord, orphanVersion]);

  // Key health for the active agent
  const keyHealth = useMemo(() => {
    if (!activeAgentId) return null;
    return getKeyHealth(activeAgentId);
  }, [activeAgentId]);

  // Auto-clean orphan manifests for agents that are already registered on-chain
  useEffect(() => {
    if (!accountId) return;
    const allOrphans = getOrphanedDeployments(accountId);
    for (const orphan of allOrphans) {
      if (instancesRecord[orphan.agentAccountId]) {
        removeOrphanedDeployment(orphan.agentAccountId);
      }
    }
  }, [accountId, instancesRecord]);

  // --------------------------------------------------------------------------
  // Refresh actions
  // --------------------------------------------------------------------------

  const refreshTemplates = useCallback(async () => {
    setFetching(true);
    try {
      const allTemplates = await listTemplates(0, 100);
      setTemplates(allTemplates);
    } catch (err) {
      const msg = classifyHookError(err, 'Failed to fetch agent templates');
      setStoreError(msg);
    } finally {
      setFetching(false);
    }
  }, [setFetching, setTemplates, setStoreError]);

  const refreshMyAgents = useCallback(async () => {
    if (!accountId) return;
    setFetching(true);
    try {
      const agents = await getMyAgents(accountId);
      setInstances(agents);
    } catch (err) {
      const msg = classifyHookError(err, 'Failed to fetch your agents');
      setStoreError(msg);
    } finally {
      setFetching(false);
    }
  }, [accountId, setFetching, setInstances, setStoreError]);

  // --------------------------------------------------------------------------
  // Auto-fetch on wallet connect + prune expired keys
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (isConnected && accountId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refreshTemplates();
      refreshMyAgents();
      pruneExpiredKeys();
    }
    if (!isConnected) {
      hasFetchedRef.current = false;
    }
  }, [isConnected, accountId, refreshTemplates, refreshMyAgents]);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      invokeAbortRef.current?.abort();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Deploy (with re-entry guard)
  // --------------------------------------------------------------------------

  const deploy = useCallback(
    async (
      templateId: string,
      name: string,
      slug: string
    ): Promise<AgentInstance | null> => {
      // Re-entry guard — prevent concurrent deploys
      if (isDeploying) {
        console.warn('Deploy already in progress, ignoring duplicate request');
        return null;
      }

      const selector = getWalletSelector();
      if (!selector || !accountId) return null;

      setIsDeploying(true);
      try {
        const instance = await deployAgent({
          templateId,
          name,
          slug,
          ownerAccountId: accountId,
          walletSelector: selector,
          encrypt: async (data: string) => {
            const result = await encrypt(data);
            return {
              encrypted: result.ciphertext,
              nonce: result.nonce,
            };
          },
        });

        addInstance(instance);
        setActiveAgent(instance.accountId);
        return instance;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to deploy agent');
        setStoreError(msg);
        return null;
      } finally {
        setIsDeploying(false);
      }
    },
    [isDeploying, accountId, encrypt, addInstance, setActiveAgent, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Select agent
  // --------------------------------------------------------------------------

  const selectAgent = useCallback(
    (agentAccountId: string | null) => {
      setActiveAgent(agentAccountId);
    },
    [setActiveAgent]
  );

  // --------------------------------------------------------------------------
  // Verify
  // --------------------------------------------------------------------------

  const verify = useCallback(
    async (agentAccountId: string): Promise<AgentVerificationResult | null> => {
      try {
        const result = await verifyAgent(agentAccountId);
        // Update instance with verification result
        if (result.attestation) {
          updateInstance(agentAccountId, {
            lastAttestation: result.attestation,
          });
        }
        return result;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to verify agent');
        setStoreError(msg);
        return null;
      }
    },
    [updateInstance, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Invoke (with AbortController)
  // --------------------------------------------------------------------------

  const invoke = useCallback(
    async (
      agentAccountId: string,
      type: string,
      payload: Record<string, unknown>
    ): Promise<AgentInvocation | null> => {
      // Abort any in-flight invocation
      invokeAbortRef.current?.abort();
      const controller = new AbortController();
      invokeAbortRef.current = controller;

      try {
        const invocation = await invokeAgent(agentAccountId, type, payload, {
          verifyBeforeInvoke: true,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return null;

        // Update invocation count
        const existing = instancesRecord[agentAccountId];
        if (existing) {
          updateInstance(agentAccountId, {
            invocationCount: existing.invocationCount + 1,
            lastActiveAt: new Date().toISOString(),
          });
        }

        return invocation;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return null;
        if (controller.signal.aborted) return null;
        const msg = classifyHookError(err, 'Failed to invoke agent');
        setStoreError(msg);
        return null;
      } finally {
        if (invokeAbortRef.current === controller) {
          invokeAbortRef.current = null;
        }
      }
    },
    [instancesRecord, updateInstance, setStoreError]
  );

  const cancelInvocation = useCallback(() => {
    invokeAbortRef.current?.abort();
  }, []);

  // --------------------------------------------------------------------------
  // Deactivate
  // --------------------------------------------------------------------------

  const deactivateAction = useCallback(
    async (agentAccountId: string): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector) return false;

      try {
        await deactivateAgent(agentAccountId, selector);
        updateInstance(agentAccountId, { status: 'deactivated' });

        // If this was the active agent, clear selection
        if (activeAgentId === agentAccountId) {
          setActiveAgent(null);
        }
        return true;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to deactivate agent');
        setStoreError(msg);
        return false;
      }
    },
    [activeAgentId, updateInstance, setActiveAgent, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Orphan recovery
  // --------------------------------------------------------------------------

  const recoverOrphanedDeploy = useCallback(
    async (agentAccountId: string): Promise<AgentInstance | null> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return null;

      const orphan = orphanedDeploys.find((o) => o.agentAccountId === agentAccountId);
      if (!orphan) {
        setStoreError('Orphaned deployment not found');
        return null;
      }

      try {
        const instance = await recoverOrphanedDeployment(
          orphan,
          selector,
          async (data: string) => {
            const result = await encrypt(data);
            return { encrypted: result.ciphertext, nonce: result.nonce };
          },
        );
        addInstance(instance);
        return instance;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to recover orphaned deployment');
        setStoreError(msg);
        return null;
      }
    },
    [accountId, orphanedDeploys, encrypt, addInstance, setStoreError]
  );

  const cleanupOrphanedDeploy = useCallback(
    async (agentAccountId: string): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return false;

      try {
        await cleanupOrphanedDeployment(agentAccountId, accountId, selector);
        return true;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to clean up orphaned deployment');
        setStoreError(msg);
        return false;
      }
    },
    [accountId, setStoreError]
  );

  const dismissOrphanedDeploy = useCallback(
    (agentAccountId: string) => {
      removeOrphanedDeployment(agentAccountId);
      setOrphanVersion((v) => v + 1);
    },
    []
  );

  // --------------------------------------------------------------------------
  // Register template
  // --------------------------------------------------------------------------

  const registerNewTemplate = useCallback(
    async (input: {
      id: string;
      name: string;
      description: string;
      version: string;
      codehash: string;
      sourceUrl: string;
      capabilities: AgentCapability[];
      requiredPermissions: Array<{
        receiverId: string;
        methodNames: string[];
        allowance: string;
        purpose: string;
      }>;
    }): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return false;

      try {
        await registerTemplate(input, selector);

        // Optimistic update — add to store immediately
        addTemplate({
          id: input.id,
          name: input.name,
          description: input.description,
          version: input.version,
          codehash: input.codehash,
          sourceUrl: input.sourceUrl,
          creator: accountId,
          capabilities: input.capabilities,
          requiredPermissions: input.requiredPermissions.map((p) => ({
            receiverId: p.receiverId,
            methodNames: p.methodNames,
            allowance: p.allowance,
            purpose: p.purpose,
          })),
          createdAt: new Date().toISOString(),
          deployments: 0,
          isAudited: false,
        });

        return true;
      } catch (err) {
        const msg = classifyHookError(err, 'Failed to register template');
        setStoreError(msg);
        return false;
      }
    },
    [accountId, addTemplate, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Error management
  // --------------------------------------------------------------------------

  const clearError = useCallback(() => {
    useAgentStore.getState().clearError();
  }, []);

  return {
    templates,
    myAgents,
    activeAgent,
    orphanedDeploys,
    keyHealth,
    isFetching,
    isDeploying,
    error: storeError,
    isConnected,
    deploy,
    selectAgent,
    verify,
    invoke,
    cancelInvocation,
    deactivate: deactivateAction,
    recoverOrphanedDeploy,
    cleanupOrphanedDeploy,
    dismissOrphanedDeploy,
    registerNewTemplate,
    refreshTemplates,
    refreshMyAgents,
    clearError,
  };
}
