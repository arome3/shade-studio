'use client';

/**
 * Grant Registry Composition Hook
 *
 * Composes wallet state, store selectors, and grant registry
 * client functions into a single coherent interface for the UI.
 *
 * Composition layers:
 * 1. useWallet() — auth state
 * 2. Store selectors — programs, projects, filters, stats
 * 3. Store actions — setPrograms, setFilters, setError, etc.
 * 4. useMemo — derived sorted arrays from Records via order
 * 5. useCallback — search, register, filter, apply actions
 * 6. useEffect — auto-fetch on wallet connect + hydrate user data
 *
 * Pattern reference: src/hooks/use-shade-agent.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from './use-wallet';
import {
  useGrantRegistryStore,
  useGrantPrograms,
  useGrantProjects,
  useGrantFetching,
  useGrantError,
  useEcosystemStats,
} from '@/stores/grant-registry-store';
import {
  searchPrograms,
  getEcosystemStats,
  getProjectsByOwner,
  getProjectHistory,
  registerProgram,
  registerProject,
  recordApplication,
  GrantRegistryError,
  ProgramNotFoundError,
  ProjectNotFoundError,
} from '@/lib/grants/registry-client';
import { getWalletSelector } from '@/lib/near/wallet';
import type {
  GrantProgram,
  GrantProject,
  GrantApplication,
  GrantCategory,
  GrantChain,
  EcosystemStats as EcosystemStatsType,
  ProgramSearchFilters,
  RegisterProgramInput,
  RegisterProjectInput,
  RecordApplicationInput,
} from '@/types/grants';

// ============================================================================
// Error Classification
// ============================================================================

function classifyGrantError(err: unknown, fallback: string): string {
  if (err instanceof ProgramNotFoundError) {
    return 'Grant program not found. It may have been removed.';
  }
  if (err instanceof ProjectNotFoundError) {
    return 'Project not found in the registry.';
  }
  if (err instanceof GrantRegistryError) {
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

export interface UseGrantRegistryReturn {
  // Data
  programs: GrantProgram[];
  projects: GrantProject[];
  ecosystemStats: EcosystemStatsType | null;
  filters: ProgramSearchFilters;
  applications: GrantApplication[];

  // State
  isFetching: boolean;
  isRegistering: boolean;
  error: string | null;
  isConnected: boolean;
  activeTab: 'programs' | 'my-projects' | 'analytics';
  selectedProjectId: string | null;

  // Actions
  search: (filters?: ProgramSearchFilters) => Promise<void>;
  updateFilters: (filters: ProgramSearchFilters) => void;
  fetchStats: () => Promise<void>;
  registerNewProgram: (input: RegisterProgramInput) => Promise<boolean>;
  registerNewProject: (input: RegisterProjectInput) => Promise<boolean>;
  submitApplication: (input: RecordApplicationInput) => Promise<boolean>;
  setActiveTab: (tab: 'programs' | 'my-projects' | 'analytics') => void;
  setSelectedProjectId: (id: string | null) => void;
  refreshAll: () => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useGrantRegistry(): UseGrantRegistryReturn {
  const { accountId, isConnected } = useWallet();
  const hasFetchedRef = useRef(false);

  // Gap 3 — selected project state for ProjectHistory
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Store selectors (Zustand v5 — no second arg)
  const programsRecord = useGrantPrograms();
  const projectsRecord = useGrantProjects();
  const isFetching = useGrantFetching();
  const storeError = useGrantError();
  const ecosystemStats = useEcosystemStats();

  // Store actions
  const setPrograms = useGrantRegistryStore((s) => s.setPrograms);
  const addProgram = useGrantRegistryStore((s) => s.addProgram);
  const setProjects = useGrantRegistryStore((s) => s.setProjects);
  const addProject = useGrantRegistryStore((s) => s.addProject);
  const setEcosystemStats = useGrantRegistryStore((s) => s.setEcosystemStats);
  const setMyApplications = useGrantRegistryStore((s) => s.setMyApplications);
  const addApplication = useGrantRegistryStore((s) => s.addApplication);
  const setFilters = useGrantRegistryStore((s) => s.setFilters);
  const filters = useGrantRegistryStore((s) => s.filters);
  const setFetching = useGrantRegistryStore((s) => s.setFetching);
  const setRegistering = useGrantRegistryStore((s) => s.setRegistering);
  const isRegistering = useGrantRegistryStore((s) => s.isRegistering);
  const setStoreError = useGrantRegistryStore((s) => s.setError);
  const programOrder = useGrantRegistryStore((s) => s.programOrder);
  const projectOrder = useGrantRegistryStore((s) => s.projectOrder);
  const myApplicationsRecord = useGrantRegistryStore((s) => s.myApplications);
  const applicationOrder = useGrantRegistryStore((s) => s.applicationOrder);
  const activeTab = useGrantRegistryStore((s) => s.activeTab);
  const setActiveTab = useGrantRegistryStore((s) => s.setActiveTab);

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------

  const programs = useMemo(() => {
    return programOrder
      .map((id) => programsRecord[id])
      .filter((p): p is GrantProgram => p !== undefined);
  }, [programsRecord, programOrder]);

  const projects = useMemo(() => {
    return projectOrder
      .map((id) => projectsRecord[id])
      .filter((p): p is GrantProject => p !== undefined);
  }, [projectsRecord, projectOrder]);

  const applications = useMemo(() => {
    return applicationOrder
      .map((id) => myApplicationsRecord[id])
      .filter((a): a is GrantApplication => a !== undefined);
  }, [myApplicationsRecord, applicationOrder]);

  // Gap 4 — derive topCategories and topChains from store programs
  const enrichedStats = useMemo((): EcosystemStatsType | null => {
    if (!ecosystemStats) return null;

    const catCounts: Record<string, number> = {};
    const chainCounts: Record<string, number> = {};
    for (const id of programOrder) {
      const p = programsRecord[id];
      if (!p) continue;
      for (const cat of p.categories) {
        catCounts[cat] = (catCounts[cat] ?? 0) + 1;
      }
      for (const chain of p.chains) {
        chainCounts[chain] = (chainCounts[chain] ?? 0) + 1;
      }
    }

    const topCategories = Object.entries(catCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category: category as GrantCategory, count }));

    const topChains = Object.entries(chainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([chain, count]) => ({ chain: chain as GrantChain, count }));

    return { ...ecosystemStats, topCategories, topChains };
  }, [ecosystemStats, programsRecord, programOrder]);

  // --------------------------------------------------------------------------
  // Search / Fetch actions
  // --------------------------------------------------------------------------

  const search = useCallback(
    async (searchFilters?: ProgramSearchFilters) => {
      const effectiveFilters = searchFilters ?? filters;
      setFetching(true);
      try {
        const results = await searchPrograms({
          searchText: effectiveFilters.searchText,
          category: effectiveFilters.category,
          chain: effectiveFilters.chain,
          status: effectiveFilters.activeOnly ? 'active' : undefined,
        });
        setPrograms(results);
      } catch (err) {
        const msg = classifyGrantError(err, 'Failed to search grant programs');
        setStoreError(msg);
      } finally {
        setFetching(false);
      }
    },
    [filters, setFetching, setPrograms, setStoreError]
  );

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getEcosystemStats();
      setEcosystemStats(stats);
    } catch (err) {
      const msg = classifyGrantError(err, 'Failed to fetch ecosystem stats');
      setStoreError(msg);
    }
  }, [setEcosystemStats, setStoreError]);

  // Gap 2 + 6 — hydrate user's projects and their applications
  const hydrateUserData = useCallback(async () => {
    if (!accountId) return;
    try {
      const userProjects = await getProjectsByOwner(accountId);
      setProjects(userProjects);

      const allApps: GrantApplication[] = [];
      for (const proj of userProjects) {
        const apps = await getProjectHistory(proj.id);
        allApps.push(...apps);
      }
      setMyApplications(allApps);
    } catch (err) {
      const msg = classifyGrantError(err, 'Failed to load your projects');
      setStoreError(msg);
    }
  }, [accountId, setProjects, setMyApplications, setStoreError]);

  const updateFilters = useCallback(
    (newFilters: ProgramSearchFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  const refreshAll = useCallback(async () => {
    setFetching(true);
    try {
      const fetches: Promise<unknown>[] = [
        searchPrograms({
          searchText: filters.searchText,
          category: filters.category,
          chain: filters.chain,
          status: filters.activeOnly ? 'active' : undefined,
        }).then(setPrograms),
        getEcosystemStats().then(setEcosystemStats),
      ];
      if (accountId) {
        fetches.push(hydrateUserData());
      }
      await Promise.all(fetches);
    } catch (err) {
      const msg = classifyGrantError(err, 'Failed to refresh grant data');
      setStoreError(msg);
    } finally {
      setFetching(false);
    }
  }, [filters, accountId, setFetching, setPrograms, setEcosystemStats, setStoreError, hydrateUserData]);

  // --------------------------------------------------------------------------
  // Registration actions
  // --------------------------------------------------------------------------

  const registerNewProgram = useCallback(
    async (input: RegisterProgramInput): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return false;

      setRegistering(true);
      try {
        const id = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        await registerProgram(
          { ...input, id },
          selector
        );

        // Add to store only after successful contract call
        const program: GrantProgram = {
          ...input,
          id,
          registeredBy: accountId,
          registeredAt: new Date().toISOString(),
          applicationCount: 0,
          fundedCount: 0,
        };
        addProgram(program);
        return true;
      } catch (err) {
        const msg = classifyGrantError(err, 'Failed to register program');
        setStoreError(msg);
        return false;
      } finally {
        setRegistering(false);
      }
    },
    [accountId, setRegistering, addProgram, setStoreError]
  );

  const registerNewProject = useCallback(
    async (input: RegisterProjectInput): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return false;

      setRegistering(true);
      try {
        const id = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        await registerProject(
          { ...input, id },
          selector
        );

        // Add to store only after successful contract call
        const project: GrantProject = {
          ...input,
          id,
          registeredBy: accountId,
          registeredAt: new Date().toISOString(),
          totalFunded: '0',
          applicationCount: 0,
          successRate: 0,
        };
        addProject(project);
        return true;
      } catch (err) {
        const msg = classifyGrantError(err, 'Failed to register project');
        setStoreError(msg);
        return false;
      } finally {
        setRegistering(false);
      }
    },
    [accountId, setRegistering, addProject, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Gap 1 — Application submission
  // --------------------------------------------------------------------------

  const submitApplication = useCallback(
    async (input: RecordApplicationInput): Promise<boolean> => {
      const selector = getWalletSelector();
      if (!selector || !accountId) return false;

      setRegistering(true);
      try {
        const id = `app-${Date.now()}`;
        await recordApplication(
          { ...input, id },
          selector
        );

        // Optimistic add after successful contract call
        const app: GrantApplication = {
          id,
          ...input,
          applicantAccountId: accountId,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        };
        addApplication(app);
        return true;
      } catch (err) {
        const msg = classifyGrantError(err, 'Failed to submit application');
        setStoreError(msg);
        return false;
      } finally {
        setRegistering(false);
      }
    },
    [accountId, setRegistering, addApplication, setStoreError]
  );

  // --------------------------------------------------------------------------
  // Auto-fetch on wallet connect
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (isConnected && accountId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      search();
      fetchStats();
      hydrateUserData(); // Gap 6: hydrate user projects + applications
    }
    if (!isConnected) {
      hasFetchedRef.current = false;
    }
  }, [isConnected, accountId, search, fetchStats, hydrateUserData]);

  // --------------------------------------------------------------------------
  // Error management
  // --------------------------------------------------------------------------

  const clearError = useCallback(() => {
    useGrantRegistryStore.getState().clearError();
  }, []);

  return {
    programs,
    projects,
    ecosystemStats: enrichedStats, // Gap 4: enriched with topCategories/topChains
    filters,
    applications,
    isFetching,
    isRegistering,
    error: storeError,
    isConnected,
    activeTab,
    selectedProjectId,
    search,
    updateFilters,
    fetchStats,
    registerNewProgram,
    registerNewProject,
    submitApplication,
    setActiveTab,
    setSelectedProjectId,
    refreshAll,
    clearError,
  };
}
