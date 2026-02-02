'use client';

import { useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useWallet } from './use-wallet';
import { useEncryption } from './use-encryption';
import {
  useProjectsStore,
  type ProjectsStatus,
} from '@/stores/projects-store';
import {
  getProjects,
  getProject,
  buildSaveProjectTransaction,
  buildDeleteProjectTransaction,
  type StoredProjectMetadata,
  type SocialAccount,
  type SocialProjectData,
} from '@/lib/near/social';
import { getWalletSelector } from '@/lib/near/wallet';
import {
  toSocialError,
  SocialError,
  SocialErrorCode,
} from '@/lib/near/social-errors';
import { WalletNotConnectedError, WalletNotInitializedError } from '@/lib/near/errors';
import type {
  Project,
  ProjectListItem,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStatus,
  ProjectVisibility,
  GrantProgram,
} from '@/types/project';
import type { EncryptedPayload } from '@/types/document';

/**
 * Return type for the useProjects hook.
 */
export interface UseProjectsReturn {
  // State
  status: ProjectsStatus;
  projects: ProjectListItem[];
  currentProject: Project | null;
  error: SocialError | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProject: (projectId: string) => Promise<Project | null>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (input: UpdateProjectInput) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
  refreshProjects: () => Promise<void>;
}

/**
 * Convert stored project data to Project domain type.
 */
function storedToProject(
  projectId: string,
  ownerId: string,
  stored: SocialProjectData
): Project {
  return {
    id: projectId,
    ownerId,
    metadata: {
      name: stored.metadata.name,
      description: stored.metadata.description,
      grantProgram: stored.metadata.grantProgram as GrantProgram,
      tags: [],
    },
    status: stored.metadata.status as ProjectStatus,
    visibility: stored.metadata.visibility as ProjectVisibility,
    team: [
      {
        accountId: ownerId,
        role: 'owner',
        joinedAt: new Date(stored.metadata.createdAt).toISOString(),
      },
    ],
    documentIds: stored.documents ? Object.keys(stored.documents) : [],
    createdAt: new Date(stored.metadata.createdAt).toISOString(),
    updatedAt: new Date(stored.metadata.updatedAt).toISOString(),
  };
}

/**
 * Convert stored project data to ProjectListItem for display.
 */
function storedToListItem(
  projectId: string,
  stored: SocialProjectData
): ProjectListItem {
  return {
    id: projectId,
    name: stored.metadata.name,
    description: stored.metadata.description,
    status: stored.metadata.status as ProjectStatus,
    grantProgram: stored.metadata.grantProgram as GrantProgram,
    documentCount: stored.documents ? Object.keys(stored.documents).length : 0,
    updatedAt: new Date(stored.metadata.updatedAt).toISOString(),
  };
}

/**
 * Convert Project to StoredProjectMetadata for persistence.
 */
function projectToStored(project: Project, encrypted?: EncryptedPayload): StoredProjectMetadata {
  return {
    name: project.metadata.name,
    description: project.metadata.description,
    grantProgram: project.metadata.grantProgram,
    status: project.status,
    visibility: project.visibility,
    createdAt: new Date(project.createdAt).getTime(),
    updatedAt: new Date(project.updatedAt).getTime(),
    encrypted,
  };
}

/**
 * Main projects hook for NEAR Social storage operations.
 * Provides CRUD operations for projects with optimistic updates.
 *
 * @example
 * function ProjectList() {
 *   const { projects, isLoading, fetchProjects, createProject } = useProjects();
 *
 *   useEffect(() => {
 *     fetchProjects();
 *   }, [fetchProjects]);
 *
 *   const handleCreate = async () => {
 *     await createProject({ name: 'New Project', description: '...', grantProgram: 'near-foundation' });
 *   };
 *
 *   if (isLoading) return <Spinner />;
 *   return <ProjectGrid projects={projects} />;
 * }
 */
