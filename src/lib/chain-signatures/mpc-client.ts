/**
 * MPC client for NEAR Chain Signatures.
 *
 * Interacts with the NEAR MPC signer contract to:
 * 1. Derive EVM addresses from NEAR account IDs (client-side KDF)
 * 2. Request MPC signatures for EVM transaction payloads
 * 3. Parse signature responses from NEAR transaction outcomes
 *
 * Address derivation uses client-side key derivation:
 * - Fetch the root public key from the MPC contract (`public_key` view method)
 * - Compute epsilon = SHA3-256("near-mpc-recovery v0.1.0 epsilon derivation:{signerId},{path}")
 * - Derive child point = rootPoint + epsilon * G on secp256k1
 * - Convert uncompressed child public key → Ethereum address
 *
 * Uses the same RPC pattern as src/lib/near/project-accounts.ts
 * and wallet-selector action format from src/lib/zk/contract-client.ts.
 */

import { ethers } from 'ethers';
import { sha3_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1';
import { config } from '@/lib/config';
import { getMPCContractId, getChainConfig } from './chains';
import { MPCSignatureResponseSchema } from '@/types/chain-signatures';
import type { EVMChainId, MPCSignatureResponse } from '@/types/chain-signatures';
import type { WalletSelector } from '@near-wallet-selector/core';

// ============================================================================
// Constants
// ============================================================================

/** MPC sign() requires a deposit of 0.25 NEAR */
const MPC_SIGN_DEPOSIT = '250000000000000000000000'; // 0.25 NEAR in yoctoNEAR

/** Cached root public key from the MPC contract (same for all derivations) */
let cachedRootPublicKey: Uint8Array | null = null;

// ============================================================================
// RPC Helper (matches project-accounts.ts pattern)
// ============================================================================

interface RpcResponse<T> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code: number; message: string; data?: string };
}

interface ViewFunctionResult {
  result: number[];
  logs: string[];
  block_height: number;
  block_hash: string;
}

async function rpcQuery<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await fetch(config.near.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'shade-studio-mpc',
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
    throw new Error(
      `RPC error: ${data.error.message}${data.error.data ? ` — ${data.error.data}` : ''}`
    );
  }

  if (!data.result) {
    throw new Error('RPC response missing result');
  }

  return data.result;
}

// ============================================================================
// Address Derivation (client-side KDF)
// ============================================================================

/**
 * Fetch the MPC contract's root public key.
 *
 * The root key is the same for all derivations, so we cache it.
 * Returns the uncompressed SEC1 bytes (65 bytes, starting with 0x04).
 */
async function fetchRootPublicKey(): Promise<Uint8Array> {
  if (cachedRootPublicKey) return cachedRootPublicKey;

  const contractId = getMPCContractId();

  const result = await rpcQuery<ViewFunctionResult>('call_function', {
    account_id: contractId,
    method_name: 'public_key',
    args_base64: btoa('{}'),
  });

  // Decode result bytes → JSON string like "secp256k1:BASE58_KEY"
  const raw = String.fromCharCode(...result.result);
  const cleaned = raw.replace(/^"|"$/g, '');

  // Strip the "secp256k1:" prefix
  const base58Key = cleaned.replace(/^secp256k1:/, '');

  // Decode base58 to raw bytes (NEAR uses plain base58, no checksum)
  const decoded = ethers.decodeBase58(base58Key);
  const keyHex = ethers.toBeHex(decoded, 33).slice(2); // 33 bytes, remove 0x prefix

  // Convert compressed key to a ProjectivePoint and get uncompressed bytes
  const point = secp256k1.ProjectivePoint.fromHex(keyHex);
  cachedRootPublicKey = point.toRawBytes(false); // uncompressed (65 bytes)

  return cachedRootPublicKey;
}

/**
 * Derive a child public key from the root key using the NEAR MPC KDF.
 *
 * Algorithm:
 * 1. epsilon = SHA3-256("near-mpc-recovery v0.1.0 epsilon derivation:{signerId},{path}")
 * 2. childPoint = rootPoint + epsilon * G
 *
 * @param rootKeyUncompressed - 65-byte uncompressed root public key
 * @param signerId - NEAR account ID
 * @param path - MPC derivation path (e.g., "ethereum-1")
 * @returns Uncompressed child public key bytes (65 bytes)
 */
function deriveChildPublicKey(
  rootKeyUncompressed: Uint8Array,
  signerId: string,
  path: string
): Uint8Array {
  // Compute epsilon using NIST SHA3-256 (NOT Keccak-256)
  const epsilonInput = `near-mpc-recovery v0.1.0 epsilon derivation:${signerId},${path}`;
  const epsilonHash = sha3_256(new TextEncoder().encode(epsilonInput));

  // Interpret hash as a scalar (big-endian) and compute epsilon * G
  const epsilonScalar = BigInt('0x' + Buffer.from(epsilonHash).toString('hex'));
  const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(
    epsilonScalar % secp256k1.CURVE.n
  );

  // Add epsilon * G to the root public key point
  const rootPoint = secp256k1.ProjectivePoint.fromHex(rootKeyUncompressed);
  const childPoint = rootPoint.add(epsilonPoint);

  return childPoint.toRawBytes(false); // uncompressed (65 bytes)
}

