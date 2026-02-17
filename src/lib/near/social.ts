/**
 * NEAR Social client for Private Grant Studio.
 * Provides read/write operations to the social.near contract for storing
 * project metadata, document references, and user settings.
 */

import { Social } from '@builddao/near-social-js';
import { config } from '@/lib/config';
import { getNetworkConfig } from './config';
import { SocialReadError, toSocialError } from './social-errors';
import type { EncryptedPayload } from '@/types/document';

/**
 * Account interface required by near-social-js for write operations.
 * Note: The library uses accountID (capital ID) internally.
 */
export interface SocialAccount {
  accountId: string;
  publicKey: string;
}

/**
 * Transaction returned by near-social-js set() method.
 * This is a generic type as the library doesn't export specific types.
 */
export interface SocialTransaction {
  receiverId: string;
  actions: Array<{
    functionCall?: {
      methodName: string;
      args: Uint8Array;
      gas: bigint;
      deposit: bigint;
    };
  }>;
}

/**
 * Project metadata stored in NEAR Social.
 * This is the format for data persistence.
 */
export interface StoredProjectMetadata {
  name: string;
  description: string;
  grantProgram: string;
  status: string;
  visibility: string;
  createdAt: number;
  updatedAt: number;
  /** Encrypted sensitive data (optional) */
  encrypted?: EncryptedPayload;
}

/**
 * Document metadata stored in NEAR Social.
 */
export interface StoredDocumentMetadata {
  name: string;
  type: string;
  /** Original MIME type for file reconstruction */
  mimeType: string;
  ipfsCid: string;
  encryptionNonce: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  /** Optional tags for organization */
  tags?: string[];
}

/**
 * Proposal metadata stored in NEAR Social.
 */
