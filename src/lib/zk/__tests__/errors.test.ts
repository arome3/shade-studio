import { describe, it, expect } from 'vitest';
import {
  ZKError,
  CircuitNotFoundError,
  ArtifactLoadError,
  InputValidationError,
  ProofGenerationError,
  ProofVerificationError,
} from '../errors';

describe('ZK Errors', () => {
  describe('ZKError (base)', () => {
    it('stores code and details', () => {
      const err = new ZKError('test', 'TEST_CODE', { foo: 'bar' });
      expect(err.message).toBe('test');
      expect(err.code).toBe('TEST_CODE');
      expect(err.details).toEqual({ foo: 'bar' });
      expect(err.name).toBe('ZKError');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('CircuitNotFoundError', () => {
    it('includes circuit ID in message and details', () => {
      const err = new CircuitNotFoundError('unknown-circuit');
      expect(err.message).toContain('unknown-circuit');
      expect(err.code).toBe('CIRCUIT_NOT_FOUND');
      expect(err.details?.circuitId).toBe('unknown-circuit');
      expect(err).toBeInstanceOf(ZKError);
    });
  });

  describe('ArtifactLoadError', () => {
    it('includes circuit ID, artifact type, and cause', () => {
      const err = new ArtifactLoadError('verified-builder', 'wasm', 'HTTP 404');
      expect(err.message).toContain('verified-builder');
      expect(err.message).toContain('wasm');
      expect(err.message).toContain('HTTP 404');
      expect(err.code).toBe('ARTIFACT_LOAD_ERROR');
      expect(err).toBeInstanceOf(ZKError);
    });

    it('works without cause', () => {
      const err = new ArtifactLoadError('verified-builder', 'zkey');
      expect(err.message).toContain('verified-builder');
      expect(err.details?.cause).toBeUndefined();
    });
  });

  describe('InputValidationError', () => {
    it('stores structured validation errors', () => {
      const errors = [
        { path: 'minDays', message: 'Must be at least 1' },
        { path: 'activityDates', message: 'Must have exactly 365 entries' },
      ];
      const err = new InputValidationError('verified-builder', errors);
      expect(err.validationErrors).toHaveLength(2);
      expect(err.message).toContain('Must be at least 1');
      expect(err.code).toBe('INPUT_VALIDATION_ERROR');
      expect(err).toBeInstanceOf(ZKError);
    });
  });

  describe('ProofGenerationError', () => {
    it('includes circuit ID and cause', () => {
      const err = new ProofGenerationError('grant-track-record', 'witness failed');
      expect(err.message).toContain('grant-track-record');
      expect(err.message).toContain('witness failed');
      expect(err.code).toBe('PROOF_GENERATION_ERROR');
      expect(err).toBeInstanceOf(ZKError);
    });
  });

  describe('ProofVerificationError', () => {
    it('includes circuit ID', () => {
      const err = new ProofVerificationError('team-attestation');
      expect(err.message).toContain('team-attestation');
      expect(err.code).toBe('PROOF_VERIFICATION_ERROR');
      expect(err).toBeInstanceOf(ZKError);
    });
  });

  describe('instanceof chain', () => {
    it('all errors are instanceof ZKError and Error', () => {
      const errors = [
        new CircuitNotFoundError('x'),
        new ArtifactLoadError('x', 'wasm'),
        new InputValidationError('x', []),
        new ProofGenerationError('x'),
        new ProofVerificationError('x'),
      ];

      for (const err of errors) {
        expect(err).toBeInstanceOf(ZKError);
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});
