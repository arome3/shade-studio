import { describe, it, expect } from 'vitest';
import {
  verifyAttestation,
  formatAttestation,
  getTeeDescription,
  formatHash,
  getVerificationBadge,
  createVerificationReport,
  isPrivateComputation,
  getExternalVerificationUrl,
} from '../attestation';
import type { NEARAIAttestation } from '@/types/ai';

describe('ai/attestation', () => {
  const validAttestation: NEARAIAttestation = {
    version: '1.0',
    tee_type: 'intel-tdx',
    enclave_id: 'abc123def456abc123def456abc123def456abc123def456',
    code_hash: 'hash123hash456hash789hash123hash456hash789',
    timestamp: new Date().toISOString(),
    quote: 'base64encodedquote',
    signature: 'signature123',
  };

  describe('verifyAttestation', () => {
    it('should verify valid attestation', () => {
      const result = verifyAttestation(validAttestation);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('verified');
    });

    it('should return unverified for null attestation', () => {
      const result = verifyAttestation(null);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('unverified');
    });

    it('should return unverified for undefined attestation', () => {
      const result = verifyAttestation(undefined);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('unverified');
    });

    it('should return invalid for missing required fields', () => {
      const incomplete = {
        ...validAttestation,
        enclave_id: '',
      };
      const result = verifyAttestation(incomplete);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toContain('Missing required fields');
    });

    it('should return expired for old attestation', () => {
      const oldAttestation = {
        ...validAttestation,
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
      };
      const result = verifyAttestation(oldAttestation);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('expired');
    });

    it('should return invalid for future timestamp', () => {
      const futureAttestation = {
        ...validAttestation,
        timestamp: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours in future
      };
      const result = verifyAttestation(futureAttestation);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
    });

    it('should add warning for unknown TEE type', () => {
      const unknownTee = {
        ...validAttestation,
        tee_type: 'unknown-tee',
      };
      const result = verifyAttestation(unknownTee);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Unknown TEE type: unknown-tee');
    });

    it('should add warning when no quote present', () => {
      const noQuote = {
        ...validAttestation,
        quote: '',
      };
      const result = verifyAttestation(noQuote);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No quote data for cryptographic verification');
    });
  });

  describe('formatAttestation', () => {
    it('should format attestation as string', () => {
      const formatted = formatAttestation(validAttestation);
      expect(formatted).toContain('Intel TDX');
      expect(formatted).toContain('Enclave ID:');
      expect(formatted).toContain('Code Hash:');
      expect(formatted).toContain('Timestamp:');
    });

    it('should include version if present', () => {
      const formatted = formatAttestation(validAttestation);
      expect(formatted).toContain('Version: 1.0');
    });

    it('should include signature if present', () => {
      const formatted = formatAttestation(validAttestation);
      expect(formatted).toContain('Signature:');
    });
  });

  describe('getTeeDescription', () => {
    it('should return info for known TEE types', () => {
      const intelTdx = getTeeDescription('intel-tdx');
      expect(intelTdx.name).toBe('Intel TDX');
      expect(intelTdx.provider).toBe('Intel');

      const amdSev = getTeeDescription('amd-sev');
      expect(amdSev.name).toBe('AMD SEV');
      expect(amdSev.provider).toBe('AMD');
    });

    it('should return fallback for unknown TEE type', () => {
      const unknown = getTeeDescription('some-unknown-tee');
      expect(unknown.name).toBe('some-unknown-tee');
      expect(unknown.provider).toBe('Unknown');
    });

    it('should be case insensitive', () => {
      const upper = getTeeDescription('INTEL-TDX');
      expect(upper.name).toBe('Intel TDX');
    });
  });

  describe('formatHash', () => {
    it('should truncate long hashes', () => {
      const hash = 'abcdefghijklmnopqrstuvwxyz123456789';
      const formatted = formatHash(hash);
      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(hash.length);
    });

    it('should not truncate short hashes', () => {
      const hash = 'abc';
      const formatted = formatHash(hash);
      expect(formatted).toBe(hash);
    });

    it('should return N/A for empty hash', () => {
      expect(formatHash('')).toBe('N/A');
    });

    it('should respect custom length', () => {
      const hash = 'abcdefghijklmnopqrstuvwxyz';
      const formatted = formatHash(hash, 4);
      expect(formatted).toBe('abcd...wxyz');
    });
  });

  describe('getVerificationBadge', () => {
    it('should return green for verified', () => {
      const badge = getVerificationBadge({
        isValid: true,
        status: 'verified',
        message: 'OK',
      });
      expect(badge.color).toBe('green');
      expect(badge.icon).toBe('check');
    });

    it('should return yellow for verified with warnings', () => {
      const badge = getVerificationBadge({
        isValid: true,
        status: 'verified',
        message: 'OK',
        warnings: ['Some warning'],
      });
      expect(badge.color).toBe('yellow');
      expect(badge.icon).toBe('alert');
    });

    it('should return yellow for expired', () => {
      const badge = getVerificationBadge({
        isValid: false,
        status: 'expired',
        message: 'Expired',
      });
      expect(badge.color).toBe('yellow');
    });

    it('should return red for invalid', () => {
      const badge = getVerificationBadge({
        isValid: false,
        status: 'invalid',
        message: 'Invalid',
      });
      expect(badge.color).toBe('red');
      expect(badge.icon).toBe('x');
    });

    it('should return gray for unverified', () => {
      const badge = getVerificationBadge({
        isValid: false,
        status: 'unverified',
        message: 'No data',
      });
      expect(badge.color).toBe('gray');
      expect(badge.icon).toBe('question');
    });
  });

  describe('createVerificationReport', () => {
    it('should create report for valid attestation', () => {
      const report = createVerificationReport(validAttestation);
      expect(report).toContain('# TEE Attestation Verification Report');
      expect(report).toContain('VERIFIED');
      expect(report).toContain('Intel TDX');
    });

    it('should create report for null attestation', () => {
      const report = createVerificationReport(null);
      expect(report).toContain('No attestation data available');
    });

    it('should include warnings in report', () => {
      const attestationWithUnknownTee = {
        ...validAttestation,
        tee_type: 'unknown',
      };
      const report = createVerificationReport(attestationWithUnknownTee);
      expect(report).toContain('Warnings');
    });
  });

  describe('isPrivateComputation', () => {
    it('should return true for valid attestation', () => {
      expect(isPrivateComputation(validAttestation)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPrivateComputation(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPrivateComputation(undefined)).toBe(false);
    });

    it('should return false for expired attestation', () => {
      const expired = {
        ...validAttestation,
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      };
      expect(isPrivateComputation(expired)).toBe(false);
    });
  });

  describe('getExternalVerificationUrl', () => {
    it('should return NEAR AI verification URL when quote present', () => {
      const url = getExternalVerificationUrl(validAttestation);
      expect(url).toContain('verify.near.ai');
    });

    it('should return Intel Trust Authority for Intel TEE', () => {
      const noQuote = {
        ...validAttestation,
        quote: '',
      };
      const url = getExternalVerificationUrl(noQuote);
      expect(url).toContain('trustauthority.intel.com');
    });
  });
});
