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
import { ZK_CIRCUIT_PARAMS } from '@/lib/constants';
import { getPoseidon } from './poseidon';

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

/**
 * Build a sparse Poseidon Merkle tree and return proofs.
 *
 * Optimization: precompute "zero subtree" hashes for each level so we only
 * hash nodes with at least one non-zero descendant. For 10 leaves in a
 * depth-20 tree this reduces work from ~1M hashes to ~200 hashes.
 */
async function buildPoseidonMerkleTree(
  leaves: bigint[],
  depth: number
): Promise<{ root: string; proofs: { siblings: string[]; pathIndices: number[] }[] }> {
  const poseidon = await getPoseidon();
  const F = poseidon.F;

  // Precompute zero subtree hashes: zeroH[0] = 0, zeroH[d+1] = Poseidon(zeroH[d], zeroH[d])
  const zeroH: bigint[] = [BigInt(0)];
  for (let d = 0; d < depth; d++) {
    const raw = poseidon.hash([zeroH[d]!, zeroH[d]!]);
    zeroH.push(F.toObject(raw));
  }

  // Sparse tree: Map<nodeIndex, value> per level
  // Level 0 = leaves, level `depth` = root
  const levels: Map<number, bigint>[] = Array.from({ length: depth + 1 }, () => new Map());

  // Set real leaves
  for (let i = 0; i < leaves.length; i++) {
    levels[0]!.set(i, leaves[i]!);
  }

  // Build tree bottom-up — only compute nodes that differ from the zero default
  for (let d = 0; d < depth; d++) {
    const curr = levels[d]!;
    const next = levels[d + 1]!;
    // Find parent indices that need computation
    const parentIndices = new Set<number>();
    for (const idx of curr.keys()) {
      parentIndices.add(Math.floor(idx / 2));
    }
    for (const pi of parentIndices) {
      const left = curr.get(pi * 2) ?? zeroH[d]!;
      const right = curr.get(pi * 2 + 1) ?? zeroH[d]!;
      const raw = poseidon.hash([left, right]);
      next.set(pi, F.toObject(raw));
    }
  }

  const root = (levels[depth]!.get(0) ?? zeroH[depth]!).toString();

  // Extract proofs for each real leaf
  const proofs = leaves.map((_, leafIdx) => {
    const siblings: string[] = [];
    const pathIndices: number[] = [];
    let idx = leafIdx;
    for (let d = 0; d < depth; d++) {
      const sibIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sib = levels[d]!.get(sibIdx) ?? zeroH[d]!;
      siblings.push(sib.toString());
      pathIndices.push(idx % 2);
      idx = Math.floor(idx / 2);
    }
    return { siblings, pathIndices };
  });

  return { root, proofs };
}

async function generateMockBuilderData(minDays: number): Promise<VerifiedBuilderData> {
  const now = Math.floor(Date.now() / 1000);
  const dayInSecs = 86400;
  const { maxDays, merkleDepth } = ZK_CIRCUIT_PARAMS['verified-builder'];
  const count = Math.min(Math.max(minDays + 5, 10), maxDays);

  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(now - i * dayInSecs);
  }

  // Poseidon-hash each timestamp (matching what input-preparation.ts will do)
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const hashedLeaves: bigint[] = timestamps.map((ts) => {
    const raw = poseidon.hash([BigInt(ts)]);
    return F.toObject(raw);
  });

  // Build real Merkle tree and extract proofs
  const { root, proofs } = await buildPoseidonMerkleTree(hashedLeaves, merkleDepth);

  return {
    activityTimestamps: timestamps,
    activityProofs: proofs,
    activityRoot: root,
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
    return await generateMockBuilderData(minDays);
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
