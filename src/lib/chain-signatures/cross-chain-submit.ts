/**
 * Cross-chain submission orchestrator.
 *
 * Coordinates the full NEAR → EVM submission pipeline:
 * 1. Derive EVM address from NEAR account
 * 2. Build unsigned EVM transaction
 * 3. Serialize and hash for MPC signing
 * 4. Request MPC signature via NEAR wallet
 * 5. Assemble signed transaction
 * 6. Broadcast to EVM network
 * 7. Wait for on-chain confirmation
 *
 * Also provides pre-configured helpers for Gitcoin and Optimism RPGF.
 */

import { ethers } from 'ethers';
import { nanoid } from 'nanoid';
import { deriveEVMAddress, requestMPCSignature, parseMPCSignatureFromOutcome } from './mpc-client';
import {
  buildUnsignedTx,
  serializeForSigning,
  assembleSignedTx,
  broadcastTransaction,
  waitForConfirmation,
  simulateTransaction,
  encodeFunctionCall,
  evictProvider,
} from './evm-tx-builder';
import type { WalletSelector } from '@near-wallet-selector/core';
import type {
  CrossChainSubmission,
  CrossChainSubmitParams,
  GitcoinSubmitParams,
  OptimismRPGFParams,
  SubmissionProgressCallback,
} from '@/types/chain-signatures';

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Submit a transaction to an EVM chain via NEAR Chain Signatures.
 *
 * Runs the full 7-step pipeline with progress callbacks at each stage.
 * Returns a CrossChainSubmission record with the final status.
 *
 * @param params - Submission parameters (chain, contract, calldata)
 * @param nearAccountId - The sender's NEAR account ID
 * @param walletSelector - Wallet selector instance for signing
 * @param onProgress - Optional callback for step updates
 * @returns The submission record (success or failure)
 */
export async function submitCrossChain(
  params: CrossChainSubmitParams,
  nearAccountId: string,
  walletSelector: WalletSelector,
  onProgress?: SubmissionProgressCallback
): Promise<CrossChainSubmission> {
  const submission: CrossChainSubmission = {
    id: nanoid(),
    proposalId: params.proposalId,
    chain: params.chain,
    currentStep: 'deriving-address',
    startedAt: new Date().toISOString(),
  };

  try {
    // Step 1: Derive EVM address
    onProgress?.('deriving-address');
    submission.currentStep = 'deriving-address';
    const evmAddress = await deriveEVMAddress(nearAccountId, params.chain);
    submission.evmAddress = evmAddress;

    // Step 2: Build unsigned transaction
    onProgress?.('building-tx');
    submission.currentStep = 'building-tx';
    const unsignedTx = await buildUnsignedTx(
      params.chain,
      evmAddress,
      params.contractAddress,
      params.calldata,
      params.value ?? '0'
    );

    // Step 3: Simulate via eth_call to catch reverts early
    onProgress?.('simulating');
    submission.currentStep = 'simulating';
    await simulateTransaction(params.chain, unsignedTx, evmAddress);

    // Step 4: Request MPC signature
    onProgress?.('requesting-signature');
    submission.currentStep = 'requesting-signature';
    const txHash = serializeForSigning(unsignedTx);
    const outcome = await requestMPCSignature(txHash, params.chain, walletSelector);

    // Step 5: Assemble signed transaction
    onProgress?.('assembling-tx');
    submission.currentStep = 'assembling-tx';
    const mpcSignature = parseMPCSignatureFromOutcome(outcome);
    const signedTxHex = assembleSignedTx(unsignedTx, mpcSignature);

    // Step 6: Broadcast (retry once on network error with provider eviction)
    onProgress?.('broadcasting');
    submission.currentStep = 'broadcasting';
    let txResponse;
    try {
      txResponse = await broadcastTransaction(params.chain, signedTxHex);
    } catch (broadcastErr) {
      evictProvider(params.chain);
      txResponse = await broadcastTransaction(params.chain, signedTxHex);
    }
    submission.txHash = txResponse.hash;

    // Step 7: Wait for confirmation
    onProgress?.('confirming');
    submission.currentStep = 'confirming';
    await waitForConfirmation(params.chain, txResponse.hash);

    // Step 8: Complete
    onProgress?.('complete');
    submission.currentStep = 'complete';
    submission.completedAt = new Date().toISOString();

    return submission;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown cross-chain submission error';

    // Capture which step failed before overwriting currentStep
    submission.failedAtStep = submission.currentStep;
    onProgress?.('failed');
    submission.currentStep = 'failed';
    submission.error = errorMessage;
    submission.completedAt = new Date().toISOString();

    return submission;
  }
}

// ============================================================================
// Pre-configured Submission Helpers
// ============================================================================

/** Minimal Gitcoin Allo Protocol ABI for registerRecipient */
const ALLO_REGISTER_ABI = [
  'function registerRecipient(uint256 _poolId, bytes memory _data) external returns (address)',
];

/**
 * Submit a project to Gitcoin via Allo Protocol's registerRecipient.
 *
 * The _data parameter is ABI-encoded as:
 * (address recipientId, address recipientAddress, Metadata(uint256 protocol, string pointer))
 */
export async function submitToGitcoin(
  params: GitcoinSubmitParams,
  nearAccountId: string,
  walletSelector: WalletSelector,
  alloContractAddress: string,
  onProgress?: SubmissionProgressCallback
): Promise<CrossChainSubmission> {
  // ABI-encode the recipient data struct that registerRecipient expects as bytes
  const dataEncoder = new ethers.AbiCoder();
  const recipientData = dataEncoder.encode(
    ['address', 'address', 'tuple(uint256, string)'],
    [params.recipientAddress, params.recipientAddress, [1n, params.metadataCid]]
  );

  const calldata = encodeFunctionCall(
    ALLO_REGISTER_ABI,
    'registerRecipient',
    [params.poolId, recipientData]
  );

  return submitCrossChain(
    {
      proposalId: params.proposalId,
      chain: 'ethereum',
      contractAddress: alloContractAddress,
      calldata,
    },
    nearAccountId,
    walletSelector,
    onProgress
  );
}

/** Minimal Optimism RPGF ABI for registerProject */
const RPGF_REGISTER_ABI = [
  'function registerProject(string memory _name, bytes memory _metadata) external',
];

/**
 * Submit a project to Optimism RPGF.
 *
 * The _metadata parameter is ABI-encoded as bytes containing the CID string.
 */
export async function submitToOptimismRPGF(
  params: OptimismRPGFParams,
  nearAccountId: string,
  walletSelector: WalletSelector,
  onProgress?: SubmissionProgressCallback
): Promise<CrossChainSubmission> {
  // ABI-encode the metadata CID as bytes
  const metadataBytes = new ethers.AbiCoder().encode(
    ['string'],
    [params.metadataCid]
  );

  const calldata = encodeFunctionCall(
    RPGF_REGISTER_ABI,
    'registerProject',
    [params.projectName, metadataBytes]
  );

  return submitCrossChain(
    {
      proposalId: params.proposalId,
      chain: 'optimism',
      contractAddress: params.roundContract,
      calldata,
    },
    nearAccountId,
    walletSelector,
    onProgress
  );
}
