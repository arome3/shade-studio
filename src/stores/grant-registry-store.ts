/**
 * Grant Registry Store
 *
 * Zustand v5 store for grant registry state. Uses devtools + persist
 * middleware with partialize to only persist user filter preferences.
 * Programs/projects are fetched from chain each session.
 *
 * Pattern follows agent-store.ts for Record+Order normalization
 * and async-ai-store.ts for persist with partialize.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  GrantProgram,
  GrantProject,
  GrantApplication,
  EcosystemStats,
  ProgramSearchFilters,
} from '@/types/grants';

// ============================================================================
// State & Actions
// ============================================================================

export interface GrantRegistryState {
  /** Programs keyed by ID (stable reference for O(1) lookup) */
  programs: Record<string, GrantProgram>;
  /** Program IDs in display order */
  programOrder: string[];
  /** Projects keyed by ID */
  projects: Record<string, GrantProject>;
  /** Project IDs in display order */
  projectOrder: string[];
  /** Ecosystem-wide statistics */
  ecosystemStats: EcosystemStats | null;
  /** Current user's applications keyed by ID */
  myApplications: Record<string, GrantApplication>;
  /** Application IDs in display order */
  applicationOrder: string[];
  /** Search/filter state */
  filters: ProgramSearchFilters;
  /** Whether data is being fetched */
  isFetching: boolean;
  /** Whether a registration is in progress */
  isRegistering: boolean;
  /** Error message */
  error: string | null;
  /** Active tab */
  activeTab: 'programs' | 'my-projects' | 'analytics';
}

export interface GrantRegistryActions {
  setPrograms: (programs: GrantProgram[]) => void;
  addProgram: (program: GrantProgram) => void;
  setProjects: (projects: GrantProject[]) => void;
  addProject: (project: GrantProject) => void;
  setEcosystemStats: (stats: EcosystemStats) => void;
  setMyApplications: (applications: GrantApplication[]) => void;
  addApplication: (application: GrantApplication) => void;
  removeProgram: (programId: string) => void;
  removeProject: (projectId: string) => void;
  setFilters: (filters: ProgramSearchFilters) => void;
  setFetching: (fetching: boolean) => void;
  setRegistering: (registering: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setActiveTab: (tab: GrantRegistryState['activeTab']) => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: GrantRegistryState = {
  programs: {},
  programOrder: [],
  projects: {},
  projectOrder: [],
  ecosystemStats: null,
  myApplications: {},
  applicationOrder: [],
  filters: {},
  isFetching: false,
  isRegistering: false,
  error: null,
  activeTab: 'programs',
};

// ============================================================================
// Store
// ============================================================================

export const useGrantRegistryStore = create<GrantRegistryState & GrantRegistryActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setPrograms: (programs: GrantProgram[]) =>
          set(
            () => {
              const record: Record<string, GrantProgram> = {};
              const order: string[] = [];
              for (const p of programs) {
                record[p.id] = p;
                order.push(p.id);
              }
              return { programs: record, programOrder: order };
            },
            false,
            'setPrograms'
          ),

        addProgram: (program: GrantProgram) =>
          set(
            (state) => ({
              programs: { ...state.programs, [program.id]: program },
              programOrder: state.programOrder.includes(program.id)
                ? state.programOrder
                : [...state.programOrder, program.id],
            }),
            false,
            'addProgram'
          ),

        setProjects: (projects: GrantProject[]) =>
          set(
            () => {
              const record: Record<string, GrantProject> = {};
              const order: string[] = [];
              for (const p of projects) {
                record[p.id] = p;
                order.push(p.id);
              }
              return { projects: record, projectOrder: order };
            },
            false,
            'setProjects'
          ),

        addProject: (project: GrantProject) =>
          set(
            (state) => ({
              projects: { ...state.projects, [project.id]: project },
              projectOrder: state.projectOrder.includes(project.id)
                ? state.projectOrder
                : [...state.projectOrder, project.id],
            }),
            false,
            'addProject'
          ),

        removeProgram: (programId: string) =>
          set(
            (state) => {
              const { [programId]: _, ...rest } = state.programs;
              return {
                programs: rest,
                programOrder: state.programOrder.filter((id) => id !== programId),
              };
            },
            false,
            'removeProgram'
          ),

        removeProject: (projectId: string) =>
          set(
            (state) => {
              const { [projectId]: _, ...rest } = state.projects;
              return {
                projects: rest,
                projectOrder: state.projectOrder.filter((id) => id !== projectId),
              };
            },
            false,
            'removeProject'
          ),

        setEcosystemStats: (stats: EcosystemStats) =>
          set({ ecosystemStats: stats }, false, 'setEcosystemStats'),

        setMyApplications: (applications: GrantApplication[]) =>
          set(
            () => {
              const record: Record<string, GrantApplication> = {};
              const order: string[] = [];
              for (const a of applications) {
                record[a.id] = a;
                order.push(a.id);
              }
              return { myApplications: record, applicationOrder: order };
            },
            false,
            'setMyApplications'
          ),

        addApplication: (application: GrantApplication) =>
          set(
            (state) => ({
              myApplications: { ...state.myApplications, [application.id]: application },
              applicationOrder: [application.id, ...state.applicationOrder],
            }),
            false,
            'addApplication'
          ),

        setFilters: (filters: ProgramSearchFilters) =>
          set({ filters }, false, 'setFilters'),

        setFetching: (fetching: boolean) =>
          set(
            { isFetching: fetching, ...(fetching ? { error: null } : {}) },
            false,
            'setFetching'
          ),

        setRegistering: (registering: boolean) =>
          set({ isRegistering: registering }, false, 'setRegistering'),

        setError: (error: string | null) =>
          set({ error, isFetching: false }, false, 'setError'),

        clearError: () => set({ error: null }, false, 'clearError'),

        setActiveTab: (tab: GrantRegistryState['activeTab']) =>
          set({ activeTab: tab }, false, 'setActiveTab'),

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'grant-registry-store',
        partialize: (state) => ({
          filters: state.filters,
        }),
      }
    ),
    {
      name: 'grant-registry-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

// Stable empty arrays to prevent infinite re-render loops in Zustand v5 selectors.
const EMPTY_STRINGS: string[] = [];

/** Get the programs record. */
export const useGrantPrograms = () =>
  useGrantRegistryStore((state) => state.programs);

/** Get the program order array. */
export const useGrantProgramOrder = () =>
  useGrantRegistryStore((state) =>
    state.programOrder.length > 0 ? state.programOrder : EMPTY_STRINGS
  );

/** Get the projects record. */
export const useGrantProjects = () =>
  useGrantRegistryStore((state) => state.projects);

/** Get the project order array. */
export const useGrantProjectOrder = () =>
  useGrantRegistryStore((state) =>
    state.projectOrder.length > 0 ? state.projectOrder : EMPTY_STRINGS
  );

/** Get the current filters. */
export const useGrantFilters = () =>
  useGrantRegistryStore((state) => state.filters);

/** Get ecosystem stats. */
export const useEcosystemStats = () =>
  useGrantRegistryStore((state) => state.ecosystemStats);

/** Check if data is being fetched. */
export const useGrantFetching = () =>
  useGrantRegistryStore((state) => state.isFetching);

/** Get the current error. */
export const useGrantError = () =>
  useGrantRegistryStore((state) => state.error);

/** Get the active tab. */
export const useGrantActiveTab = () =>
  useGrantRegistryStore((state) => state.activeTab);