export interface StoredProposalMetadata {
  title: string;
  grantProgram: string;
  status: string;
  ipfsCid?: string;
  encryptionNonce?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * User settings stored in NEAR Social.
 */
export interface StoredUserSettings {
  defaultGrantProgram?: string;
  theme?: 'light' | 'dark' | 'system';
  lastActiveProjectId?: string;
}

/**
 * Project data structure as returned from NEAR Social.
 */
export interface SocialProjectData {
  metadata: StoredProjectMetadata;
  documents?: Record<string, StoredDocumentMetadata>;
  proposals?: Record<string, StoredProposalMetadata>;
}

/**
 * Complete user data export structure.
 */
export interface UserDataExport {
  projects: Record<string, SocialProjectData>;
  settings: StoredUserSettings;
  exportedAt: number;
}

/**
 * Application namespace for storing data.
 */
const APP_NAMESPACE = 'private-grant-studio';

/**
 * Singleton instance of the Social client.
 */
let socialInstance: Social | null = null;

/**
 * Initialize or get the NEAR Social client singleton.
 * Configures the client based on the current network (mainnet/testnet).
 *
 * @returns The Social client instance
 */
export function getSocialClient(): Social {
  if (socialInstance) {
    return socialInstance;
  }

  const networkConfig = getNetworkConfig();

  socialInstance = new Social({
    contractId: config.near.socialContractId,
    network: networkConfig.networkId,
  });

  return socialInstance;
}

/**
 * Reset the Social client instance.
 * Primarily used for testing.
 */
export function resetSocialClient(): void {
  socialInstance = null;
}

/**
 * Read data from NEAR Social via server-side proxy.
 * Avoids CORS issues by routing through /api/social.
 *
 * @param keys - Array of NEAR Social key patterns
 * @returns Parsed response data
 */
async function socialGet(keys: string[]): Promise<Record<string, unknown>> {
  const response = await fetch('/api/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Social API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Build the path for a project in NEAR Social.
 *
 * @param accountId - The account ID
 * @param projectId - Optional project ID for specific project
 * @returns The full path string
 */
export function buildProjectPath(accountId: string, projectId?: string): string {
  const basePath = `${accountId}/${APP_NAMESPACE}/projects`;
  return projectId ? `${basePath}/${projectId}` : basePath;
}

/**
 * Build the path for a document in NEAR Social.
 *
 * @param accountId - The account ID
 * @param projectId - The project ID
 * @param documentId - Optional document ID for specific document
 * @returns The full path string
 */
export function buildDocumentPath(
  accountId: string,
  projectId: string,
  documentId?: string
): string {
  const basePath = `${accountId}/${APP_NAMESPACE}/projects/${projectId}/documents`;
  return documentId ? `${basePath}/${documentId}` : basePath;
}

/**
 * Build the path for a proposal in NEAR Social.
 *
 * @param accountId - The account ID
 * @param projectId - The project ID
 * @param proposalId - Optional proposal ID for specific proposal
 * @returns The full path string
 */
export function buildProposalPath(
  accountId: string,
  projectId: string,
  proposalId?: string
): string {
  const basePath = `${accountId}/${APP_NAMESPACE}/projects/${projectId}/proposals`;
  return proposalId ? `${basePath}/${proposalId}` : basePath;
}

/**
 * Build the path for user settings in NEAR Social.
 *
 * @param accountId - The account ID
 * @returns The full path string
 */
export function buildSettingsPath(accountId: string): string {
  return `${accountId}/${APP_NAMESPACE}/settings`;
}

/**
 * Serialize data for storage in NEAR Social.
 * Converts nested objects to the format expected by the contract.
 *
 * @param data - Data to serialize
 * @returns Serialized data ready for storage
 */
export function serializeForStorage<T>(data: T): string {
  return JSON.stringify(data);
}

/**
 * Parse data retrieved from NEAR Social.
 *
 * @param data - Raw data from NEAR Social
 * @returns Parsed data
 */
export function parseFromStorage<T>(data: string | unknown): T | null {
  if (!data) {
    return null;
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  return data as T;
}

/**
 * Extract nested data from NEAR Social response structure.
 * NEAR Social returns data in nested format: {accountId: {path: {to: data}}}
 *
 * @param response - Raw response from NEAR Social
 * @param accountId - Account ID to extract from
 * @param path - Path segments to follow
 * @returns Extracted data or null
 */
export function extractNestedData<T>(
  response: Record<string, unknown>,
  accountId: string,
  ...path: string[]
): T | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  let current: unknown = response[accountId];

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current as T | null;
}

// ============================================================================
// Read Operations (View functions - no wallet required)
// ============================================================================

/**
 * Get all projects for an account.
 *
 * @param accountId - The NEAR account ID
 * @returns Map of project IDs to project data
 */
export async function getProjects(
  accountId: string
): Promise<Record<string, SocialProjectData>> {
  try {
    const keys = [`${accountId}/${APP_NAMESPACE}/projects/**`];
    const response = await socialGet(keys);

    const projectsData = extractNestedData<Record<string, Record<string, unknown>>>(
      response,
      accountId,
      APP_NAMESPACE,
      'projects'
    );

    if (!projectsData) {
      return {};
    }

    // Parse each project's metadata
    const projects: Record<string, SocialProjectData> = {};

    for (const [projectId, projectData] of Object.entries(projectsData)) {
      if (!projectData || typeof projectData !== 'object') {
        continue;
      }

      const rawMetadata = (projectData as Record<string, unknown>).metadata;
      const metadata = parseFromStorage<StoredProjectMetadata>(rawMetadata);

      if (metadata) {
        projects[projectId] = {
          metadata,
          documents: parseDocumentsData(
            (projectData as Record<string, unknown>).documents
          ),
          proposals: parseProposalsData(
            (projectData as Record<string, unknown>).proposals
          ),
        };
      }
    }

    return projects;
  } catch (error) {
    // Return empty for missing data (new users with no projects yet)
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[Social] No projects found for ${accountId} — returning empty`,
        error
      );
    }
    return {};
  }
}

/**
 * Get a single project by ID.
 *
 * @param accountId - The NEAR account ID
 * @param projectId - The project ID
 * @returns Project data or null if not found
 */
export async function getProject(
  accountId: string,
  projectId: string
): Promise<SocialProjectData | null> {
  try {
    const keys = [`${accountId}/${APP_NAMESPACE}/projects/${projectId}/**`];
    const response = await socialGet(keys);

    const projectData = extractNestedData<Record<string, unknown>>(
      response,
      accountId,
      APP_NAMESPACE,
      'projects',
      projectId
    );

    if (!projectData) {
      return null;
    }

    const metadata = parseFromStorage<StoredProjectMetadata>(projectData.metadata);

    if (!metadata) {
      return null;
    }

    return {
      metadata,
      documents: parseDocumentsData(projectData.documents),
      proposals: parseProposalsData(projectData.proposals),
    };
  } catch (error) {
    throw new SocialReadError(
      `Failed to get project ${projectId}`,
      error
    );
  }
}

/**
 * Get all documents for a project.
 *
 * @param accountId - The NEAR account ID
 * @param projectId - The project ID
 * @returns Map of document IDs to document metadata
 */
export async function getDocuments(
  accountId: string,
  projectId: string
): Promise<Record<string, StoredDocumentMetadata>> {
  try {
    const keys = [
      `${accountId}/${APP_NAMESPACE}/projects/${projectId}/documents/**`,
    ];

    const response = await socialGet(keys);

    const documentsData = extractNestedData<Record<string, unknown>>(
      response,
      accountId,
      APP_NAMESPACE,
      'projects',
      projectId,
      'documents'
    );

    return parseDocumentsData(documentsData) ?? {};
  } catch (error) {
    // Return empty for missing data (new users with no documents stored yet)
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[Social] getDocuments FAILED for ${accountId}/${projectId}:`,
        error
      );
    }
    return {};
  }
}

/**
 * Get all proposals for a project.
 *
 * @param accountId - The NEAR account ID
 * @param projectId - The project ID
 * @returns Map of proposal IDs to proposal metadata
 */
export async function getProposals(
  accountId: string,
  projectId: string
): Promise<Record<string, StoredProposalMetadata>> {
  try {
    const keys = [
      `${accountId}/${APP_NAMESPACE}/projects/${projectId}/proposals/**`,
    ];
    const response = await socialGet(keys);

    const proposalsData = extractNestedData<Record<string, unknown>>(
      response,
      accountId,
      APP_NAMESPACE,
      'projects',
      projectId,
      'proposals'
    );

    return parseProposalsData(proposalsData) ?? {};
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[Social] No proposals found for ${projectId} — returning empty`,
        error
      );
    }
    return {};
  }
}

/**
 * Get user settings.
 *
 * @param accountId - The NEAR account ID
 * @returns User settings or null if not set
 */
export async function getSettings(
  accountId: string
): Promise<StoredUserSettings | null> {
  try {
    const keys = [`${accountId}/${APP_NAMESPACE}/settings`];
    const response = await socialGet(keys);

    const settings = extractNestedData<unknown>(
      response,
      accountId,
      APP_NAMESPACE,
      'settings'
    );

    return parseFromStorage<StoredUserSettings>(settings);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[Social] No settings found for ${accountId} — returning null`,
        error
      );
    }
    return null;
  }
}

/**
 * Export all user data.
 *
 * @param accountId - The NEAR account ID
 * @returns Complete user data export
 */
export async function exportAllData(accountId: string): Promise<UserDataExport> {
  const [projects, settings] = await Promise.all([
    getProjects(accountId),
    getSettings(accountId),
  ]);

  return {
    projects,
    settings: settings ?? {},
    exportedAt: Date.now(),
  };
}

// ============================================================================
// Write Operations (Return transactions for signing)
// ============================================================================

/**
 * Build a transaction to save project metadata.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID
 * @param data - Project metadata to save
 * @returns Unsigned transaction
 */
export async function buildSaveProjectTransaction(
  account: SocialAccount,
  projectId: string,
  data: StoredProjectMetadata
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: {
                metadata: serializeForStorage(data),
              },
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to save document metadata.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID
 * @param documentId - The document ID
 * @param data - Document metadata to save
 * @returns Unsigned transaction
 */
export async function buildSaveDocumentTransaction(
  account: SocialAccount,
  projectId: string,
  documentId: string,
  data: StoredDocumentMetadata
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: {
                documents: {
                  [documentId]: serializeForStorage(data),
                },
              },
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to save proposal metadata.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID
 * @param proposalId - The proposal ID
 * @param data - Proposal metadata to save
 * @returns Unsigned transaction
 */
export async function buildSaveProposalTransaction(
  account: SocialAccount,
  projectId: string,
  proposalId: string,
  data: StoredProposalMetadata
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: {
                proposals: {
                  [proposalId]: serializeForStorage(data),
                },
              },
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to save user settings.
 *
 * @param account - The account object with ID and public key
 * @param settings - User settings to save
 * @returns Unsigned transaction
 */
export async function buildSaveSettingsTransaction(
  account: SocialAccount,
  settings: StoredUserSettings
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            settings: serializeForStorage(settings),
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to delete a project.
 * Sets the project data to null, which removes it from storage.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID to delete
 * @returns Unsigned transaction
 */
export async function buildDeleteProjectTransaction(
  account: SocialAccount,
  projectId: string
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: '',
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to delete a document.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID
 * @param documentId - The document ID to delete
 * @returns Unsigned transaction
 */
export async function buildDeleteDocumentTransaction(
  account: SocialAccount,
  projectId: string,
  documentId: string
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    // Use empty string as deletion marker instead of null.
    // near-social-js's parseKeysFromData crashes on null (typeof null === 'object'
    // so Object.entries(null) throws). Empty strings are filtered out when reading.
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: {
                documents: {
                  [documentId]: '',
                },
              },
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

/**
 * Build a transaction to delete a proposal.
 *
 * @param account - The account object with ID and public key
 * @param projectId - The project ID
 * @param proposalId - The proposal ID to delete
 * @returns Unsigned transaction
 */
export async function buildDeleteProposalTransaction(
  account: SocialAccount,
  projectId: string,
  proposalId: string
): Promise<SocialTransaction> {
  const social = getSocialClient();

  try {
    const transaction = await social.set({
      account: {
        accountID: account.accountId,
        publicKey: account.publicKey,
      },
      data: {
        [account.accountId]: {
          [APP_NAMESPACE]: {
            projects: {
              [projectId]: {
                proposals: {
                  [proposalId]: '',
                },
              },
            },
          },
        },
      },
    });

    return transaction as unknown as SocialTransaction;
  } catch (error) {
    throw toSocialError(error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse documents data from NEAR Social response.
 */
function parseDocumentsData(
  data: unknown
): Record<string, StoredDocumentMetadata> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const documents: Record<string, StoredDocumentMetadata> = {};

  for (const [docId, docData] of Object.entries(
    data as Record<string, unknown>
  )) {
    const parsed = parseFromStorage<StoredDocumentMetadata>(docData);
    if (parsed) {
      documents[docId] = parsed;
    }
  }

  return Object.keys(documents).length > 0 ? documents : undefined;
}

/**
 * Parse proposals data from NEAR Social response.
 */
function parseProposalsData(
  data: unknown
): Record<string, StoredProposalMetadata> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const proposals: Record<string, StoredProposalMetadata> = {};

  for (const [propId, propData] of Object.entries(
    data as Record<string, unknown>
  )) {
    const parsed = parseFromStorage<StoredProposalMetadata>(propData);
    if (parsed) {
      proposals[propId] = parsed;
    }
  }

  return Object.keys(proposals).length > 0 ? proposals : undefined;
}
