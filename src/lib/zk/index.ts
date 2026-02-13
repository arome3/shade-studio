/**
 * ZK Module — Barrel Export
 *
 * Zero-knowledge proof infrastructure: circuit registry, artifact loading,
 * input preparation & validation, Merkle tree utilities, proof generation,
 * concurrency control, persistent caching, worker bridge, on-chain
 * verification, and composite credential support.
 */

// Errors
export {
  ZKError,
  CircuitNotFoundError,
  ArtifactLoadError,
  InputValidationError,
  ProofGenerationError,
  ProofVerificationError,
  OnChainVerificationError,
  ProofConcurrencyError,
} from './errors';

// Circuit registry
export {
  getCircuitConfig,
  getAllCircuitConfigs,
  isRegisteredCircuit,
} from './circuit-registry';

// Artifact loading
export {
  loadCircuitArtifacts,
  clearArtifactCache,
  clearPersistentArtifactCache,
  isArtifactCached,
} from './artifacts';
export type { LoadedArtifacts, ArtifactLoadProgress } from './artifacts';

// Poseidon hashing
export { getPoseidon, poseidonHash, poseidonHashString, resetPoseidon } from './poseidon';

// Input preparation
export {
  prepareVerifiedBuilderInputs,
  prepareGrantTrackRecordInputs,
  prepareTeamAttestationInputs,
  verifiedBuilderToCircuitSignals,
  grantTrackRecordToCircuitSignals,
  teamAttestationToCircuitSignals,
} from './input-preparation';
export type {
  VerifiedBuilderData,
  GrantTrackRecordData,
  TeamAttestationData,
  VerifiedBuilderCircuitSignals,
  GrantTrackRecordCircuitSignals,
  TeamAttestationCircuitSignals,
} from './input-preparation';

// Validation
export { validateCircuitInputs, getCircuitSchema } from './validation';

// Merkle tree utilities
export {
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  valuesToLeaves,
} from './merkle-utils';
export type { MerkleTree, MerkleProof } from './merkle-utils';

// Proof generation
export {
  generateProof,
  verifyProofLocally,
  exportProofCalldata,
  exportProofToJson,
  importProofFromJson,
  isProofExpired,
  estimateProofTime,
} from './proof-generator';
export type { ProofGenerationOptions } from './proof-generator';

// Concurrency
export { AsyncSemaphore, getProofSemaphore } from './concurrency';

// Persistent artifact cache
export { ArtifactCache, getArtifactCache } from './artifact-cache';
export type { ArtifactCacheStats, ArtifactType } from './artifact-cache';

// Worker bridge
export { workerFullProve, workerVerify } from './worker-bridge';
export type { WorkerFullProveOptions } from './worker-bridge';

// On-chain verification
export { verifyProofOnChain } from './on-chain-verifier';
export type { OnChainVerifyOptions } from './on-chain-verifier';

// Proof composition
export {
  generateCompositeCredential,
  verifyProofBundle,
} from './proof-composition';
export type {
  CircuitRequest,
  CompositeCredentialRequest,
  ProofBundleVerificationResult,
} from './proof-composition';
