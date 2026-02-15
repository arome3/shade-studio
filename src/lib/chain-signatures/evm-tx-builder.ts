/**
 * EVM transaction builder for NEAR Chain Signatures.
 *
 * Uses ethers v6 to:
 * 1. Build unsigned EIP-1559 transactions with gas estimation
 * 2. Serialize transactions for MPC signing (keccak256 hash)
 * 3. Assemble signed transactions from MPC signature responses
 * 4. Broadcast and confirm transactions on EVM chains
 * 5. ABI-encode function calls for grant protocol contracts
 */

import { ethers } from 'ethers';
import { getChainConfig } from './chains';
import type { EVMChainId, MPCSignatureResponse, UnsignedEVMTransaction } from '@/types/chain-signatures';

// ============================================================================
// Provider Cache
// ============================================================================

const providerCache = new Map<EVMChainId, ethers.JsonRpcProvider>();

/** Get or create a cached JSON-RPC provider for a chain. */
export function getProvider(chain: EVMChainId): ethers.JsonRpcProvider {
  let provider = providerCache.get(chain);
  if (!provider) {
    const chainConfig = getChainConfig(chain);
    provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, chainConfig.chainId);
    providerCache.set(chain, provider);
  }
  return provider;
}

/** Evict a cached provider (call on network errors to force reconnection). */
export function evictProvider(chain: EVMChainId): void {
  providerCache.delete(chain);
}

// ============================================================================
// Transaction Building
// ============================================================================

/**
 * Build an unsigned EIP-1559 transaction.
 *
 * Fetches nonce, gas price, and estimates gas from the target chain RPC.
 *
 * @param chain - Target EVM chain
 * @param from - Sender address (derived MPC address)
 * @param to - Target contract address
 * @param data - ABI-encoded calldata
 * @param value - Value to send in wei (default: "0")
 * @returns The unsigned transaction fields
 */
export async function buildUnsignedTx(
  chain: EVMChainId,
  from: string,
  to: string,
  data: string,
  value: string = '0'
): Promise<UnsignedEVMTransaction> {
  const provider = getProvider(chain);
  const chainConfig = getChainConfig(chain);

  // Fetch nonce and fee data in parallel
  const [nonce, feeData, gasEstimate] = await Promise.all([
    provider.getTransactionCount(from, 'latest'),
    provider.getFeeData(),
    provider.estimateGas({ from, to, data, value }),
  ]);

  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error(`Chain ${chain} does not support EIP-1559 transactions`);
  }

  // Add 20% buffer to gas estimate for safety
  const gasLimit = (gasEstimate * 120n) / 100n;

  return {
    to,
    value,
    data,
    nonce,
    maxFeePerGas: feeData.maxFeePerGas.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString(),
    gasLimit: gasLimit.toString(),
    chainId: chainConfig.chainId,
    type: 2,
  };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize an unsigned transaction and return its keccak256 hash.
 *
 * This 32-byte hash is what gets sent to the MPC contract for signing.
 * Uses ethers.Transaction to produce the correct EIP-1559 RLP encoding.
 *
 * @param tx - The unsigned transaction fields
 * @returns 32-byte Uint8Array hash for MPC signing
 */
export function serializeForSigning(tx: UnsignedEVMTransaction): Uint8Array {
  const ethersTx = ethers.Transaction.from({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    nonce: tx.nonce,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    gasLimit: tx.gasLimit,
    chainId: tx.chainId,
    type: tx.type,
  });

  // unsignedHash returns the keccak256 of the RLP-encoded unsigned tx
  const hash = ethersTx.unsignedHash;
  return ethers.getBytes(hash);
}

// ============================================================================
// Signature Assembly
// ============================================================================

/**
 * Assemble a signed transaction from an unsigned tx and MPC signature.
 *
 * Maps the MPC response format { big_r, s, recovery_id } to
 * ethers Signature { r, s, v }, then serializes the fully signed tx.
 *
 * @param tx - The unsigned transaction fields
 * @param mpcSignature - The MPC signature response
 * @returns Hex string of the serialized signed transaction
 */
export function assembleSignedTx(
  tx: UnsignedEVMTransaction,
  mpcSignature: MPCSignatureResponse
): string {
  // The big_r affine_point is a hex-encoded SEC1 compressed public key.
  // The x-coordinate (bytes 1..33) is the ECDSA r value.
  const rHex = mpcSignature.big_r.affine_point.startsWith('04')
    ? mpcSignature.big_r.affine_point.substring(2, 66) // uncompressed: skip 04 prefix
    : mpcSignature.big_r.affine_point.substring(2, 66); // compressed: skip 02/03 prefix

  const sHex = mpcSignature.s.scalar;
  const v = mpcSignature.recovery_id;

  const signature = ethers.Signature.from({
    r: `0x${rHex}`,
    s: `0x${sHex}`,
    yParity: v as 0 | 1, // EIP-1559 (type 2) uses yParity (0 or 1), not legacy v
  });

  const ethersTx = ethers.Transaction.from({
    to: tx.to,
    value: tx.value,
    data: tx.data,
    nonce: tx.nonce,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    gasLimit: tx.gasLimit,
    chainId: tx.chainId,
    type: tx.type,
    signature,
  });

  return ethersTx.serialized;
}

// ============================================================================
// Broadcasting
// ============================================================================

/**
 * Broadcast a signed transaction to an EVM chain.
 *
 * @param chain - Target EVM chain
 * @param signedTxHex - Serialized signed transaction hex
 * @returns The transaction response from the RPC
 */
export async function broadcastTransaction(
  chain: EVMChainId,
  signedTxHex: string
): Promise<ethers.TransactionResponse> {
  const provider = getProvider(chain);
  return provider.broadcastTransaction(signedTxHex);
}

/**
 * Wait for a transaction to be confirmed.
 *
 * @param chain - Target EVM chain
 * @param txHash - Transaction hash to wait for
 * @param confirmations - Number of confirmations to wait (default: 1)
 * @returns The transaction receipt
 */
export async function waitForConfirmation(
  chain: EVMChainId,
  txHash: string,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt> {
  const provider = getProvider(chain);
  const receipt = await provider.waitForTransaction(txHash, confirmations, 60_000);

  if (!receipt) {
    throw new Error(`Transaction ${txHash} confirmation timed out`);
  }

  if (receipt.status === 0) {
    throw new Error(`Transaction ${txHash} reverted on-chain`);
  }

  return receipt;
}

// ============================================================================
// Simulation
// ============================================================================

/**
 * Simulate a transaction via eth_call to catch reverts before signing.
 *
 * @param chain - Target EVM chain
 * @param tx - The unsigned transaction to simulate
 * @param from - The sender address (derived MPC address)
 * @throws If the simulation reverts or fails
 */
export async function simulateTransaction(
  chain: EVMChainId,
  tx: UnsignedEVMTransaction,
  from: string
): Promise<void> {
  const provider = getProvider(chain);
  try {
    await provider.call({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      from,
    });
  } catch (err) {
    throw new Error(
      `Transaction simulation failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

// ============================================================================
// ABI Encoding
// ============================================================================

/**
 * ABI-encode a function call for an EVM contract.
 *
 * @param abi - Contract ABI (array or Interface)
 * @param methodName - Function name to call
 * @param args - Arguments to encode
 * @returns Hex-encoded calldata
 */
export function encodeFunctionCall(
  abi: ethers.InterfaceAbi,
  methodName: string,
  args: unknown[]
): string {
  const iface = new ethers.Interface(abi);
  return iface.encodeFunctionData(methodName, args);
}
