/**
 * On-Chain Proof Verification via NEAR Smart Contract
 *
 * Sends a ZK proof to a verifier contract on NEAR for on-chain verification.
 * Follows the same transaction-building pattern as src/lib/near/social.ts.
 *
 * Accepts WalletSelector (not the React hook) so it works from both
 * hook context and utility code.
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import type { ZKProof, ProofVerificationResult } from '@/types/zk';
import { config } from '@/lib/config';
import { OnChainVerificationError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnChainVerifyOptions {
  /** Override the default verifier contract ID */
  contractId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 100 TGas — generous allocation for a verification call */
const VERIFICATION_GAS = BigInt('100000000000000');

/** Zero deposit */
const ZERO_DEPOSIT = BigInt('0');

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Verify a ZK proof on-chain via a NEAR smart contract.
 *
 * @param proof - The ZK proof to verify
 * @param walletSelector - NEAR wallet selector instance
 * @param options - Optional configuration
 * @returns Verification result with transaction hash
 */
export async function verifyProofOnChain(
  proof: ZKProof,
  walletSelector: WalletSelector,
  options: OnChainVerifyOptions = {}
): Promise<ProofVerificationResult> {
  const contractId = options.contractId ?? config.zk.verifierContractId;

  try {
    // Get active wallet
    const wallet = await walletSelector.wallet();

    // Build args for the contract call
    const args = {
      proof: {
        pi_a: proof.proof.pi_a,
        pi_b: proof.proof.pi_b,
        pi_c: proof.proof.pi_c,
      },
      public_signals: proof.publicSignals,
    };

    // Sign and send transaction
    const outcome = await wallet.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'verify_proof',
            args: new TextEncoder().encode(JSON.stringify(args)),
            gas: VERIFICATION_GAS.toString(),
            deposit: ZERO_DEPOSIT.toString(),
          },
        },
      ],
    });

    // Parse outcome
    const txHash = extractTransactionHash(outcome);
    const isValid = parseVerificationOutcome(outcome);

    return {
      isValid,
      timestamp: new Date().toISOString(),
      method: 'on-chain',
      transactionHash: txHash,
      ...(isValid ? {} : { error: 'On-chain verification returned false' }),
    };
  } catch (error) {
    // User rejected the transaction
    if (isUserRejection(error)) {
      return {
        isValid: false,
        timestamp: new Date().toISOString(),
        method: 'on-chain',
        error: 'Transaction rejected by user',
      };
    }

    // Wallet not connected
    if (isWalletNotConnected(error)) {
      return {
        isValid: false,
        timestamp: new Date().toISOString(),
        method: 'on-chain',
        error: 'Wallet not connected',
      };
    }

    // Contract or network failure
    const message = error instanceof Error ? error.message : String(error);
    throw new OnChainVerificationError(message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTransactionHash(outcome: unknown): string | undefined {
  if (!outcome || typeof outcome !== 'object') return undefined;

  // NEAR wallet selector returns different shapes depending on the wallet
  const obj = outcome as Record<string, unknown>;

  // Direct hash
  if (typeof obj.transaction_outcome === 'object' && obj.transaction_outcome) {
    const txOutcome = obj.transaction_outcome as Record<string, unknown>;
    if (typeof txOutcome.id === 'string') return txOutcome.id;
  }

  // Some wallets return it at top level
  if (typeof obj.hash === 'string') return obj.hash;
  if (typeof obj.transaction === 'object' && obj.transaction) {
    const tx = obj.transaction as Record<string, unknown>;
    if (typeof tx.hash === 'string') return tx.hash;
  }

  return undefined;
}

function parseVerificationOutcome(outcome: unknown): boolean {
  if (!outcome || typeof outcome !== 'object') return false;

  const obj = outcome as Record<string, unknown>;

  // Check status
  if (typeof obj.status === 'object' && obj.status) {
    const status = obj.status as Record<string, unknown>;

    // SuccessValue is base64-encoded JSON
    if (typeof status.SuccessValue === 'string') {
      try {
        const decoded = atob(status.SuccessValue);
        const parsed = JSON.parse(decoded);
        return parsed === true;
      } catch {
        return status.SuccessValue.length > 0;
      }
    }

    // Failure
    if (status.Failure) return false;
  }

  return false;
}

function isUserRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('rejected the request')
  );
}

function isWalletNotConnected(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('no wallet') ||
    msg.includes('not signed in') ||
    msg.includes('wallet not connected') ||
    msg.includes('no accounts')
  );
}
