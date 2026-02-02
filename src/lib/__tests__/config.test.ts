import { describe, it, expect } from 'vitest';
import { config } from '../config';

describe('config', () => {
  describe('near configuration', () => {
    it('should have a valid network value', () => {
      expect(['mainnet', 'testnet']).toContain(config.near.network);
    });

    it('should have a contract ID', () => {
      expect(config.near.contractId).toBeDefined();
      expect(typeof config.near.contractId).toBe('string');
    });

    it('should have correct RPC URL for the network', () => {
      if (config.near.network === 'mainnet') {
        expect(config.near.rpcUrl).toContain('mainnet');
      } else {
        expect(config.near.rpcUrl).toContain('testnet');
      }
    });

    it('should have a valid wallet URL', () => {
      expect(config.near.walletUrl).toMatch(/^https:\/\/wallet\./);
    });

    it('should have a valid explorer URL', () => {
      expect(config.near.explorerUrl).toMatch(/nearblocks\.io/);
    });
  });

  describe('ai configuration', () => {
    it('should have an AI endpoint', () => {
      expect(config.ai.endpoint).toBeDefined();
      expect(config.ai.endpoint).toMatch(/^https?:\/\//);
    });
  });

  describe('encryption configuration', () => {
    it('should have a positive encryption version', () => {
      expect(config.encryption.version).toBeGreaterThan(0);
    });
  });

  describe('feature flags', () => {
    it('should have boolean feature flags', () => {
      expect(typeof config.features.zkProofs).toBe('boolean');
      expect(typeof config.features.aiFeatures).toBe('boolean');
      expect(typeof config.features.dailyBriefings).toBe('boolean');
    });
  });

  describe('debug flag', () => {
    it('should have a boolean debug flag', () => {
      expect(typeof config.debug).toBe('boolean');
    });
  });
});
