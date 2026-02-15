import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
  },
}));

import {
  CHAIN_CONFIGS,
  getChainConfig,
  getMPCContractId,
  getSupportedChains,
  getChainExplorerTxUrl,
} from '../chains';

describe('chains', () => {
  // ========================================================================
  // Chain Configs
  // ========================================================================

  describe('CHAIN_CONFIGS', () => {
    it('should have 5 supported chains', () => {
      expect(Object.keys(CHAIN_CONFIGS)).toHaveLength(5);
    });

    it('should include all expected chains', () => {
      expect(CHAIN_CONFIGS).toHaveProperty('ethereum');
      expect(CHAIN_CONFIGS).toHaveProperty('optimism');
      expect(CHAIN_CONFIGS).toHaveProperty('arbitrum');
      expect(CHAIN_CONFIGS).toHaveProperty('polygon');
      expect(CHAIN_CONFIGS).toHaveProperty('base');
    });

    it('should have correct chain IDs', () => {
      expect(CHAIN_CONFIGS.ethereum.chainId).toBe(1);
      expect(CHAIN_CONFIGS.optimism.chainId).toBe(10);
      expect(CHAIN_CONFIGS.arbitrum.chainId).toBe(42161);
      expect(CHAIN_CONFIGS.polygon.chainId).toBe(137);
      expect(CHAIN_CONFIGS.base.chainId).toBe(8453);
    });

    it('should use ethereum-1 MPC path for all chains', () => {
      for (const chain of Object.values(CHAIN_CONFIGS)) {
        expect(chain.mpcPath).toBe('ethereum-1');
      }
    });

    it('should have valid explorer URLs', () => {
      for (const chain of Object.values(CHAIN_CONFIGS)) {
        expect(chain.explorerUrl).toMatch(/^https:\/\//);
      }
    });
  });

  // ========================================================================
  // getChainConfig
  // ========================================================================

  describe('getChainConfig', () => {
    it('should return config for a valid chain', () => {
      const config = getChainConfig('ethereum');
      expect(config.id).toBe('ethereum');
      expect(config.name).toBe('Ethereum');
      expect(config.symbol).toBe('ETH');
    });

    it('should throw for unsupported chain', () => {
      expect(() => getChainConfig('solana' as any)).toThrow('Unsupported chain');
    });
  });

  // ========================================================================
  // getMPCContractId
  // ========================================================================

  describe('getMPCContractId', () => {
    it('should return testnet contract for testnet', () => {
      expect(getMPCContractId()).toBe('v1.signer-prod.testnet');
    });
  });

  // ========================================================================
  // getSupportedChains
  // ========================================================================

  describe('getSupportedChains', () => {
    it('should return array of all chains', () => {
      const chains = getSupportedChains();
      expect(chains).toHaveLength(5);
      expect(chains[0]).toHaveProperty('id');
      expect(chains[0]).toHaveProperty('name');
    });
  });

  // ========================================================================
  // getChainExplorerTxUrl
  // ========================================================================

  describe('getChainExplorerTxUrl', () => {
    it('should build correct Ethereum explorer URL', () => {
      const url = getChainExplorerTxUrl('ethereum', '0xabc123');
      expect(url).toBe('https://etherscan.io/tx/0xabc123');
    });

    it('should build correct Optimism explorer URL', () => {
      const url = getChainExplorerTxUrl('optimism', '0xdef456');
      expect(url).toBe('https://optimistic.etherscan.io/tx/0xdef456');
    });

    it('should build correct Base explorer URL', () => {
      const url = getChainExplorerTxUrl('base', '0x789');
      expect(url).toBe('https://basescan.org/tx/0x789');
    });
  });
});
