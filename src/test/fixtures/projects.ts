/**
 * Project test fixtures.
 *
 * Factory functions for Project and ProjectListItem shapes
 * matching the projects-store types.
 */

import type { Project, ProjectListItem, ProjectStatus, GrantProgram } from '@/types/project';

let fixtureCounter = 0;

export function createMockProject(overrides?: Partial<Project>): Project {
  const id = `project-${++fixtureCounter}`;
  const now = new Date().toISOString();

  return {
    id,
    ownerId: 'test.near',
    metadata: {
      name: `Test Project ${fixtureCounter}`,
      description: 'A test project for Private Grant Studio.',
      grantProgram: 'near-foundation' as GrantProgram,
      fundingAmount: 50000,
      tags: ['defi', 'privacy'],
    },
    status: 'active' as ProjectStatus,
    visibility: 'private',
    team: [
      {
        accountId: 'test.near',
        role: 'owner',
        joinedAt: now,
      },
    ],
    documentIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockProjectListItem(
  overrides?: Partial<ProjectListItem>
): ProjectListItem {
  const id = `project-${++fixtureCounter}`;

  return {
    id,
    name: `Test Project ${fixtureCounter}`,
    description: 'A test project for Private Grant Studio.',
    status: 'active' as ProjectStatus,
    grantProgram: 'near-foundation' as GrantProgram,
    documentCount: 3,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Reset the fixture counter (call in beforeEach for deterministic IDs).
 */
export function resetProjectFixtures() {
  fixtureCounter = 0;
}
