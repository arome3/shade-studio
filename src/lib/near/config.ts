import { config } from '@/lib/config';

/**
 * NEAR network configuration types and utilities.
 * Extends the base app config with wallet-specific helpers.
 */

export interface NetworkConfig {
  networkId: 'mainnet' | 'testnet';
  nodeUrl: string;
  walletUrl: string;
  helperUrl: string;
  explorerUrl: string;
}

/**
 * Mainnet configuration for production deployments.
 */
export const MAINNET_CONFIG: NetworkConfig = {
  networkId: 'mainnet',
  nodeUrl: 'https://rpc.mainnet.near.org',
  walletUrl: 'https://wallet.mainnet.near.org',
  helperUrl: 'https://helper.mainnet.near.org',
  explorerUrl: 'https://nearblocks.io',
};

/**
 * Testnet configuration for development and testing.
 */
export const TESTNET_CONFIG: NetworkConfig = {
  networkId: 'testnet',
  nodeUrl: 'https://rpc.testnet.near.org',
  walletUrl: 'https://wallet.testnet.near.org',
  helperUrl: 'https://helper.testnet.near.org',
  explorerUrl: 'https://testnet.nearblocks.io',
};

/**
 * Get the current network configuration based on environment.
 * Uses the NEXT_PUBLIC_NEAR_NETWORK env variable.
 */
export function getNetworkConfig(): NetworkConfig {
  return config.near.network === 'mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG;
}

/**
 * Get the explorer URL for viewing an account.
 * @param accountId - The NEAR account ID
 * @returns Full URL to view the account on the explorer
 */
export function getExplorerAccountUrl(accountId: string): string {
  const networkConfig = getNetworkConfig();
  return `${networkConfig.explorerUrl}/address/${accountId}`;
}

/**
 * Get the explorer URL for viewing a transaction.
 * @param txHash - The transaction hash
 * @returns Full URL to view the transaction on the explorer
 */
export function getExplorerTxUrl(txHash: string): string {
  const networkConfig = getNetworkConfig();
  return `${networkConfig.explorerUrl}/txns/${txHash}`;
}

/**
 * NEAR account ID validation regex.
 * Valid account IDs:
 * - 2-64 characters
 * - Lowercase alphanumeric, underscores, hyphens
 * - Can contain dots for subaccounts (e.g., sub.account.near)
 * - Cannot start or end with dots, underscores, or hyphens
 * - Implicit accounts are 64 hex characters (public key)
 */
const ACCOUNT_ID_REGEX = /^(?:[a-z\d]+[-_])*[a-z\d]+(?:\.[a-z\d]+[-_]*[a-z\d]+)*$/;
const IMPLICIT_ACCOUNT_REGEX = /^[a-f0-9]{64}$/;

/**
 * Validate a NEAR account ID format.
 * @param accountId - The account ID to validate
 * @returns true if the account ID format is valid
 */
export function isValidAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') {
    return false;
  }

  // Check length constraints
  if (accountId.length < 2 || accountId.length > 64) {
    return false;
  }

  // Check for implicit account (64 hex characters)
  if (IMPLICIT_ACCOUNT_REGEX.test(accountId)) {
    return true;
  }

  // Check standard account format
  return ACCOUNT_ID_REGEX.test(accountId);
}

/**
 * Format an account ID for display.
 * Truncates long account IDs with ellipsis in the middle.
 * @param accountId - The account ID to format
 * @param maxLength - Maximum display length (default: 20)
 * @returns Formatted account ID string
 */
export function formatAccountId(accountId: string, maxLength = 20): string {
  if (!accountId) {
    return '';
  }

  if (accountId.length <= maxLength) {
    return accountId;
  }

  // For named accounts, try to preserve the suffix (.near, .testnet)
  const parts = accountId.split('.');
  if (parts.length > 1) {
    const suffix = `.${parts[parts.length - 1]}`;
    const prefix = accountId.slice(0, accountId.length - suffix.length);

    // Calculate how much of the prefix we can show
    const availableLength = maxLength - suffix.length - 3; // 3 for "..."

    if (availableLength > 3) {
      return `${prefix.slice(0, availableLength)}...${suffix}`;
    }
  }

  // Fallback: truncate in the middle
  const charsToShow = Math.floor((maxLength - 3) / 2);
  return `${accountId.slice(0, charsToShow)}...${accountId.slice(-charsToShow)}`;
}

/**
 * Get the network suffix for the current network.
 * @returns ".near" for mainnet, ".testnet" for testnet
 */
export function getNetworkSuffix(): string {
  return config.near.network === 'mainnet' ? '.near' : '.testnet';
}
