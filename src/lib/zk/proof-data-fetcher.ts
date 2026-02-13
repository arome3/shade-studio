/**
 * Proof Data Fetcher
 *
 * Gathers real user activity data from NEAR indexer/RPC before ZK proof
 * generation. Falls back to mock data in development when
 * NEXT_PUBLIC_USE_MOCK_DATA=true.
 *
 * Each function returns the exact data shape expected by input-preparation.ts.
 */

import type {
  VerifiedBuilderData,
  GrantTrackRecordData,
  TeamAttestationData,
} from './input-preparation';
import { ZKError } from './errors';

// ============================================================================
// Config
// ============================================================================

const INDEXER_URL =
  process.env.NEXT_PUBLIC_NEAR_INDEXER_URL ?? 'https://api.kitwallet.app';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// ============================================================================
// Error
// ============================================================================

export class DataFetchError extends ZKError {
  constructor(source: string, cause?: string) {
    super(
      `Failed to fetch ${source} data${cause ? `: ${cause}` : ''}`,
      'DATA_FETCH_ERROR',
      { source, cause }
    );
    this.name = 'DataFetchError';
  }
}

// ============================================================================
// Mock Data (development / testing)
// ============================================================================

function generateMockBuilderData(minDays: number): VerifiedBuilderData {
  const now = Math.floor(Date.now() / 1000);
  const dayInSecs = 86400;
  const timestamps: number[] = [];
  for (let i = 0; i < Math.max(minDays + 5, 35); i++) {
    timestamps.push(now - i * dayInSecs);
  }

  // Mock Merkle proofs with depth 20
  const mockProof = {
    siblings: new Array(20).fill('12345678901234567890'),
    pathIndices: new Array(20).fill(0),
  };

  return {
    activityTimestamps: timestamps,
    activityProofs: timestamps.map(() => ({ ...mockProof })),
    activityRoot: '9876543210987654321098765432109876543210',
    minDays,
    currentTimestamp: now,
  };
}

function generateMockGrantData(minGrants: number): GrantTrackRecordData {
  const grantCount = Math.max(minGrants + 2, 5);
  const mockMerkleProof = {
    siblings: new Array(15).fill('11111111111111111111'),
    pathIndices: new Array(15).fill(0),
  };
  const mockProgramProof = {
    siblings: new Array(10).fill('22222222222222222222'),
    pathIndices: new Array(10).fill(0),
  };

  const grants = Array.from({ length: grantCount }, (_, i) => ({
    grantId: `grant-${i + 1}`,
    isCompleted: i < minGrants + 1,
    grantProof: { ...mockMerkleProof },
    programId: `program-${(i % 3) + 1}`,
    programProof: { ...mockProgramProof },
  }));

  return {
    grants,
    grantRoot: '33333333333333333333333333333333333333',
    programsRoot: '44444444444444444444444444444444444444',
    minGrants,
  };
}

function generateMockAttestationData(
  minAttestations: number
): TeamAttestationData {
  const count = Math.max(minAttestations + 1, 4);
  const mockProof = {
    siblings: new Array(20).fill('55555555555555555555'),
    pathIndices: new Array(20).fill(0),
  };

  const attestations = Array.from({ length: count }, (_, i) => ({
    pubKey: [`pubX-${i}`, `pubY-${i}`] as [string, string],
    signature: [`R8x-${i}`, `R8y-${i}`, `S-${i}`] as [string, string, string],
    message: `attestation-message-${i}`,
    attesterProof: { ...mockProof },
  }));

  return {
    attestations,
    attestersRoot: '66666666666666666666666666666666666666',
    minAttestations,
    credentialType: 1,
  };
}

// ============================================================================
// Indexer Fetchers
// ============================================================================

async function fetchFromIndexer<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const url = `${INDEXER_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new DataFetchError(path, `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch verified builder data (activity timestamps + Merkle proofs).
 * Falls back to mock data in development.
 */
export async function fetchVerifiedBuilderData(
  accountId: string,
  minDays: number,
  signal?: AbortSignal
): Promise<VerifiedBuilderData> {
  if (USE_MOCK_DATA) {
    return generateMockBuilderData(minDays);
  }

  try {
    const activity = await fetchFromIndexer<{
      timestamps: number[];
      merkle_root: string;
      proofs: Array<{ siblings: string[]; path_indices: number[] }>;
    }>(`/account/${accountId}/activity?min_days=${minDays}`, signal);

    return {
      activityTimestamps: activity.timestamps,
      activityProofs: activity.proofs.map((p) => ({
        siblings: p.siblings,
        pathIndices: p.path_indices,
      })),
      activityRoot: activity.merkle_root,
      minDays,
      currentTimestamp: Math.floor(Date.now() / 1000),
    };
  } catch (err) {
    if (err instanceof DataFetchError) throw err;
    throw new DataFetchError(
      'verified-builder',
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Fetch grant track record data (grant history + Merkle proofs).
 * Falls back to mock data in development.
 */
export async function fetchGrantTrackRecordData(
  accountId: string,
  minGrants: number,
  signal?: AbortSignal
): Promise<GrantTrackRecordData> {
  if (USE_MOCK_DATA) {
    return generateMockGrantData(minGrants);
  }

  try {
    const grants = await fetchFromIndexer<{
      grants: Array<{
        grant_id: string;
        is_completed: boolean;
        grant_proof: { siblings: string[]; path_indices: number[] };
        program_id: string;
        program_proof: { siblings: string[]; path_indices: number[] };
      }>;
      grant_root: string;
      programs_root: string;
    }>(`/account/${accountId}/grants?min_grants=${minGrants}`, signal);

    return {
      grants: grants.grants.map((g) => ({
        grantId: g.grant_id,
        isCompleted: g.is_completed,
        grantProof: {
          siblings: g.grant_proof.siblings,
          pathIndices: g.grant_proof.path_indices,
        },
        programId: g.program_id,
        programProof: {
          siblings: g.program_proof.siblings,
          pathIndices: g.program_proof.path_indices,
        },
      })),
      grantRoot: grants.grant_root,
      programsRoot: grants.programs_root,
      minGrants,
    };
  } catch (err) {
    if (err instanceof DataFetchError) throw err;
    throw new DataFetchError(
      'grant-track-record',
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Fetch team attestation data (attestation records with EdDSA signatures).
 * Falls back to mock data in development.
 */
export async function fetchTeamAttestationData(
  accountId: string,
  minAttestations: number,
  signal?: AbortSignal
): Promise<TeamAttestationData> {
  if (USE_MOCK_DATA) {
    return generateMockAttestationData(minAttestations);
  }

  try {
    const attestations = await fetchFromIndexer<{
      attestations: Array<{
        pub_key: [string, string];
        signature: [string, string, string];
        message: string;
        attester_proof: { siblings: string[]; path_indices: number[] };
      }>;
      attesters_root: string;
      credential_type: number;
    }>(`/account/${accountId}/attestations?min=${minAttestations}`, signal);

    return {
      attestations: attestations.attestations.map((a) => ({
        pubKey: a.pub_key,
        signature: a.signature,
        message: a.message,
        attesterProof: {
          siblings: a.attester_proof.siblings,
          pathIndices: a.attester_proof.path_indices,
        },
      })),
      attestersRoot: attestations.attesters_root,
      minAttestations,
      credentialType: attestations.credential_type,
    };
  } catch (err) {
    if (err instanceof DataFetchError) throw err;
    throw new DataFetchError(
      'team-attestation',
      err instanceof Error ? err.message : String(err)
    );
  }
}