export function useProjects(): UseProjectsReturn {
  const fetchAttempted = useRef(false);

  // Get wallet state
  const { isConnected, accountId } = useWallet();

  // Get encryption state (optional - only used if available)
  const { isReady: isEncryptionReady, encrypt } = useEncryption();

  // Get projects store state and actions
  const status = useProjectsStore((state) => state.status);
  const projects = useProjectsStore((state) => state.projects);
  const currentProject = useProjectsStore((state) => state.currentProject);
  const error = useProjectsStore((state) => state.error);

  const setLoading = useProjectsStore((state) => state.setLoading);
  const setSaving = useProjectsStore((state) => state.setSaving);
  const setDeleting = useProjectsStore((state) => state.setDeleting);
  const setIdle = useProjectsStore((state) => state.setIdle);
  const setProjects = useProjectsStore((state) => state.setProjects);
  const setCurrentProject = useProjectsStore((state) => state.setCurrentProject);
  const addProject = useProjectsStore((state) => state.addProject);
  const updateProjectInStore = useProjectsStore((state) => state.updateProject);
  const removeProject = useProjectsStore((state) => state.removeProject);
  const setError = useProjectsStore((state) => state.setError);
  const reset = useProjectsStore((state) => state.reset);

  /**
   * Get the SocialAccount object for transactions.
   */
  const getSocialAccount = useCallback(async (): Promise<SocialAccount> => {
    const selector = getWalletSelector();
    if (!selector) {
      throw new WalletNotInitializedError();
    }

    if (!isConnected || !accountId) {
      throw new WalletNotConnectedError();
    }

    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();
    const account = accounts.find((a) => a.accountId === accountId);

    if (!account) {
      throw new WalletNotConnectedError('No account found');
    }

    return {
      accountId: account.accountId,
      publicKey: account.publicKey?.toString() ?? '',
    };
  }, [isConnected, accountId]);

  /**
   * Sign and send a transaction via the wallet.
   */
  const signAndSendTransaction = useCallback(
    async (transaction: { receiverId: string; actions: unknown[] }) => {
      const selector = getWalletSelector();
      if (!selector) {
        throw new WalletNotInitializedError();
      }

      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: transaction.receiverId,
        actions: transaction.actions.map((action: unknown) => {
          const typedAction = action as {
            functionCall?: {
              methodName: string;
              args: Uint8Array;
              gas: bigint;
              deposit: bigint;
            };
          };

          if (!typedAction.functionCall) {
            throw new Error('Invalid action type');
          }

          return {
            type: 'FunctionCall' as const,
            params: {
              methodName: typedAction.functionCall.methodName,
              args: typedAction.functionCall.args,
              gas: typedAction.functionCall.gas.toString(),
              deposit: typedAction.functionCall.deposit.toString(),
            },
          };
        }),
      });
    },
    []
  );

  /**
   * Fetch all projects for the connected account.
   */
  const fetchProjects = useCallback(async () => {
    if (!accountId) {
      return;
    }

    try {
      setLoading();

      const projectsData = await getProjects(accountId);

      const projectsList: ProjectListItem[] = Object.entries(projectsData).map(
        ([projectId, data]) => storedToListItem(projectId, data)
      );

      // Sort by updatedAt descending (newest first)
      projectsList.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setProjects(projectsList);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[useProjects] Fetched', projectsList.length, 'projects');
      }
    } catch (err) {
      const socialError = toSocialError(err);
      setError(socialError);

      if (process.env.NODE_ENV === 'development') {
        console.error('[useProjects] Fetch failed:', err);
      }
    }
  }, [accountId, setLoading, setProjects, setError]);

  /**
   * Fetch a single project by ID.
   */
  const fetchProject = useCallback(
    async (projectId: string): Promise<Project | null> => {
      if (!accountId) {
        return null;
      }

      try {
        const projectData = await getProject(accountId, projectId);

        if (!projectData) {
          return null;
        }

        const project = storedToProject(projectId, accountId, projectData);
        setCurrentProject(project);
        return project;
      } catch (err) {
        const socialError = toSocialError(err);
        setError(socialError);
        throw socialError;
      }
    },
    [accountId, setCurrentProject, setError]
  );

  /**
   * Create a new project.
   */
  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      try {
        setSaving();

        const projectId = nanoid();
        const now = new Date().toISOString();

        // Build the project object
        const project: Project = {
          id: projectId,
          ownerId: accountId,
          metadata: {
            name: input.name,
            description: input.description,
            grantProgram: input.grantProgram,
            fundingAmount: input.fundingAmount,
            tags: input.tags ?? [],
          },
          status: 'draft',
          visibility: input.visibility ?? 'private',
          team: [
            {
              accountId,
              role: 'owner',
              joinedAt: now,
            },
          ],
          documentIds: [],
          createdAt: now,
          updatedAt: now,
        };

        // Optimistically add to store
        const listItem: ProjectListItem = {
          id: projectId,
          name: input.name,
          description: input.description,
          status: 'draft',
          grantProgram: input.grantProgram,
          documentCount: 0,
          updatedAt: now,
        };
        addProject(listItem);

        // Optionally encrypt sensitive metadata
        let encrypted: EncryptedPayload | undefined;
        if (isEncryptionReady) {
          try {
            encrypted = await encrypt({
              fundingAmount: input.fundingAmount,
              tags: input.tags,
            });
          } catch {
            // Encryption failed, continue without it
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useProjects] Encryption failed, saving unencrypted');
            }
          }
        }

        // Build and send transaction
        const account = await getSocialAccount();
        const storedData = projectToStored(project, encrypted);
        const transaction = await buildSaveProjectTransaction(
          account,
          projectId,
          storedData
        );

        await signAndSendTransaction(transaction as unknown as { receiverId: string; actions: unknown[] });

        setCurrentProject(project);
        setIdle();

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useProjects] Created project:', projectId);
        }

        return project;
      } catch (err) {
        // Rollback optimistic update
        // Note: We don't have the projectId if it failed early
        const socialError = toSocialError(err);
        setError(socialError);
        throw socialError;
      }
    },
    [
      isConnected,
      accountId,
      isEncryptionReady,
      encrypt,
      getSocialAccount,
      signAndSendTransaction,
      setSaving,
      addProject,
      setCurrentProject,
      setIdle,
      setError,
    ]
  );

  /**
   * Update an existing project.
   */
  const updateProject = useCallback(
    async (input: UpdateProjectInput): Promise<Project> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      try {
        setSaving();

        // Fetch current project if not in store
        let project = currentProject;
        if (!project || project.id !== input.id) {
          project = await fetchProject(input.id);
        }

        if (!project) {
          throw new SocialError(SocialErrorCode.NOT_FOUND, `Project ${input.id} not found`);
        }

        const now = new Date().toISOString();

        // Merge updates
        const updatedProject: Project = {
          ...project,
          metadata: {
            ...project.metadata,
            ...input.metadata,
          },
          status: input.status ?? project.status,
          visibility: input.visibility ?? project.visibility,
          updatedAt: now,
        };

        // Optimistically update store
        updateProjectInStore(input.id, {
          name: updatedProject.metadata.name,
          description: updatedProject.metadata.description,
          status: updatedProject.status,
          grantProgram: updatedProject.metadata.grantProgram,
          updatedAt: now,
        });

        // Optionally encrypt sensitive metadata
        let encrypted: EncryptedPayload | undefined;
        if (isEncryptionReady) {
          try {
            encrypted = await encrypt({
              fundingAmount: updatedProject.metadata.fundingAmount,
              tags: updatedProject.metadata.tags,
            });
          } catch {
            // Encryption failed, continue without it
          }
        }

        // Build and send transaction
        const account = await getSocialAccount();
        const storedData = projectToStored(updatedProject, encrypted);
        const transaction = await buildSaveProjectTransaction(
          account,
          input.id,
          storedData
        );

        await signAndSendTransaction(transaction as unknown as { receiverId: string; actions: unknown[] });

        setCurrentProject(updatedProject);
        setIdle();

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useProjects] Updated project:', input.id);
        }

        return updatedProject;
      } catch (err) {
        const socialError = toSocialError(err);
        setError(socialError);
        throw socialError;
      }
    },
    [
      isConnected,
      accountId,
      currentProject,
      isEncryptionReady,
      encrypt,
      fetchProject,
      getSocialAccount,
      signAndSendTransaction,
      setSaving,
      updateProjectInStore,
      setCurrentProject,
      setIdle,
      setError,
    ]
  );

  /**
   * Delete a project.
   */
  const deleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      if (!isConnected || !accountId) {
        throw new WalletNotConnectedError();
      }

      try {
        setDeleting();

        // Optimistically remove from store
        removeProject(projectId);

        // Build and send transaction
        const account = await getSocialAccount();
        const transaction = await buildDeleteProjectTransaction(account, projectId);

        await signAndSendTransaction(transaction as unknown as { receiverId: string; actions: unknown[] });

        // Clear current project if it was the deleted one
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
        }

        setIdle();

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useProjects] Deleted project:', projectId);
        }
      } catch (err) {
        // Rollback would require re-fetching
        const socialError = toSocialError(err);
        setError(socialError);
        throw socialError;
      }
    },
    [
      isConnected,
      accountId,
      currentProject,
      getSocialAccount,
      signAndSendTransaction,
      setDeleting,
      removeProject,
      setCurrentProject,
      setIdle,
      setError,
    ]
  );

  /**
   * Select a project as current.
   */
  const selectProject = useCallback(
    (projectId: string | null) => {
      if (!projectId) {
        setCurrentProject(null);
        return;
      }

      // Check if we have it in the projects list
      const projectItem = projects.find((p) => p.id === projectId);
      if (!projectItem) {
        // Need to fetch it
        fetchProject(projectId).catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('[useProjects] Failed to select project:', err);
          }
        });
        return;
      }

      // If we have full project data in currentProject, keep it
      // Otherwise set a partial project from the list item
      if (currentProject?.id === projectId) {
        return; // Already selected
      }

      // Fetch full project data
      fetchProject(projectId).catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useProjects] Failed to fetch project:', err);
        }
      });
    },
    [projects, currentProject, fetchProject, setCurrentProject]
  );

  /**
   * Force refresh projects from NEAR Social.
   */
  const refreshProjects = useCallback(async () => {
    fetchAttempted.current = false;
    await fetchProjects();
  }, [fetchProjects]);

  // Reset store when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      reset();
      fetchAttempted.current = false;
    }
  }, [isConnected, reset]);

  return {
    // State
    status,
    projects,
    currentProject,
    error,
    isLoading: status === 'loading',
    isSaving: status === 'saving',
    isDeleting: status === 'deleting',

    // Actions
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    refreshProjects,
  };
}
