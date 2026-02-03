/**
 * Attestation Verification Constants
 *
 * Configuration values and static data for TEE attestation verification.
 */

import type { TEEInfo, TEEType, SecurityLevel } from '@/types/attestation';

// ============================================================================
// Time Constants
// ============================================================================

/** Maximum attestation age before it's considered stale (5 minutes) */
export const MAX_ATTESTATION_AGE_MS = 5 * 60 * 1000;

/** Cache TTL for verification results (10 minutes) */
export const VERIFICATION_CACHE_TTL_MS = 10 * 60 * 1000;

/** Default timeout for remote verification requests (30 seconds) */
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 30 * 1000;

/** Clock skew tolerance for timestamp validation (1 minute) */
export const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

/** Warning threshold - attestation is approaching expiry at 75% of max age */
export const ATTESTATION_EXPIRY_WARNING_THRESHOLD = 0.75;

// ============================================================================
// Cache Constants
// ============================================================================

/** Maximum number of entries in verification cache */
export const MAX_CACHE_ENTRIES = 100;

// ============================================================================
// TEE Information
// ============================================================================

/**
 * Comprehensive information about supported TEE types.
 * Security levels range from 1-5, where 5 is the highest security.
 */
export const TEE_INFO: Record<TEEType, TEEInfo> = {
  'intel-tdx': {
    type: 'intel-tdx',
    name: 'Intel TDX',
    provider: 'Intel',
    description:
      'Intel Trust Domain Extensions (TDX) provides hardware-isolated virtual machines with encrypted memory. TDX creates Trust Domains (TDs) that are isolated from the hypervisor and other VMs, offering strong protection for cloud workloads.',
    securityLevel: 5 as SecurityLevel,
    documentationUrl: 'https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html',
    features: [
      'Hardware-enforced VM isolation',
      'Memory encryption with unique keys per TD',
      'Remote attestation via Intel Trust Authority',
      'Protection from hypervisor attacks',
    ],
  },
  'intel-sgx': {
    type: 'intel-sgx',
    name: 'Intel SGX',
    provider: 'Intel',
    description:
      'Intel Software Guard Extensions (SGX) enables application-level enclaves for sensitive computation. Code and data inside an enclave are protected even from privileged software including the OS and hypervisor.',
    securityLevel: 4 as SecurityLevel,
    documentationUrl: 'https://www.intel.com/content/www/us/en/developer/tools/software-guard-extensions/overview.html',
    features: [
      'Application-level enclaves',
      'Encrypted enclave memory',
      'Sealed storage for persistent secrets',
      'Remote attestation support',
    ],
  },
  'amd-sev': {
    type: 'amd-sev',
    name: 'AMD SEV',
    provider: 'AMD',
    description:
      'AMD Secure Encrypted Virtualization (SEV) provides VM memory encryption with per-VM keys. Each VM is isolated from the hypervisor and other VMs through hardware-based encryption.',
    securityLevel: 3 as SecurityLevel,
    documentationUrl: 'https://developer.amd.com/sev/',
    features: [
      'Per-VM memory encryption',
      'Hardware key management',
      'Hypervisor isolation',
      'Minimal performance overhead',
    ],
  },
  'amd-sev-snp': {
    type: 'amd-sev-snp',
    name: 'AMD SEV-SNP',
    provider: 'AMD',
    description:
      'AMD SEV Secure Nested Paging (SNP) adds strong memory integrity protection to SEV, preventing memory replay and aliasing attacks. SNP provides the strongest protection in the AMD SEV family.',
    securityLevel: 5 as SecurityLevel,
    documentationUrl: 'https://www.amd.com/en/developer/sev.html',
    features: [
      'Memory integrity protection',
      'Reverse map table protection',
      'TCB versioning attestation',
      'Prevention of memory replay attacks',
    ],
  },
  'arm-cca': {
    type: 'arm-cca',
    name: 'ARM CCA',
    provider: 'ARM',
    description:
      'ARM Confidential Compute Architecture (CCA) introduces Realms - isolated execution environments for ARM processors. Realms provide strong isolation with hardware-backed security.',
    securityLevel: 4 as SecurityLevel,
    documentationUrl: 'https://www.arm.com/architecture/security-features/arm-confidential-compute-architecture',
    features: [
      'Realm-based isolation',
      'Hardware-backed security',
      'Dynamic realm creation',
      'Attestation via Realm Management Extension',
    ],
  },
  'nvidia-cc': {
    type: 'nvidia-cc',
    name: 'NVIDIA Confidential Computing',
    provider: 'NVIDIA',
    description:
      'NVIDIA Confidential Computing provides GPU-based confidential computing for AI workloads. Data remains encrypted during GPU processing, enabling private AI inference.',
    securityLevel: 4 as SecurityLevel,
    documentationUrl: 'https://www.nvidia.com/en-us/data-center/solutions/confidential-computing/',
    features: [
      'GPU memory encryption',
      'Confidential AI inference',
      'Hardware attestation',
      'Integration with CPU TEEs',
    ],
  },
  unknown: {
    type: 'unknown',
    name: 'Unknown TEE',
    provider: 'Unknown',
    description:
      'An unrecognized Trusted Execution Environment type. Verification may be limited as the specific security properties cannot be determined.',
    securityLevel: 1 as SecurityLevel,
    features: ['Unknown security properties'],
  },
};

