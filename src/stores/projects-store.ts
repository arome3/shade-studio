import { create } from 'zustand';
import type { Project, ProjectListItem } from '@/types/project';
import type { SocialError } from '@/lib/near/social-errors';

/**
 * Status states for project operations.
 */
export type ProjectsStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'deleting'
  | 'error';

/**
 * Projects state shape.
 */
export interface ProjectsState {
  /** Current operation status */
  status: ProjectsStatus;
  /** List of projects for display */
  projects: ProjectListItem[];
  /** Currently selected/active project */
  currentProject: Project | null;
  /** Last error that occurred */
  error: SocialError | null;
  /** Timestamp of last successful fetch */
  lastFetchedAt: number | null;
}

/**
 * Projects actions for state transitions.
 */
export interface ProjectsActions {
  /** Set status to loading */
  setLoading: () => void;
  /** Set status to saving */
  setSaving: () => void;
  /** Set status to deleting */
  setDeleting: () => void;
  /** Set status to idle */
  setIdle: () => void;
  /** Replace all projects in the list */
  setProjects: (projects: ProjectListItem[]) => void;
  /** Set the current active project */
  setCurrentProject: (project: Project | null) => void;
  /** Add a new project to the list (optimistic update) */
  addProject: (project: ProjectListItem) => void;
  /** Update an existing project in the list (optimistic update) */
  updateProject: (projectId: string, updates: Partial<ProjectListItem>) => void;
  /** Remove a project from the list (optimistic update) */
  removeProject: (projectId: string) => void;
  /** Set error state */
  setError: (error: SocialError) => void;
  /** Clear error without changing status */
  clearError: () => void;
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Initial state for the projects store.
 */
const initialState: ProjectsState = {
  status: 'idle',
  projects: [],
  currentProject: null,
  error: null,
  lastFetchedAt: null,
};

/**
 * Projects store combining state and actions.
 * Manages project list state and current project selection.
 */
export const useProjectsStore = create<ProjectsState & ProjectsActions>()(
  (set) => ({
    ...initialState,

    setLoading: () =>
      set({
        status: 'loading',
        error: null,
      }),

    setSaving: () =>
      set({
        status: 'saving',
        error: null,
      }),

    setDeleting: () =>
      set({
        status: 'deleting',
        error: null,
      }),

    setIdle: () =>
      set({
        status: 'idle',
      }),

    setProjects: (projects: ProjectListItem[]) =>
      set({
        status: 'idle',
        projects,
        lastFetchedAt: Date.now(),
        error: null,
      }),

    setCurrentProject: (project: Project | null) =>
      set({
        currentProject: project,
      }),

    addProject: (project: ProjectListItem) =>
      set((state) => ({
        projects: [project, ...state.projects],
      })),

    updateProject: (projectId: string, updates: Partial<ProjectListItem>) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ...updates } : p
        ),
        // Also update currentProject if it's the same project
        currentProject:
          state.currentProject?.id === projectId
            ? { ...state.currentProject, ...updates }
            : state.currentProject,
      })),

    removeProject: (projectId: string) =>
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        // Clear currentProject if it was the deleted project
        currentProject:
          state.currentProject?.id === projectId
            ? null
            : state.currentProject,
      })),

    setError: (error: SocialError) =>
      set({
        status: 'error',
        error,
      }),

    clearError: () =>
      set({
        error: null,
      }),

    reset: () => set(initialState),
  })
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get the current projects status.
 */
export const useProjectsStatus = () =>
  useProjectsStore((state) => state.status);

/**
 * Get the projects list.
 */
export const useProjectsList = () =>
  useProjectsStore((state) => state.projects);

/**
 * Get the currently selected project.
 */
export const useCurrentProject = () =>
  useProjectsStore((state) => state.currentProject);

/**
 * Get the current error.
 */
export const useProjectsError = () =>
  useProjectsStore((state) => state.error);

/**
 * Check if projects are currently loading.
 */
export const useIsProjectsLoading = () =>
  useProjectsStore((state) => state.status === 'loading');

/**
 * Check if a project is currently being saved.
 */
export const useIsProjectSaving = () =>
  useProjectsStore((state) => state.status === 'saving');

/**
 * Check if a project is currently being deleted.
 */
export const useIsProjectDeleting = () =>
  useProjectsStore((state) => state.status === 'deleting');

/**
 * Get the timestamp of the last successful fetch.
 */
export const useLastFetchedAt = () =>
  useProjectsStore((state) => state.lastFetchedAt);

/**
 * Get a specific project by ID from the list.
 */
export const useProjectById = (projectId: string) =>
  useProjectsStore((state) =>
    state.projects.find((p) => p.id === projectId)
  );

/**
 * Get the count of projects.
 */
export const useProjectsCount = () =>
  useProjectsStore((state) => state.projects.length);

/**
 * Check if there are any projects.
 */
export const useHasProjects = () =>
  useProjectsStore((state) => state.projects.length > 0);
