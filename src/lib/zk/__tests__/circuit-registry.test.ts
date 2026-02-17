import { describe, it, expect } from 'vitest';
import {
  getCircuitConfig,
  getAllCircuitConfigs,
  isRegisteredCircuit,
} from '../circuit-registry';
import { CircuitNotFoundError } from '../errors';
import type { ZKCircuit } from '@/types/zk';

describe('Circuit Registry', () => {
  const CIRCUIT_IDS: ZKCircuit[] = [
    'verified-builder',
    'grant-track-record',
    'team-attestation',
  ];

  describe('getCircuitConfig', () => {
    it.each(CIRCUIT_IDS)('returns config for %s', (circuitId) => {
      const config = getCircuitConfig(circuitId);
      expect(config.id).toBe(circuitId);
      expect(config.name).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(config.wasmPath).toContain(circuitId);
      expect(config.zkeyPath).toContain(circuitId);
      expect(config.vkeyPath).toContain(circuitId);
      expect(config.estimatedConstraints).toBeGreaterThan(0);
      expect(Object.keys(config.params).length).toBeGreaterThan(0);
    });

    it('throws CircuitNotFoundError for unknown circuit', () => {
      expect(() =>
        getCircuitConfig('nonexistent' as ZKCircuit)
      ).toThrow(CircuitNotFoundError);
    });
  });

  describe('getAllCircuitConfigs', () => {
    it('returns all 3 circuits', () => {
      const configs = getAllCircuitConfigs();
      expect(configs).toHaveLength(3);

      const ids = configs.map((c) => c.id);
      expect(ids).toContain('verified-builder');
      expect(ids).toContain('grant-track-record');
      expect(ids).toContain('team-attestation');
    });
  });

  describe('isRegisteredCircuit', () => {
    it.each(CIRCUIT_IDS)('returns true for %s', (id) => {
      expect(isRegisteredCircuit(id)).toBe(true);
    });

    it('returns false for unknown circuit', () => {
      expect(isRegisteredCircuit('unknown')).toBe(false);
    });

    it('returns false for old circuit names', () => {
      expect(isRegisteredCircuit('grant-eligibility')).toBe(false);
      expect(isRegisteredCircuit('milestone-completion')).toBe(false);
      expect(isRegisteredCircuit('fund-usage')).toBe(false);
    });
  });

  describe('circuit params', () => {
    it('verified-builder has maxDays and merkleDepth', () => {
      const config = getCircuitConfig('verified-builder');
      expect(config.params.maxDays).toBe(30);
      expect(config.params.merkleDepth).toBe(20);
    });

    it('grant-track-record has maxGrants and both depths', () => {
      const config = getCircuitConfig('grant-track-record');
      expect(config.params.maxGrants).toBe(10);
      expect(config.params.grantMerkleDepth).toBe(15);
      expect(config.params.programMerkleDepth).toBe(10);
    });

    it('team-attestation has maxAttestations and merkleDepth', () => {
      const config = getCircuitConfig('team-attestation');
      expect(config.params.maxAttestations).toBe(5);
      expect(config.params.merkleDepth).toBe(20);
    });
  });
});
