/**
 * EVM chain configuration for NEAR Chain Signatures.
 *
 * Each chain defines its RPC endpoint, explorer, native currency,
 * and the MPC derivation path used to compute deterministic addresses.
 * RPC URLs can be overridden via environment variables.
 */

import { config } from '@/lib/config';
import type { EVMChainId, ChainConfig } from '@/types/chain-signatures';

// ============================================================================
// Chain Configurations
// ============================================================================

export const CHAIN_CONFIGS: Record<EVMChainId, ChainConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL ?? 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    symbol: 'ETH',
    mpcPath: 'ethereum-1',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    chainId: 10,
    rpcUrl: process.env.NEXT_PUBLIC_OP_RPC_URL ?? 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    symbol: 'ETH',
    mpcPath: 'ethereum-1',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: process.env.NEXT_PUBLIC_ARB_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    symbol: 'ETH',
    mpcPath: 'ethereum-1',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    symbol: 'MATIC',
    mpcPath: 'ethereum-1',
  },
  base: {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    symbol: 'ETH',
    mpcPath: 'ethereum-1',
  },
};

// ============================================================================
// MPC Contract
// ============================================================================

/**
 * Get the MPC signer contract ID based on network.
 * Mainnet: v1.signer.near
 * Testnet: v1.signer-prod.testnet
 */
export function getMPCContractId(): string {
  return config.near.network === 'mainnet'
    ? 'v1.signer.near'
    : 'v1.signer-prod.testnet';
}

// ============================================================================
// Helpers
// ============================================================================

/** Get chain configuration by ID. Throws if not found. */
export function getChainConfig(chainId: EVMChainId): ChainConfig {
  const chain = CHAIN_CONFIGS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return chain;
}

/** Get all supported chains as an array. */
export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS);
}

/** Build a block explorer URL for a transaction hash. */
export function getChainExplorerTxUrl(chainId: EVMChainId, txHash: string): string {
  const chain = getChainConfig(chainId);
  return `${chain.explorerUrl}/tx/${txHash}`;
}
