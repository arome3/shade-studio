import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectsStore } from '../projects-store';
import { SocialError, SocialErrorCode } from '@/lib/near/social-errors';
import type { ProjectListItem } from '@/types/project';

describe('projects-store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useProjectsStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have idle status by default', () => {
      const state = useProjectsStore.getState();
      expect(state.status).toBe('idle');
    });

    it('should have empty projects array by default', () => {
      const state = useProjectsStore.getState();
      expect(state.projects).toEqual([]);
    });

    it('should have null currentProject by default', () => {
      const state = useProjectsStore.getState();
      expect(state.currentProject).toBeNull();
    });

    it('should have null error by default', () => {
      const state = useProjectsStore.getState();
      expect(state.error).toBeNull();
    });

    it('should have null lastFetchedAt by default', () => {
      const state = useProjectsStore.getState();
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should transition to loading status', () => {
      useProjectsStore.getState().setLoading();
      expect(useProjectsStore.getState().status).toBe('loading');
    });

    it('should clear any existing error', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().setLoading();
      expect(useProjectsStore.getState().error).toBeNull();
    });
  });

  describe('setSaving', () => {
    it('should transition to saving status', () => {
      useProjectsStore.getState().setSaving();
      expect(useProjectsStore.getState().status).toBe('saving');
    });

    it('should clear any existing error', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().setSaving();
      expect(useProjectsStore.getState().error).toBeNull();
    });
  });

  describe('setDeleting', () => {
    it('should transition to deleting status', () => {
      useProjectsStore.getState().setDeleting();
      expect(useProjectsStore.getState().status).toBe('deleting');
    });

    it('should clear any existing error', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().setDeleting();
      expect(useProjectsStore.getState().error).toBeNull();
    });
  });

  describe('setIdle', () => {
    it('should transition to idle status', () => {
      useProjectsStore.getState().setLoading();
      useProjectsStore.getState().setIdle();
      expect(useProjectsStore.getState().status).toBe('idle');
    });
  });

  describe('setProjects', () => {
    const mockProjects: ProjectListItem[] = [
      {
        id: 'proj-1',
        name: 'Project 1',
        description: 'First project',
        status: 'draft',
        grantProgram: 'near-foundation',
        documentCount: 2,
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'proj-2',
        name: 'Project 2',
        description: 'Second project',
        status: 'active',
        grantProgram: 'proximity-labs',
        documentCount: 5,
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ];

    it('should replace all projects', () => {
      useProjectsStore.getState().setProjects(mockProjects);
      expect(useProjectsStore.getState().projects).toEqual(mockProjects);
    });

    it('should set status to idle', () => {
      useProjectsStore.getState().setLoading();
      useProjectsStore.getState().setProjects(mockProjects);
      expect(useProjectsStore.getState().status).toBe('idle');
    });

    it('should set lastFetchedAt timestamp', () => {
      const before = Date.now();
      useProjectsStore.getState().setProjects(mockProjects);
      const after = Date.now();

      const lastFetchedAt = useProjectsStore.getState().lastFetchedAt;
      expect(lastFetchedAt).toBeGreaterThanOrEqual(before);
      expect(lastFetchedAt).toBeLessThanOrEqual(after);
    });

    it('should clear error', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().setProjects(mockProjects);
      expect(useProjectsStore.getState().error).toBeNull();
    });
  });

  describe('setCurrentProject', () => {
    const mockProject = {
      id: 'proj-1',
      ownerId: 'alice.near',
      metadata: {
        name: 'Test Project',
        description: 'Test',
        grantProgram: 'near-foundation' as const,
        tags: [],
      },
      status: 'draft' as const,
      visibility: 'private' as const,
      team: [],
      documentIds: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should set the current project', () => {
      useProjectsStore.getState().setCurrentProject(mockProject);
      expect(useProjectsStore.getState().currentProject).toEqual(mockProject);
    });

    it('should allow clearing current project', () => {
      useProjectsStore.getState().setCurrentProject(mockProject);
      useProjectsStore.getState().setCurrentProject(null);
      expect(useProjectsStore.getState().currentProject).toBeNull();
    });
  });

  describe('addProject', () => {
    const mockProject: ProjectListItem = {
      id: 'proj-1',
      name: 'New Project',
      description: 'A new project',
      status: 'draft',
      grantProgram: 'near-foundation',
      documentCount: 0,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should add project to the beginning of the list', () => {
      const existingProject: ProjectListItem = {
        id: 'proj-0',
        name: 'Existing Project',
        description: 'Already there',
        status: 'active',
        grantProgram: 'proximity-labs',
        documentCount: 3,
        updatedAt: '2023-12-01T00:00:00.000Z',
      };

      useProjectsStore.getState().setProjects([existingProject]);
      useProjectsStore.getState().addProject(mockProject);

      const projects = useProjectsStore.getState().projects;
      expect(projects).toHaveLength(2);
      expect(projects[0]!.id).toBe('proj-1');
      expect(projects[1]!.id).toBe('proj-0');
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Original Name',
          description: 'Original description',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('should update project in the list', () => {
      useProjectsStore.getState().updateProject('proj-1', {
        name: 'Updated Name',
        status: 'active',
      });

      const project = useProjectsStore.getState().projects[0]!;
      expect(project.name).toBe('Updated Name');
      expect(project.status).toBe('active');
      expect(project.description).toBe('Original description'); // Unchanged
    });

    it('should not modify other projects', () => {
      useProjectsStore.getState().addProject({
        id: 'proj-2',
        name: 'Another Project',
        description: 'Another',
        status: 'draft',
        grantProgram: 'proximity-labs',
        documentCount: 0,
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      useProjectsStore.getState().updateProject('proj-1', { name: 'Updated' });

      const projects = useProjectsStore.getState().projects;
      expect(projects.find((p) => p.id === 'proj-2')?.name).toBe('Another Project');
    });

    it('should also update currentProject if same id', () => {
      const fullProject = {
        id: 'proj-1',
        ownerId: 'alice.near',
        metadata: {
          name: 'Original Name',
          description: 'Test',
          grantProgram: 'near-foundation' as const,
          tags: [],
        },
        status: 'draft' as const,
        visibility: 'private' as const,
        team: [],
        documentIds: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useProjectsStore.getState().setCurrentProject(fullProject);
      useProjectsStore.getState().updateProject('proj-1', { name: 'Updated Name' });

      const current = useProjectsStore.getState().currentProject;
      expect(current?.metadata.name).toBe('Original Name'); // Full project not updated by partial
    });
  });

  describe('removeProject', () => {
    beforeEach(() => {
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'First',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'proj-2',
          name: 'Project 2',
          description: 'Second',
          status: 'active',
          grantProgram: 'proximity-labs',
          documentCount: 3,
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ]);
    });

    it('should remove project from the list', () => {
      useProjectsStore.getState().removeProject('proj-1');

      const projects = useProjectsStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0]!.id).toBe('proj-2');
    });

    it('should clear currentProject if it matches removed id', () => {
      const fullProject = {
        id: 'proj-1',
        ownerId: 'alice.near',
        metadata: {
          name: 'Project 1',
          description: 'Test',
          grantProgram: 'near-foundation' as const,
          tags: [],
        },
        status: 'draft' as const,
        visibility: 'private' as const,
        team: [],
        documentIds: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useProjectsStore.getState().setCurrentProject(fullProject);
      useProjectsStore.getState().removeProject('proj-1');

      expect(useProjectsStore.getState().currentProject).toBeNull();
    });

    it('should keep currentProject if different id', () => {
      const fullProject = {
        id: 'proj-2',
        ownerId: 'alice.near',
        metadata: {
          name: 'Project 2',
          description: 'Test',
          grantProgram: 'proximity-labs' as const,
          tags: [],
        },
        status: 'active' as const,
        visibility: 'private' as const,
        team: [],
        documentIds: [],
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      useProjectsStore.getState().setCurrentProject(fullProject);
      useProjectsStore.getState().removeProject('proj-1');

      expect(useProjectsStore.getState().currentProject).not.toBeNull();
      expect(useProjectsStore.getState().currentProject?.id).toBe('proj-2');
    });
  });

  describe('setError', () => {
    it('should transition to error status', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      expect(useProjectsStore.getState().status).toBe('error');
    });

    it('should store the error', () => {
      const error = new SocialError(SocialErrorCode.READ_FAILED, 'Test error');
      useProjectsStore.getState().setError(error);
      expect(useProjectsStore.getState().error).toBe(error);
    });
  });

  describe('clearError', () => {
    it('should clear the error', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().clearError();
      expect(useProjectsStore.getState().error).toBeNull();
    });

    it('should not change the status', () => {
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));
      useProjectsStore.getState().clearError();
      expect(useProjectsStore.getState().status).toBe('error');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Set up some state
      useProjectsStore.getState().setProjects([
        {
          id: 'proj-1',
          name: 'Test',
          description: 'Test',
          status: 'draft',
          grantProgram: 'near-foundation',
          documentCount: 0,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.UNKNOWN));

      // Reset
      useProjectsStore.getState().reset();

      const state = useProjectsStore.getState();
      expect(state.status).toBe('idle');
      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.error).toBeNull();
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  describe('state transitions', () => {
    it('should follow loading → idle (success) flow', () => {
      useProjectsStore.getState().setLoading();
      expect(useProjectsStore.getState().status).toBe('loading');

      useProjectsStore.getState().setProjects([]);
      expect(useProjectsStore.getState().status).toBe('idle');
    });

    it('should follow loading → error flow', () => {
      useProjectsStore.getState().setLoading();
      expect(useProjectsStore.getState().status).toBe('loading');

      useProjectsStore.getState().setError(new SocialError(SocialErrorCode.READ_FAILED));
      expect(useProjectsStore.getState().status).toBe('error');
    });

    it('should follow saving → idle (success) flow', () => {
      useProjectsStore.getState().setSaving();
      expect(useProjectsStore.getState().status).toBe('saving');

      useProjectsStore.getState().setIdle();
      expect(useProjectsStore.getState().status).toBe('idle');
    });

    it('should follow deleting → idle (success) flow', () => {
      useProjectsStore.getState().setDeleting();
      expect(useProjectsStore.getState().status).toBe('deleting');

      useProjectsStore.getState().setIdle();
      expect(useProjectsStore.getState().status).toBe('idle');
    });
  });
});
