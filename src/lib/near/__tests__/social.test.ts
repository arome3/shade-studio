import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getSocialClient,
  resetSocialClient,
  buildProjectPath,
  buildDocumentPath,
  buildProposalPath,
  buildSettingsPath,
  serializeForStorage,
  parseFromStorage,
  extractNestedData,
  getProjects,
  getProject,
  getDocuments,
  getProposals,
  getSettings,
  buildSaveProjectTransaction,
  buildDeleteProjectTransaction,
  type StoredProjectMetadata,
  type SocialAccount,
} from '../social';

// Mock the @builddao/near-social-js module
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('@builddao/near-social-js', () => ({
  Social: vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
  })),
}));

// Mock the config
vi.mock('@/lib/config', () => ({
  config: {
    near: {
      socialContractId: 'v1.social08.testnet',
    },
  },
}));

// Mock getNetworkConfig
vi.mock('../config', () => ({
  getNetworkConfig: () => ({
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
  }),
}));

// ---------------------------------------------------------------------------
// Helper: mock global fetch for read operations (socialGet uses fetch('/api/social'))
// ---------------------------------------------------------------------------
function mockFetchWithData(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }));
}

describe('NEAR Social Client', () => {
  beforeEach(() => {
    resetSocialClient();
    vi.clearAllMocks();
    // Restore real fetch after each test (stubGlobal overrides it)
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetSocialClient();
    vi.unstubAllGlobals();
  });

  describe('getSocialClient', () => {
    it('should return a Social client instance', () => {
      const client = getSocialClient();
      expect(client).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const client1 = getSocialClient();
      const client2 = getSocialClient();
      expect(client1).toBe(client2);
    });
  });

  describe('resetSocialClient', () => {
    it('should reset the singleton instance', () => {
      const client1 = getSocialClient();
      resetSocialClient();
      const client2 = getSocialClient();
      // After reset, a new instance should be created
      expect(client1).not.toBe(client2);
    });
  });

  describe('Path Building Helpers', () => {
    describe('buildProjectPath', () => {
      it('should build path for all projects', () => {
        const path = buildProjectPath('alice.near');
        expect(path).toBe('alice.near/private-grant-studio/projects');
      });

      it('should build path for a specific project', () => {
        const path = buildProjectPath('alice.near', 'project-123');
        expect(path).toBe('alice.near/private-grant-studio/projects/project-123');
      });
    });

    describe('buildDocumentPath', () => {
      it('should build path for all documents in a project', () => {
        const path = buildDocumentPath('alice.near', 'project-123');
        expect(path).toBe('alice.near/private-grant-studio/projects/project-123/documents');
      });

      it('should build path for a specific document', () => {
        const path = buildDocumentPath('alice.near', 'project-123', 'doc-456');
        expect(path).toBe('alice.near/private-grant-studio/projects/project-123/documents/doc-456');
      });
    });

    describe('buildProposalPath', () => {
      it('should build path for all proposals in a project', () => {
        const path = buildProposalPath('alice.near', 'project-123');
        expect(path).toBe('alice.near/private-grant-studio/projects/project-123/proposals');
      });

      it('should build path for a specific proposal', () => {
        const path = buildProposalPath('alice.near', 'project-123', 'prop-789');
        expect(path).toBe('alice.near/private-grant-studio/projects/project-123/proposals/prop-789');
      });
    });

    describe('buildSettingsPath', () => {
      it('should build path for user settings', () => {
        const path = buildSettingsPath('alice.near');
        expect(path).toBe('alice.near/private-grant-studio/settings');
      });
    });
  });

  describe('Data Serialization', () => {
    describe('serializeForStorage', () => {
      it('should serialize objects to JSON strings', () => {
        const data = { name: 'Test', value: 123 };
        const serialized = serializeForStorage(data);
        expect(serialized).toBe('{"name":"Test","value":123}');
      });

      it('should handle nested objects', () => {
        const data = { nested: { deep: { value: true } } };
        const serialized = serializeForStorage(data);
        expect(serialized).toBe('{"nested":{"deep":{"value":true}}}');
      });
    });

    describe('parseFromStorage', () => {
      it('should parse JSON strings', () => {
        const result = parseFromStorage<{ name: string }>('{"name":"Test"}');
        expect(result).toEqual({ name: 'Test' });
      });

      it('should return null for invalid JSON', () => {
        const result = parseFromStorage('not json');
        expect(result).toBeNull();
      });

      it('should return null for null/undefined', () => {
        expect(parseFromStorage(null)).toBeNull();
        expect(parseFromStorage(undefined)).toBeNull();
      });

      it('should pass through objects as-is', () => {
        const obj = { name: 'Test' };
        const result = parseFromStorage<{ name: string }>(obj);
        expect(result).toBe(obj);
      });
    });

    describe('extractNestedData', () => {
      it('should extract data from nested response', () => {
        const response = {
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'project-1': { name: 'Test' },
              },
            },
          },
        };

        const result = extractNestedData<Record<string, { name: string }>>(
          response,
          'alice.near',
          'private-grant-studio',
          'projects'
        );

        expect(result).toEqual({ 'project-1': { name: 'Test' } });
      });

      it('should return null for missing paths', () => {
        const response = { 'alice.near': {} };
        const result = extractNestedData(
          response,
          'alice.near',
          'missing',
          'path'
        );
        expect(result).toBeNull();
      });

      it('should return null for null response', () => {
        const result = extractNestedData(
          null as unknown as Record<string, unknown>,
          'alice.near'
        );
        expect(result).toBeNull();
      });
    });
  });

  describe('Read Operations', () => {
    describe('getProjects', () => {
      it('should fetch and parse projects', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'proj-1': {
                  metadata: JSON.stringify({
                    name: 'Project 1',
                    description: 'Test project',
                    grantProgram: 'near-foundation',
                    status: 'draft',
                    visibility: 'private',
                    createdAt: 1704067200000,
                    updatedAt: 1704067200000,
                  }),
                },
              },
            },
          },
        });

        const projects = await getProjects('alice.near');

        expect(projects).toHaveProperty('proj-1');
        expect(projects['proj-1']!.metadata.name).toBe('Project 1');
      });

      it('should return empty object when no projects exist', async () => {
        mockFetchWithData({});

        const projects = await getProjects('alice.near');
        expect(projects).toEqual({});
      });

      it('should skip invalid project data', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'valid-proj': {
                  metadata: JSON.stringify({
                    name: 'Valid',
                    description: 'Test',
                    grantProgram: 'near-foundation',
                    status: 'draft',
                    visibility: 'private',
                    createdAt: 1704067200000,
                    updatedAt: 1704067200000,
                  }),
                },
                'invalid-proj': {
                  metadata: 'not valid json{{{',
                },
              },
            },
          },
        });

        const projects = await getProjects('alice.near');

        expect(projects).toHaveProperty('valid-proj');
        expect(projects).not.toHaveProperty('invalid-proj');
      });
    });

    describe('getProject', () => {
      it('should fetch a single project', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'proj-1': {
                  metadata: JSON.stringify({
                    name: 'Project 1',
                    description: 'Test',
                    grantProgram: 'near-foundation',
                    status: 'draft',
                    visibility: 'private',
                    createdAt: 1704067200000,
                    updatedAt: 1704067200000,
                  }),
                },
              },
            },
          },
        });

        const project = await getProject('alice.near', 'proj-1');

        expect(project?.metadata.name).toBe('Project 1');
      });

      it('should return null for non-existent project', async () => {
        mockFetchWithData({});

        const project = await getProject('alice.near', 'non-existent');
        expect(project).toBeNull();
      });
    });

    describe('getDocuments', () => {
      it('should fetch documents for a project', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'proj-1': {
                  documents: {
                    'doc-1': JSON.stringify({
                      name: 'Document 1',
                      type: 'proposal',
                      ipfsCid: 'Qm123',
                      encryptionNonce: 'abc',
                      size: 1024,
                      createdAt: 1704067200000,
                      updatedAt: 1704067200000,
                    }),
                  },
                },
              },
            },
          },
        });

        const documents = await getDocuments('alice.near', 'proj-1');

        expect(documents).toHaveProperty('doc-1');
        expect(documents['doc-1']!.name).toBe('Document 1');
      });
    });

    describe('getProposals', () => {
      it('should fetch proposals for a project', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              projects: {
                'proj-1': {
                  proposals: {
                    'prop-1': JSON.stringify({
                      title: 'Proposal 1',
                      grantProgram: 'near-foundation',
                      status: 'draft',
                      createdAt: 1704067200000,
                      updatedAt: 1704067200000,
                    }),
                  },
                },
              },
            },
          },
        });

        const proposals = await getProposals('alice.near', 'proj-1');

        expect(proposals).toHaveProperty('prop-1');
        expect(proposals['prop-1']!.title).toBe('Proposal 1');
      });
    });

    describe('getSettings', () => {
      it('should fetch user settings', async () => {
        mockFetchWithData({
          'alice.near': {
            'private-grant-studio': {
              settings: JSON.stringify({
                defaultGrantProgram: 'near-foundation',
                theme: 'dark',
              }),
            },
          },
        });

        const settings = await getSettings('alice.near');

        expect(settings?.defaultGrantProgram).toBe('near-foundation');
        expect(settings?.theme).toBe('dark');
      });

      it('should return null when no settings exist', async () => {
        mockFetchWithData({});

        const settings = await getSettings('alice.near');
        expect(settings).toBeNull();
      });
    });
  });

  describe('Write Operations', () => {
    const mockAccount: SocialAccount = {
      accountId: 'alice.near',
      publicKey: 'ed25519:ABC123',
    };

    const mockProjectData: StoredProjectMetadata = {
      name: 'Test Project',
      description: 'A test project',
      grantProgram: 'near-foundation',
      status: 'draft',
      visibility: 'private',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    describe('buildSaveProjectTransaction', () => {
      it('should build a transaction for saving project', async () => {
        const mockTransaction = { receiverId: 'v1.social08.testnet', actions: [] };
        mockSet.mockResolvedValueOnce(mockTransaction);

        const transaction = await buildSaveProjectTransaction(
          mockAccount,
          'proj-1',
          mockProjectData
        );

        expect(mockSet).toHaveBeenCalled();
        expect(transaction).toBe(mockTransaction);

        // Verify the data structure passed to set
        const setCall = mockSet.mock.calls[0]![0];
        expect(setCall.account.accountID).toBe('alice.near');
        expect(setCall.data['alice.near']).toBeDefined();
      });

      it('should include serialized metadata in transaction data', async () => {
        mockSet.mockResolvedValueOnce({ receiverId: 'test', actions: [] });

        await buildSaveProjectTransaction(mockAccount, 'proj-1', mockProjectData);

        const setCall = mockSet.mock.calls[0]![0];
        const projectData = setCall.data['alice.near']['private-grant-studio']['projects']['proj-1'];

        // Metadata should be serialized as JSON string
        expect(typeof projectData.metadata).toBe('string');
        expect(JSON.parse(projectData.metadata).name).toBe('Test Project');
      });
    });

    describe('buildDeleteProjectTransaction', () => {
      it('should build a transaction for deleting project', async () => {
        const mockTransaction = { receiverId: 'v1.social08.testnet', actions: [] };
        mockSet.mockResolvedValueOnce(mockTransaction);

        const transaction = await buildDeleteProjectTransaction(mockAccount, 'proj-1');

        expect(mockSet).toHaveBeenCalled();
        expect(transaction).toBe(mockTransaction);

        // Verify the data sets project to empty string (NEAR Social convention for deletion)
        const setCall = mockSet.mock.calls[0]![0];
        const projectData = setCall.data['alice.near']['private-grant-studio']['projects']['proj-1'];
        expect(projectData).toBe('');
      });
    });
  });
});
