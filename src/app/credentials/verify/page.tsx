'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOnChainCredential, isOnChainCredentialValid } from '@/lib/zk/contract-client';
import { getCircuitDisplay } from '@/lib/zk/circuit-display';
import type { OnChainCredential, ZKCircuit } from '@/types/zk';

// ============================================================================
// Types
// ============================================================================

type VerifyState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'local-only' }
  | { status: 'error'; message: string }
  | {
      status: 'verified';
      credential: OnChainCredential;
      isValid: boolean;
      isExpired: boolean;
    };

// ============================================================================
// Component
// ============================================================================

export default function CredentialVerifyPage() {
  const searchParams = useSearchParams();
  const circuit = searchParams.get('circuit') as ZKCircuit | null;
  const id = searchParams.get('id');
  const source = searchParams.get('source');
  const claim = searchParams.get('claim');

  const [state, setState] = useState<VerifyState>({ status: 'loading' });

  useEffect(() => {
    if (!id || !circuit) {
      setState({ status: 'not-found' });
      return;
    }

    if (source === 'local') {
      setState({ status: 'local-only' });
      return;
    }

    // Fetch on-chain credential
    let cancelled = false;

    async function fetchCredential() {
      try {
        const [credential, isValid] = await Promise.all([
          getOnChainCredential(id!),
          isOnChainCredentialValid(id!),
        ]);

        if (cancelled) return;

        if (!credential) {
          setState({ status: 'not-found' });
          return;
        }

        const isExpired =
          credential.expiresAt > 0 &&
          credential.expiresAt * 1000 < Date.now();

        setState({
          status: 'verified',
          credential,
          isValid: isValid ?? false,
          isExpired,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to verify credential',
        });
      }
    }

    fetchCredential();
    return () => {
      cancelled = true;
    };
  }, [id, circuit, source]);

  // =========================================================================
  // Render helpers
  // =========================================================================

  const display = circuit ? getCircuitDisplay(circuit) : null;
  const Icon = display?.icon ?? Shield;

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-text-muted mb-4" />
            <p className="text-sm text-text-muted">Verifying credential...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <XCircle className="h-12 w-12 text-error mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Credential Not Found
            </h2>
            <p className="text-sm text-text-muted text-center">
              This credential could not be found on-chain. It may have been
              removed or the link may be invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'local-only') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-text-muted mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Local Credential
            </h2>
            <p className="text-sm text-text-muted text-center max-w-xs">
              This credential is stored locally and can only be verified by its
              owner. Ask the owner to store it on-chain for public verification.
            </p>
            {claim && (
              <div className="mt-4 rounded-lg border border-border bg-surface p-3 w-full">
                <p className="text-xs text-text-muted mb-1">Claim</p>
                <p className="text-sm text-text-primary">{claim}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-error mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Verification Error
            </h2>
            <p className="text-sm text-text-muted text-center mb-4">
              {state.message}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // state.status === 'verified'
  const { credential, isValid, isExpired } = state;
  const verifiedDate = new Date(credential.verifiedAt * 1000).toLocaleString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  );
  const expiresDate =
    credential.expiresAt > 0
      ? new Date(credential.expiresAt * 1000).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
      : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover mb-3">
              <Icon className="h-7 w-7 text-text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              {display?.name ?? 'ZK Credential'}
            </h2>
            <p className="text-xs text-text-muted mt-1">On-Chain Verification</p>
          </div>

          {/* Status */}
          <div className="flex justify-center gap-2">
            {isValid && !isExpired ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Valid
              </Badge>
            ) : isExpired ? (
              <Badge variant="error" className="gap-1">
                <Clock className="h-3 w-3" />
                Expired
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <XCircle className="h-3 w-3" />
                Invalid
              </Badge>
            )}
            <Badge variant="default">On-Chain</Badge>
          </div>

          {/* Claim */}
          {(credential.claim || claim) && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-text-muted mb-1">Claim</p>
              <p className="text-sm text-text-primary">
                {credential.claim ?? claim}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-muted mb-0.5">Verified At</p>
              <p className="text-text-primary">{verifiedDate}</p>
            </div>
            {expiresDate && (
              <div>
                <p className="text-xs text-text-muted mb-0.5">Expires</p>
                <p className={isExpired ? 'text-error' : 'text-text-primary'}>
                  {expiresDate}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-muted mb-0.5">Owner</p>
              <p className="text-text-primary font-mono text-xs truncate">
                {credential.owner}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-0.5">Signals</p>
              <p className="text-text-primary">
                {credential.publicSignals.length} public signals
              </p>
            </div>
          </div>

          {/* Explorer link */}
          <a
            href={`https://testnet.nearblocks.io/address/${credential.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-near-green-500 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View on NEAR Explorer
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
