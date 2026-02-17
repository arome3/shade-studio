/**
 * Circuit Registry
 *
 * Static registry mapping each circuit ID to its metadata, artifact paths,
 * and circuit-specific parameters. Single source of truth for circuit configuration.
 */

import type { ZKCircuit, CircuitConfig } from '@/types/zk';
import { ZK_ARTIFACTS_BASE_PATH, ZK_CIRCUIT_PARAMS } from '@/lib/constants';
import { CircuitNotFoundError } from './errors';

/** Static registry of all circuit configurations */
const CIRCUIT_REGISTRY: Record<ZKCircuit, CircuitConfig> = {
  'verified-builder': {
    id: 'verified-builder',
    name: 'Verified Builder',
    description:
      'Proves activity history (minimum active days) without revealing specific actions or dates.',
    version: '2.0.0',
    params: {
      maxDays: ZK_CIRCUIT_PARAMS['verified-builder'].maxDays,
      merkleDepth: ZK_CIRCUIT_PARAMS['verified-builder'].merkleDepth,
    },
    estimatedConstraints: 146_000,
    wasmPath: `${ZK_ARTIFACTS_BASE_PATH}/verified-builder.wasm`,
    zkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/verified-builder.zkey`,
    vkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/verified-builder.vkey.json`,
    // SHA-256 hashes populated by `npm run circuits:hashes` after build.
    // When undefined, integrity checks are skipped (backward compatible).
    wasmHash: undefined,
    zkeyHash: undefined,
    vkeyHash: undefined,
  },
  'grant-track-record': {
    id: 'grant-track-record',
    name: 'Grant Track Record',
    description:
      'Proves grant completion history (minimum completed grants) without revealing amounts or details.',
    version: '1.0.0',
    params: {
      maxGrants: ZK_CIRCUIT_PARAMS['grant-track-record'].maxGrants,
      grantMerkleDepth: ZK_CIRCUIT_PARAMS['grant-track-record'].grantMerkleDepth,
      programMerkleDepth: ZK_CIRCUIT_PARAMS['grant-track-record'].programMerkleDepth,
    },
    estimatedConstraints: 8_000,
    wasmPath: `${ZK_ARTIFACTS_BASE_PATH}/grant-track-record.wasm`,
    zkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/grant-track-record.zkey`,
    vkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/grant-track-record.vkey.json`,
    wasmHash: undefined,
    zkeyHash: undefined,
    vkeyHash: undefined,
  },
  'team-attestation': {
    id: 'team-attestation',
    name: 'Team Attestation',
    description:
      'Proves team endorsements (minimum attestations with EdDSA signatures) without revealing attesters.',
    version: '1.0.0',
    params: {
      maxAttestations: ZK_CIRCUIT_PARAMS['team-attestation'].maxAttestations,
      merkleDepth: ZK_CIRCUIT_PARAMS['team-attestation'].merkleDepth,
    },
    estimatedConstraints: 15_000,
    wasmPath: `${ZK_ARTIFACTS_BASE_PATH}/team-attestation.wasm`,
    zkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/team-attestation.zkey`,
    vkeyPath: `${ZK_ARTIFACTS_BASE_PATH}/team-attestation.vkey.json`,
    wasmHash: undefined,
    zkeyHash: undefined,
    vkeyHash: undefined,
  },
};

/**
 * Get configuration for a specific circuit.
 * @throws CircuitNotFoundError if circuit ID is not registered.
 */
export function getCircuitConfig(circuitId: ZKCircuit): CircuitConfig {
  const config = CIRCUIT_REGISTRY[circuitId];
  if (!config) {
    throw new CircuitNotFoundError(circuitId);
  }
  return config;
}

/**
 * Get all registered circuit configurations.
 */
export function getAllCircuitConfigs(): CircuitConfig[] {
  return Object.values(CIRCUIT_REGISTRY);
}

/**
 * Check if a circuit ID is registered.
 */
export function isRegisteredCircuit(circuitId: string): circuitId is ZKCircuit {
  return circuitId in CIRCUIT_REGISTRY;
}
