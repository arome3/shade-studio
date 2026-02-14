/**
 * NEAR sub-account management for project workspaces.
 *
 * Provides functions to:
 * - Validate and create sub-accounts (e.g., project-name.alice.testnet)
 * - Query on-chain account and access key state via direct RPC
 * - Build wallet-compatible actions for key management
 * - Map on-chain access keys back to permission levels
 */

import { config } from '@/lib/config';
import { isValidAccountId } from '@/lib/near/config';
import {
  SubAccountNameSchema,
  PERMISSION_CONFIGS,
  type PermissionLevel,
  type PermissionConfig,
  type AccountInfo,
  type AccessKeyList,
  type AccessKeyInfo,
  type WalletAction,
} from '@/types/project-accounts';

// ============================================================================
// NEAR ↔ yoctoNEAR Conversion
// ============================================================================

const YOCTO_PER_NEAR = BigInt('1000000000000000000000000'); // 10^24

/**
 * Convert NEAR amount to yoctoNEAR string.
 * @param near - Amount in NEAR (e.g., "0.1", "1")
 */
export function nearToYocto(near: string): string {
  const parts = near.split('.');
  const whole = parts[0] ?? '0';
  const decimal = (parts[1] ?? '').padEnd(24, '0').slice(0, 24);
  return (BigInt(whole) * YOCTO_PER_NEAR + BigInt(decimal)).toString();
}

/**
 * Convert yoctoNEAR string to NEAR amount.
 * @param yocto - Amount in yoctoNEAR
 */
export function yoctoToNear(yocto: string): string {
  const value = BigInt(yocto);
  const whole = value / YOCTO_PER_NEAR;
  const remainder = value % YOCTO_PER_NEAR;
  const decimal = remainder.toString().padStart(24, '0');

  // Trim trailing zeros, keep at least 2 decimal places
  const trimmed = decimal.replace(/0+$/, '');
  const display = trimmed.length < 2 ? decimal.slice(0, 2) : trimmed;

  return `${whole}.${display}`;
}

// ============================================================================
// RPC Helper
// ============================================================================

interface RpcResponse<T> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code: number; message: string; data?: string };
}

/**
 * Make a direct JSON-RPC query to the NEAR node.
 * Uses config.near.rpcUrl — avoids heavy SDK imports.
 */