/**
 * Derive an EVM address for a NEAR account on a given chain.
 *
 * Uses client-side key derivation:
 * 1. Fetch root public key from MPC contract (cached)
 * 2. Derive child key using SHA3-256 KDF + secp256k1 point math
 * 3. Convert uncompressed child public key to Ethereum address
 *
 * @param nearAccountId - The NEAR account ID (e.g., "alice.near")
 * @param chain - Target EVM chain
 * @returns The derived 0x-prefixed Ethereum address
 */
export async function deriveEVMAddress(
  nearAccountId: string,
  chain: EVMChainId
): Promise<string> {
  const chainConfig = getChainConfig(chain);

  const rootKey = await fetchRootPublicKey();
  const childKey = deriveChildPublicKey(rootKey, nearAccountId, chainConfig.mpcPath);

  // ethers.computeAddress accepts an uncompressed public key hex
  const childKeyHex = '0x' + Buffer.from(childKey).toString('hex');
  return ethers.computeAddress(childKeyHex);
}

/** Reset the cached root key (for testing) */
export function _resetRootKeyCache(): void {
  cachedRootPublicKey = null;
}

// ============================================================================
// Signature Request
// ============================================================================

/**
 * Request an MPC signature for a payload.
 *
 * Signs and sends a NEAR transaction to the MPC contract's `sign` method.
 * The wallet-selector handles the UI approval flow.
 *
 * @param payload - 32-byte hash to sign (keccak256 of the unsigned tx)
 * @param chain - Target EVM chain (determines derivation path)
 * @param walletSelector - The wallet selector instance
 * @returns The raw NEAR transaction outcome
 */
export async function requestMPCSignature(
  payload: Uint8Array,
  chain: EVMChainId,
  walletSelector: WalletSelector
): Promise<unknown> {
  const contractId = getMPCContractId();
  const chainConfig = getChainConfig(chain);

  const args = {
    payload: Array.from(payload),
    path: chainConfig.mpcPath,
    key_version: 0,
  };

  const wallet = await walletSelector.wallet();

  const outcome = await wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [
      {
        type: 'FunctionCall',
        params: {
          methodName: 'sign',
          args: new TextEncoder().encode(JSON.stringify(args)),
          gas: '300000000000000', // 300 TGas
          deposit: MPC_SIGN_DEPOSIT,
        },
      },
    ],
  });

  return outcome;
}

// ============================================================================
// Outcome Parsing
// ============================================================================

/**
 * Parse an MPC signature from a NEAR transaction outcome.
 *
 * The MPC contract returns the signature in the transaction receipt.
 * We check both `status.SuccessValue` on the outcome directly and
 * in `receipts_outcome` entries (matching contract-client.ts pattern).
 *
 * @param outcome - Raw NEAR transaction outcome
 * @returns Parsed and validated MPC signature
 */
export function parseMPCSignatureFromOutcome(outcome: unknown): MPCSignatureResponse {
  if (!outcome || typeof outcome !== 'object') {
    throw new Error('Invalid transaction outcome: expected object');
  }

  const obj = outcome as Record<string, unknown>;

  // Try direct status.SuccessValue first
  const directResult = extractSuccessValue(obj);
  if (directResult) {
    return validateSignature(directResult);
  }

  // Try receipts_outcome array
  if (Array.isArray(obj.receipts_outcome)) {
    for (const receipt of obj.receipts_outcome) {
      if (receipt && typeof receipt === 'object') {
        const receiptObj = receipt as Record<string, unknown>;
        const inner = receiptObj.outcome as Record<string, unknown> | undefined;
        if (inner) {
          const result = extractSuccessValue(inner);
          if (result) {
            return validateSignature(result);
          }
        }
      }
    }
  }

  throw new Error(
    'Could not extract MPC signature from transaction outcome'
  );
}

/**
 * Extract a decoded value from a NEAR execution status.
 */
function extractSuccessValue(obj: Record<string, unknown>): unknown | null {
  if (typeof obj.status === 'object' && obj.status) {
    const status = obj.status as Record<string, unknown>;
    if (typeof status.SuccessValue === 'string' && status.SuccessValue !== '') {
      try {
        const decoded = atob(status.SuccessValue);
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Validate an MPC signature using the Zod schema.
 */
function validateSignature(data: unknown): MPCSignatureResponse {
  const result = MPCSignatureResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid MPC signature format: ${result.error.issues.map((i) => i.message).join(', ')}`
    );
  }
  return result.data;
}
