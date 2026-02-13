/**
 * ZK Error Types
 *
 * Typed error hierarchy for zero-knowledge proof operations.
 * All ZK errors extend ZKError for unified catch handling.
 */

/** Base error for all ZK operations */
export class ZKError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ZKError';
    this.code = code;
    this.details = details;
  }
}

/** Circuit definition or configuration not found */
export class CircuitNotFoundError extends ZKError {
  constructor(circuitId: string) {
    super(
      `Circuit not found: ${circuitId}`,
      'CIRCUIT_NOT_FOUND',
      { circuitId }
    );
    this.name = 'CircuitNotFoundError';
  }
}

/** Failed to load circuit artifacts (WASM, zkey, vkey) */
export class ArtifactLoadError extends ZKError {
  constructor(circuitId: string, artifactType: string, cause?: string) {
    super(
      `Failed to load ${artifactType} for circuit ${circuitId}${cause ? `: ${cause}` : ''}`,
      'ARTIFACT_LOAD_ERROR',
      { circuitId, artifactType, cause }
    );
    this.name = 'ArtifactLoadError';
  }
}

/** Circuit input validation failed */
export class InputValidationError extends ZKError {
  readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    circuitId: string,
    validationErrors: Array<{ path: string; message: string }>
  ) {
    super(
      `Invalid inputs for circuit ${circuitId}: ${validationErrors.map((e) => e.message).join('; ')}`,
      'INPUT_VALIDATION_ERROR',
      { circuitId, validationErrors }
    );
    this.name = 'InputValidationError';
    this.validationErrors = validationErrors;
  }
}

/** Proof generation failed */
export class ProofGenerationError extends ZKError {
  constructor(circuitId: string, cause?: string) {
    super(
      `Proof generation failed for circuit ${circuitId}${cause ? `: ${cause}` : ''}`,
      'PROOF_GENERATION_ERROR',
      { circuitId, cause }
    );
    this.name = 'ProofGenerationError';
  }
}

/** Proof verification failed */
export class ProofVerificationError extends ZKError {
  constructor(circuitId: string, cause?: string) {
    super(
      `Proof verification failed for circuit ${circuitId}${cause ? `: ${cause}` : ''}`,
      'PROOF_VERIFICATION_ERROR',
      { circuitId, cause }
    );
    this.name = 'ProofVerificationError';
  }
}

/** On-chain proof verification failed */
export class OnChainVerificationError extends ZKError {
  constructor(cause?: string) {
    super(
      `On-chain proof verification failed${cause ? `: ${cause}` : ''}`,
      'ON_CHAIN_VERIFICATION_ERROR',
      { cause }
    );
    this.name = 'OnChainVerificationError';
  }
}

/** Proof concurrency limit exceeded (non-blocking acquire failed) */
export class ProofConcurrencyError extends ZKError {
  constructor() {
    super(
      'Another proof operation is already in progress',
      'PROOF_CONCURRENCY_ERROR'
    );
    this.name = 'ProofConcurrencyError';
  }
}

/** Contract call failed (RPC/network error) */
export class ContractCallError extends ZKError {
  constructor(method: string, cause?: string) {
    super(
      `Contract call failed: ${method}${cause ? ` — ${cause}` : ''}`,
      'CONTRACT_CALL_ERROR',
      { method, cause }
    );
    this.name = 'ContractCallError';
  }
}

/** Credential not found on-chain */
export class CredentialNotFoundError extends ZKError {
  constructor(credentialId: string) {
    super(
      `Credential not found on-chain: ${credentialId}`,
      'CREDENTIAL_NOT_FOUND',
      { credentialId }
    );
    this.name = 'CredentialNotFoundError';
  }
}

/** Insufficient NEAR deposit for credential storage */
export class InsufficientDepositError extends ZKError {
  constructor(required: string, attached: string) {
    super(
      `Insufficient deposit: required ${required} yoctoNEAR, attached ${attached}`,
      'INSUFFICIENT_DEPOSIT',
      { required, attached }
    );
    this.name = 'InsufficientDepositError';
  }
}

/** Contract is paused */
export class ContractPausedError extends ZKError {
  constructor() {
    super(
      'ZK verifier contract is currently paused',
      'CONTRACT_PAUSED'
    );
    this.name = 'ContractPausedError';
  }
}
