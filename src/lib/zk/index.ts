/**
 * ZK Module — Barrel Export
 *
 * Zero-knowledge proof preparation and validation layer.
 * Proof generation (snarkjs.groth16.fullProve) is handled by Module 15.
 */

// Errors
export {
  ZKError,
  CircuitNotFoundError,
  ArtifactLoadError,
  InputValidationError,
  ProofGenerationError,
  ProofVerificationError,
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
