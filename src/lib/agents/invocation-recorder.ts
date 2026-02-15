/**
 * Invocation Recorder
 *
 * Records agent invocations on-chain via the registry contract's
 * record_invocation method. Fire-and-forget — invocation completes
 * even if recording fails.
 */

import type { WalletSelector } from '@near-wallet-selector/core';
import { config } from '@/lib/config';

// ============================================================================
// Constants
// ============================================================================

const RECORD_GAS = '20000000000000'; // 20 TGas — lightweight method
const CONTRACT_ID = config.agents.registryContractId;

// ============================================================================
// Recording
// ============================================================================

/**
 * Record an invocation on-chain (fire-and-forget).
 *
 * Calls `record_invocation` on the registry contract to increment
 * the agent's invocation_count and update last_active_at.
 *
 * This is intentionally non-blocking — the invocation result is
 * returned to the user regardless of whether recording succeeds.
 */
export async function recordInvocation(
  agentAccountId: string,
  invocationType: string,
  walletSelector: WalletSelector,
): Promise<void> {
  try {
    const wallet = await walletSelector.wallet();
    await wallet.signAndSendTransaction({
      receiverId: CONTRACT_ID,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'record_invocation',
            args: new TextEncoder().encode(
              JSON.stringify({
                agent_account_id: agentAccountId,
                invocation_type: invocationType,
              })
            ),
            gas: RECORD_GAS,
            deposit: '0',
          },
        },
      ],
    });
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.warn(
      `Failed to record invocation for ${agentAccountId}:`,
      err instanceof Error ? err.message : err
    );
  }
}

// ============================================================================
// Batch Recording (future enhancement)
// ============================================================================

interface PendingRecord {
  agentAccountId: string;
  invocationType: string;
  timestamp: number;
}

const pendingRecords: PendingRecord[] = [];
let batchTimerId: ReturnType<typeof setTimeout> | null = null;

const BATCH_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Queue an invocation for batched recording.
 * Records are flushed every 30 seconds.
 */
export function queueInvocationRecord(
  agentAccountId: string,
  invocationType: string,
): void {
  pendingRecords.push({
    agentAccountId,
    invocationType,
    timestamp: Date.now(),
  });

  // Start batch timer if not running
  if (!batchTimerId) {
    batchTimerId = setTimeout(() => {
      batchTimerId = null;
      // Batch recording would process pendingRecords here
      // For now, individual recording is used
      pendingRecords.length = 0;
    }, BATCH_INTERVAL_MS);
  }
}

/**
 * Flush any pending batch records immediately.
 */
export function flushPendingRecords(): PendingRecord[] {
  const flushed = [...pendingRecords];
  pendingRecords.length = 0;
  if (batchTimerId) {
    clearTimeout(batchTimerId);
    batchTimerId = null;
  }
  return flushed;
}
