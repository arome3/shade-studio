/**
 * Handles MyNearWallet sign-message redirect callbacks.
 *
 * When MyNearWallet completes a signMessage request, it redirects back
 * to the app with the result in URL hash params:
 *   #accountId=...&signature=...&publicKey=...
 *
 * This module parses those params, stores the result, and provides it
 * to the encryption initialization flow so a second signing redirect
 * isn't needed.
 */

export interface SignMessageCallbackResult {
  accountId: string;
  signature: string;
  publicKey: string;
}

/** Module-level storage for the pending callback result */
let pendingResult: SignMessageCallbackResult | null = null;

/**
 * Parse sign-message callback params from the current URL hash.
 * Returns the result if valid params are found, null otherwise.
 *
 * Expected hash format:
 *   #accountId=foo.testnet&signature=base64data&publicKey=ed25519:...
 */
export function parseSignMessageCallback(): SignMessageCallbackResult | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash || !hash.includes('signature=')) return null;

  const params = new URLSearchParams(hash.slice(1)); // remove leading #
  const accountId = params.get('accountId');
  const signature = params.get('signature');
  const publicKey = params.get('publicKey');

  if (!accountId || !signature) return null;

  return {
    accountId,
    signature,
    publicKey: publicKey ?? '',
  };
}

/**
 * Parse the callback from URL hash, store it, and clean the URL.
 * Should be called once on app load (in WalletProvider).
 *
 * @returns true if a callback was found and stored
 */
export function captureSignMessageCallback(): boolean {
  const result = parseSignMessageCallback();
  if (!result) return false;

  pendingResult = result;

  // Clean the hash from the URL without triggering a page reload
  if (typeof window !== 'undefined') {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(
      '[SignMessageCallback] Captured callback for',
      result.accountId
    );
  }

  return true;
}

/**
 * Get and consume the pending sign-message result.
 * Returns the result once and clears it — subsequent calls return null.
 */
export function consumeSignMessageResult(): SignMessageCallbackResult | null {
  const result = pendingResult;
  pendingResult = null;
  return result;
}

/**
 * Check if there's a pending sign-message result without consuming it.
 */
export function hasPendingSignMessageResult(): boolean {
  return pendingResult !== null;
}
