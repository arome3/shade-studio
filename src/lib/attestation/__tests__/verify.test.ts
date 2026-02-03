import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyAttestation,
  verifyAttestationSync,
  getTEEInfo,
  formatAttestation,
  formatHash,
} from '../verify';
import { resetVerificationCache, getVerificationCache } from '../cache';
import type { TEEAttestation, VerificationStep } from '@/types/attestation';

// Mock fetch for remote verification tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('verifyAttestation', () => {
  beforeEach(() => {
    resetVerificationCache();
    mockFetch.mockReset();
  });

  const createValidAttestation = (overrides: Partial<TEEAttestation> = {}): TEEAttestation => ({
    tee_type: 'intel-tdx',
    enclave_id: 'enclave-123456789abcdef',
    code_hash: 'sha256:abc123def456789012345678901234567890abcdef',
    timestamp: new Date().toISOString(),
    quote: 'base64encodedquotedata==',
    signature: 'dGVzdCBzaWduYXR1cmU=', // Valid base64
    ...overrides,
  });

  describe('structure validation', () => {
    it('should pass with valid attestation', async () => {
      const attestation = createValidAttestation();
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('verified');
      expect(result.steps.find((s) => s.id === 'structure')?.status).toBe('passed');
    });

    it('should fail with null attestation', async () => {
      const result = await verifyAttestation(null);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errors.some((e) => e.code === 'INVALID_STRUCTURE')).toBe(true);
    });

    it('should fail with missing required fields', async () => {
      const attestation = createValidAttestation({ tee_type: '' });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errors.some((e) => e.code === 'MISSING_FIELD')).toBe(true);
    });
  });

  describe('timestamp validation', () => {
    it('should pass with recent timestamp', async () => {
      const attestation = createValidAttestation({
        timestamp: new Date().toISOString(),
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.steps.find((s) => s.id === 'timestamp')?.status).toBe('passed');
    });

    it('should fail with future timestamp', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future
      const attestation = createValidAttestation({
        timestamp: futureDate.toISOString(),
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errors.some((e) => e.code === 'FUTURE_TIMESTAMP')).toBe(true);
    });

    it('should fail with old attestation (expired)', async () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago (max is 5)
      const attestation = createValidAttestation({
        timestamp: oldDate.toISOString(),
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('expired');
      expect(result.errors.some((e) => e.code === 'EXPIRED_ATTESTATION')).toBe(true);
    });

    it('should warn when attestation is approaching expiry', async () => {
      const nearExpiryDate = new Date(Date.now() - 4 * 60 * 1000); // 4 minutes ago (75% of 5 min)
      const attestation = createValidAttestation({
        timestamp: nearExpiryDate.toISOString(),
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'ATTESTATION_APPROACHING_EXPIRY')).toBe(true);
    });

    it('should fail with invalid timestamp format', async () => {
      const attestation = createValidAttestation({
        timestamp: 'not-a-date',
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    });
  });

  describe('TEE type validation', () => {
    it('should recognize known TEE types', async () => {
      const attestation = createValidAttestation({ tee_type: 'intel-tdx' });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.teeInfo?.name).toBe('Intel TDX');
      expect(result.steps.find((s) => s.id === 'tee_type')?.status).toBe('passed');
    });

    it('should warn for unknown TEE type', async () => {
      const attestation = createValidAttestation({ tee_type: 'custom-tee' });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_TEE_TYPE')).toBe(true);
      expect(result.steps.find((s) => s.id === 'tee_type')?.status).toBe('warning');
    });

    it('should normalize TEE type to lowercase', async () => {
      const attestation = createValidAttestation({ tee_type: 'INTEL-TDX' });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.teeInfo?.type).toBe('intel-tdx');
    });
  });

  describe('code hash validation', () => {
    it('should warn for unknown code hash', async () => {
      const attestation = createValidAttestation({
        code_hash: 'sha256:unknown_hash_value_that_is_not_known_12345',
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_CODE_HASH')).toBe(true);
    });

    it('should fail with too short code hash', async () => {
      const attestation = createValidAttestation({
        code_hash: 'short',
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_CODE_HASH')).toBe(true);
    });
  });

  describe('signature validation', () => {
    it('should pass with valid base64 signature', async () => {
      const attestation = createValidAttestation({
        signature: 'dGVzdCBzaWduYXR1cmU=', // "test signature" in base64
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      // Signature step should be warning (awaiting remote verification)
      expect(result.steps.find((s) => s.id === 'signature')?.status).toBe('warning');
    });

    it('should warn when no signature present', async () => {
      const attestation = createValidAttestation();
      delete attestation.signature;
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'NO_SIGNATURE')).toBe(true);
      expect(result.steps.find((s) => s.id === 'signature')?.status).toBe('skipped');
    });

    it('should fail with invalid base64 signature', async () => {
      const attestation = createValidAttestation({
        signature: 'not!valid@base64#',
      });
      const result = await verifyAttestation(attestation);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_SIGNATURE')).toBe(true);
    });
  });

  describe('caching', () => {
    it('should return cached result on second call', async () => {
      const attestation = createValidAttestation();

      const result1 = await verifyAttestation(attestation);
      expect(result1.fromCache).toBe(false);

      const result2 = await verifyAttestation(attestation);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheKey).toBeDefined();
    });

    it('should bypass cache when option is set', async () => {
      const attestation = createValidAttestation();

      await verifyAttestation(attestation);
      const result = await verifyAttestation(attestation, { bypassCache: true });

      expect(result.fromCache).toBe(false);
    });

    it('should not cache failed results incorrectly', async () => {
      const cache = getVerificationCache();
      const initialSize = cache.size;

      const attestation = createValidAttestation();
      await verifyAttestation(attestation);

      expect(cache.size).toBe(initialSize + 1);
    });
  });

  describe('step updates callback', () => {
    it('should call onStepUpdate for each step', async () => {
      const stepUpdates: VerificationStep[] = [];
      const attestation = createValidAttestation();

      await verifyAttestation(attestation, {
        onStepUpdate: (step) => stepUpdates.push(step),
      });

      // Should have updates for all steps
      expect(stepUpdates.length).toBeGreaterThan(0);
      expect(stepUpdates.some((s) => s.id === 'structure')).toBe(true);
      expect(stepUpdates.some((s) => s.id === 'timestamp')).toBe(true);
    });
  });
});

describe('verifyAttestationSync', () => {
  beforeEach(() => {
    resetVerificationCache();
  });

  it('should return cached result if available', () => {
    const attestation: TEEAttestation = {
      tee_type: 'intel-sgx',
      enclave_id: 'enclave-sync-test',
      code_hash: 'sha256:sync_test_hash_12345678901234567890',
      timestamp: new Date().toISOString(),
    };

    const result1 = verifyAttestationSync(attestation);
    expect(result1.fromCache).toBe(false);

    const result2 = verifyAttestationSync(attestation);
    expect(result2.fromCache).toBe(true);
  });

  it('should skip signature and remote steps', () => {
    const attestation: TEEAttestation = {
      tee_type: 'amd-sev',
      enclave_id: 'enclave-sync-skip',
      code_hash: 'sha256:sync_skip_hash_12345678901234567890',
      timestamp: new Date().toISOString(),
    };

    const result = verifyAttestationSync(attestation);

    expect(result.steps.find((s) => s.id === 'signature')?.status).toBe('skipped');
    expect(result.steps.find((s) => s.id === 'remote')?.status).toBe('skipped');
  });
});

describe('getTEEInfo', () => {
  it('should return correct info for known types', () => {
    const tdxInfo = getTEEInfo('intel-tdx');
    expect(tdxInfo.name).toBe('Intel TDX');
    expect(tdxInfo.provider).toBe('Intel');
    expect(tdxInfo.securityLevel).toBe(5);

    const sgxInfo = getTEEInfo('intel-sgx');
    expect(sgxInfo.name).toBe('Intel SGX');
    expect(sgxInfo.securityLevel).toBe(4);

    const sevSnpInfo = getTEEInfo('amd-sev-snp');
    expect(sevSnpInfo.name).toBe('AMD SEV-SNP');
    expect(sevSnpInfo.securityLevel).toBe(5);
  });

  it('should return unknown info for unrecognized types', () => {
    const info = getTEEInfo('mystery-tee');
    expect(info.type).toBe('unknown');
    expect(info.securityLevel).toBe(1);
  });

  it('should be case-insensitive', () => {
    const info1 = getTEEInfo('INTEL-TDX');
    const info2 = getTEEInfo('intel-tdx');
    expect(info1.name).toBe(info2.name);
  });
});

describe('formatAttestation', () => {
  it('should format attestation for display', () => {
    const attestation: TEEAttestation = {
      tee_type: 'intel-tdx',
      enclave_id: 'enclave-format-test',
      code_hash: 'sha256:format_test_hash',
      timestamp: '2024-01-15T12:00:00.000Z',
      version: '1.0.0',
    };

    const formatted = formatAttestation(attestation);

    expect(formatted).toContain('Intel TDX');
    expect(formatted).toContain('enclave-format-test');
    expect(formatted).toContain('1.0.0');
  });
});

describe('formatHash', () => {
  it('should truncate long hashes', () => {
    const hash = 'sha256:abcdefghijklmnopqrstuvwxyz1234567890';
    const formatted = formatHash(hash, 8);

    expect(formatted).toContain('...');
    expect(formatted.length).toBeLessThan(hash.length);
  });

  it('should not truncate short hashes', () => {
    const hash = 'short';
    const formatted = formatHash(hash);

    expect(formatted).toBe(hash);
  });

  it('should handle undefined/empty values', () => {
    expect(formatHash(undefined)).toBe('N/A');
    expect(formatHash('')).toBe('N/A');
  });
});
