'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ExternalLink,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils/cn';
import { getCircuitDisplay } from '@/lib/zk/circuit-display';
import type { UICredential } from '@/types/credentials';
import type { BadgeProps } from '@/components/ui/badge';

const STATUS_BADGE_VARIANT: Record<string, BadgeProps['variant']> = {
  pending: 'outline',
  generating: 'warning',
  ready: 'secondary',
  verified: 'success',
  'on-chain': 'default',
  failed: 'error',
  expired: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  generating: 'Generating',
  ready: 'Ready',
  verified: 'Verified',
  'on-chain': 'On-Chain',
  failed: 'Failed',
  expired: 'Expired',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CredentialDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: UICredential | null;
  onStoreOnChain?: (credential: UICredential) => void;
  onVerifyLocally?: (proofId: string) => void;
}

export function CredentialDetailDialog({
  open,
  onOpenChange,
  credential,
  onStoreOnChain,
  onVerifyLocally,
}: CredentialDetailDialogProps) {
  const [signalsOpen, setSignalsOpen] = useState(false);

  if (!credential) return null;

  const display = getCircuitDisplay(credential.circuit);
  const Icon = display.icon;
  const canVerifyLocally =
    credential.source === 'local' &&
    (credential.status === 'ready' || credential.status === 'pending');
  const canStoreOnChain =
    credential.source === 'local' &&
    (credential.status === 'ready' || credential.status === 'verified');

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover">
              <Icon className="h-5 w-5 text-text-primary" />
            </div>
            <div>
              <DialogTitle>{display.name}</DialogTitle>
              <DialogDescription>Credential Details</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + Source */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_BADGE_VARIANT[credential.status]}>
              {STATUS_LABEL[credential.status]}
            </Badge>
            {credential.source === 'on-chain' && (
              <Badge variant="default">
                <Cloud className="h-3 w-3 mr-1" />
                On-Chain
              </Badge>
            )}
            {credential.isExpired && (
              <Badge variant="error">Expired</Badge>
            )}
          </div>

          {/* Claim */}
          {credential.claim && (
            <div>
              <p className="text-xs text-text-muted mb-1">Claim</p>
              <p className="text-sm text-text-primary">{credential.claim}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-muted mb-0.5">Created</p>
              <p className="text-text-primary">{formatDate(credential.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-0.5">Verified</p>
              <p className="text-text-primary">{formatDate(credential.verifiedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-0.5">Expires</p>
              <p className={cn('text-text-primary', credential.isExpired && 'text-error')}>
                {formatDate(credential.expiresAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-0.5">Source</p>
              <p className="text-text-primary capitalize">{credential.source}</p>
            </div>
            {credential.owner && (
              <div className="col-span-2">
                <p className="text-xs text-text-muted mb-0.5">Owner</p>
                <p className="text-text-primary font-mono text-xs truncate">
                  {credential.owner}
                </p>
              </div>
            )}
          </div>

          {/* Public signals collapsible */}
          <Collapsible open={signalsOpen} onOpenChange={setSignalsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors w-full">
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  signalsOpen && 'rotate-180'
                )}
              />
              Public Signals ({credential.publicSignals.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 rounded-lg bg-surface p-3 text-xs text-text-muted font-mono overflow-auto max-h-40">
                {JSON.stringify(credential.publicSignals, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* On-chain explorer link */}
          {credential.source === 'on-chain' && credential.onChainCredential && (
            <a
              href={`https://testnet.nearblocks.io/address/${credential.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-near-green-500 hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              View on NEAR Explorer
            </a>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canVerifyLocally && onVerifyLocally && (
            <Button
              variant="secondary"
              onClick={() => onVerifyLocally(credential.id)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify Locally
            </Button>
          )}
          {canStoreOnChain && onStoreOnChain && (
            <Button onClick={() => onStoreOnChain(credential)}>
              <Cloud className="h-4 w-4 mr-2" />
              Store On-Chain
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