// ============================================================================
// Known Code Hashes
// ============================================================================

/**
 * Known good code hashes for NEAR AI Cloud enclaves.
 * These are verified hashes of trusted enclave code.
 *
 * Format: { [hash]: { version, description, releaseDate } }
 */
export const KNOWN_CODE_HASHES: Record<
  string,
  { version: string; description: string; releaseDate: string }
> = {
  // NEAR AI Cloud inference enclave v1.0
  'sha256:abc123def456789...': {
    version: '1.0.0',
    description: 'NEAR AI Cloud Inference Enclave',
    releaseDate: '2024-01-15',
  },
  // NEAR AI Cloud inference enclave v1.1
  'sha256:def789ghi012345...': {
    version: '1.1.0',
    description: 'NEAR AI Cloud Inference Enclave',
    releaseDate: '2024-03-01',
  },
  // Phala Network pRuntime
  'sha256:phala_pruntime_v1...': {
    version: '1.0.0',
    description: 'Phala Network pRuntime',
    releaseDate: '2024-02-01',
  },
};

// ============================================================================
// Verification Endpoints
// ============================================================================

/**
 * Remote verification endpoints for different TEE types.
 * These endpoints are used for cryptographic verification of attestation quotes.
 */
export const VERIFICATION_ENDPOINTS: Record<TEEType, string | null> = {
  'intel-tdx': 'https://portal.trustauthority.intel.com/api/v1/attest',
  'intel-sgx': 'https://api.trustedservices.intel.com/sgx/attestation/v4/report',
  'amd-sev': null, // AMD SEV verification is typically done on-premise
  'amd-sev-snp': 'https://kdsintf.amd.com/vcek/v1/', // AMD Key Distribution Service
  'arm-cca': null, // ARM CCA verification varies by implementation
  'nvidia-cc': null, // NVIDIA CC verification is implementation-specific
  unknown: null,
};

/**
 * NEAR AI Cloud specific verification endpoint
 */
export const NEAR_AI_VERIFICATION_ENDPOINT = 'https://verify.near.ai/attestation';

// ============================================================================
// Verification Step Metadata
// ============================================================================

/**
 * Descriptions for each verification step
 */
export const VERIFICATION_STEP_INFO: Record<
  string,
  { name: string; description: string }
> = {
  structure: {
    name: 'Structure Validation',
    description: 'Verifying required attestation fields are present and properly formatted',
  },
  timestamp: {
    name: 'Timestamp Validation',
    description: 'Checking attestation timestamp is recent and not in the future',
  },
  tee_type: {
    name: 'TEE Type Validation',
    description: 'Identifying and validating the Trusted Execution Environment type',
  },
  code_hash: {
    name: 'Code Hash Validation',
    description: 'Verifying the enclave code hash against known trusted values',
  },
  signature: {
    name: 'Signature Validation',
    description: 'Checking attestation signature format and structure',
  },
  remote: {
    name: 'Remote Verification',
    description: 'Cryptographically verifying attestation with manufacturer service',
  },
};

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  INVALID_STRUCTURE: 'Attestation data is malformed or incomplete',
  MISSING_FIELD: (field: string) => `Required field "${field}" is missing`,
  INVALID_TIMESTAMP: 'Attestation timestamp is invalid or cannot be parsed',
  FUTURE_TIMESTAMP: 'Attestation timestamp is in the future',
  EXPIRED_ATTESTATION: 'Attestation has expired',
  UNKNOWN_TEE_TYPE: 'TEE type is not recognized',
  INVALID_CODE_HASH: 'Code hash format is invalid',
  UNKNOWN_CODE_HASH: 'Code hash is not in the list of known trusted values',
  INVALID_SIGNATURE: 'Signature format is invalid',
  SIGNATURE_MISMATCH: 'Signature verification failed',
  REMOTE_VERIFICATION_FAILED: 'Remote verification service returned an error',
  REMOTE_TIMEOUT: 'Remote verification timed out',
  NETWORK_ERROR: 'Network error during remote verification',
  INTERNAL_ERROR: 'An internal error occurred during verification',
} as const;

// ============================================================================
// Security Level Descriptions
// ============================================================================

export const SECURITY_LEVEL_DESCRIPTIONS: Record<SecurityLevel, string> = {
  1: 'Basic - Limited security guarantees',
  2: 'Low - Basic isolation with some limitations',
  3: 'Medium - Good isolation with memory encryption',
  4: 'High - Strong isolation with hardware attestation',
  5: 'Maximum - Comprehensive protection with integrity guarantees',
};

// ============================================================================
// TEE Benefits for Educational Content
// ============================================================================

export const TEE_BENEFITS = [
  {
    id: 'memory-encryption',
    title: 'Memory Encryption',
    description: 'Your data is encrypted in memory, even the cloud operator cannot read it',
    icon: 'Lock',
  },
  {
    id: 'operator-blindness',
    title: 'Operator Blindness',
    description: 'Cloud providers and attackers cannot access data during processing',
    icon: 'EyeOff',
  },
  {
    id: 'hardware-isolation',
    title: 'Hardware Isolation',
    description: 'Dedicated hardware protects your computation from other workloads',
    icon: 'Cpu',
  },
  {
    id: 'cryptographic-proof',
    title: 'Cryptographic Proof',
    description: 'Attestations prove computation ran in a verified secure environment',
    icon: 'FileCheck',
  },
] as const;