async function rpcQuery<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await fetch(config.near.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'shade-studio',
      method: 'query',
      params: {
        request_type: method,
        finality: 'final',
        ...params,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RpcResponse<T>;

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}${data.error.data ? ` — ${data.error.data}` : ''}`);
  }

  if (!data.result) {
    throw new Error('RPC response missing result');
  }

  return data.result;
}

// ============================================================================
// Validation
// ============================================================================

export interface SubAccountValidation {
  valid: boolean;
  error?: string;
  fullAccountId?: string;
}

/**
 * Validate a sub-account name and construct the full account ID.
 *
 * @param name - The sub-account name portion (e.g., "my-project")
 * @param parentAccountId - The parent account (e.g., "alice.testnet")
 * @returns Validation result with full account ID if valid
 */
export function validateSubAccountName(
  name: string,
  parentAccountId: string
): SubAccountValidation {
  // Validate name with Zod schema
  const result = SubAccountNameSchema.safeParse(name);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message ?? 'Invalid sub-account name',
    };
  }

  // Construct full account ID
  const fullAccountId = `${name}.${parentAccountId}`;

  // NEAR accounts max 64 chars total
  if (fullAccountId.length > 64) {
    return {
      valid: false,
      error: `Full account ID exceeds 64 characters (${fullAccountId.length})`,
    };
  }

  // Validate final account ID format
  if (!isValidAccountId(fullAccountId)) {
    return {
      valid: false,
      error: 'Invalid NEAR account ID format',
    };
  }

  return {
    valid: true,
    fullAccountId,
  };
}

// ============================================================================
// Account Queries
// ============================================================================

/**
 * Check if a NEAR account exists on-chain.
 * @returns AccountInfo if the account exists, null if it doesn't.
 */
export async function checkAccountExists(
  accountId: string
): Promise<AccountInfo | null> {
  try {
    return await rpcQuery<AccountInfo>('view_account', {
      account_id: accountId,
    });
  } catch (err) {
    // "does not exist" is expected for new accounts
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('does not exist') ||
      message.includes('UNKNOWN_ACCOUNT')
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Get all access keys for an account.
 */
export async function getAccessKeyList(
  accountId: string
): Promise<AccessKeyList> {
  return rpcQuery<AccessKeyList>('view_access_key_list', {
    account_id: accountId,
  });
}

// ============================================================================
// Action Builders
// ============================================================================

/**
 * Build wallet actions for creating a sub-account.
 *
 * Creates 3 actions:
 * 1. CreateAccount — creates the sub-account
 * 2. Transfer — deposits initial NEAR balance
 * 3. AddKey — adds a FullAccess key for the owner
 *
 * @param publicKey - Owner's public key for the new account
 * @param deposit - Initial deposit in NEAR (e.g., "0.1")
 */
export function buildCreateSubAccountActions(
  publicKey: string,
  deposit: string
): WalletAction[] {
  return [
    { type: 'CreateAccount' },
    {
      type: 'Transfer',
      params: { deposit: nearToYocto(deposit) },
    },
    {
      type: 'AddKey',
      params: {
        publicKey,
        accessKey: { permission: 'FullAccess' },
      },
    },
  ];
}

/**
 * Build a wallet action for adding an access key with a specific permission level.
 *
 * @param publicKey - The public key to add
 * @param permission - Permission level (determines key type and allowance)
 */
export function buildAddKeyAction(
  publicKey: string,
  permission: PermissionLevel
): WalletAction {
  const permConfig = getPermissionConfig(permission);

  if (!permConfig.accessKeyPermission) {
    throw new Error(`Permission level "${permission}" does not require an access key`);
  }

  if (permConfig.accessKeyPermission.type === 'FullAccess') {
    return {
      type: 'AddKey',
      params: {
        publicKey,
        accessKey: { permission: 'FullAccess' },
      },
    };
  }

  const { receiverId, methodNames, allowance } = permConfig.accessKeyPermission;

  return {
    type: 'AddKey',
    params: {
      publicKey,
      accessKey: {
        permission: {
          receiverId: receiverId!,
          methodNames: methodNames!,
          allowance: allowance!,
        },
      },
    },
  };
}

/**
 * Build a wallet action for deleting an access key.
 */
export function buildDeleteKeyAction(publicKey: string): WalletAction {
  return {
    type: 'DeleteKey',
    params: { publicKey },
  };
}

// ============================================================================
// Permission Utilities
// ============================================================================

/**
 * Get the permission configuration for a given level.
 */
export function getPermissionConfig(level: PermissionLevel): PermissionConfig {
  return PERMISSION_CONFIGS[level];
}

/**
 * Infer a permission level from an on-chain access key.
 *
 * Maps the key's permission structure back to our PermissionLevel enum:
 * - FullAccess → owner
 * - FunctionCall with [set, grant_write_permission] → editor
 * - FunctionCall with [set] → contributor
 * - Unknown FunctionCall → contributor (safe default)
 */
export function inferPermissionFromAccessKey(
  accessKey: AccessKeyInfo
): PermissionLevel {
  const permission = accessKey.access_key.permission;

  if (permission === 'FullAccess') {
    return 'owner';
  }

  if (typeof permission === 'object' && 'FunctionCall' in permission) {
    const { method_names, receiver_id } = permission.FunctionCall;

    // Check if it targets the social contract
    if (receiver_id === config.near.socialContractId) {
      if (
        method_names.includes('set') &&
        method_names.includes('grant_write_permission')
      ) {
        return 'editor';
      }
      if (method_names.includes('set')) {
        return 'contributor';
      }
    }

    // Non-social contract function call key — treat as contributor
    return 'contributor';
  }

  return 'viewer';
}
