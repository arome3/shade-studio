'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cloud } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { getCircuitDisplay } from '@/lib/zk/circuit-display';
import type { UICredential } from '@/types/credentials';

interface StoreOnChainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: UICredential | null;
  onStore: (proofId: string, claim?: string) => Promise<string | null>;
  getStorageCost: () => Promise<string>;
}

export function StoreOnChainDialog({
  open,
  onOpenChange,
  credential,
  onStore,
  getStorageCost,
}: StoreOnChainDialogProps) {
  const [claim, setClaim] = useState('');
  const [storageCost, setStorageCost] = useState<string | null>(null);
  const [isStoring, setIsStoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClaim('');
      setError(null);
      getStorageCost()
        .then(setStorageCost)
        .catch(() => setStorageCost(null));
    }
  }, [open, getStorageCost]);

  const handleStore = useCallback(async () => {
    if (!credential) return;
    setIsStoring(true);
    setError(null);

    try {
      const result = await onStore(credential.id, claim || undefined);
      if (result) {
        onOpenChange(false);
      } else {
        setError('Failed to store credential on-chain.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsStoring(false);
    }
  }, [credential, claim, onStore, onOpenChange]);

  if (!credential) return null;

  const display = getCircuitDisplay(credential.circuit);
  const Icon = display.icon;

  // Format yoctoNEAR to NEAR (1 NEAR = 1e24 yoctoNEAR)
  const formatNear = (yocto: string) => {
    const near = Number(BigInt(yocto)) / 1e24;
    return near < 0.001 ? '< 0.001' : near.toFixed(4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Store On-Chain</DialogTitle>
          <DialogDescription>
            Store your credential on the NEAR blockchain for permanent, verifiable proof.
          </DialogDescription>
        </DialogHeader>

        {/* Proof summary */}
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover">
              <Icon className="h-4 w-4 text-text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {display.name}
              </p>
              <p className="text-xs text-text-muted">
                {credential.publicSignals.length} public signals
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              Local
            </Badge>
          </div>
        </div>

        {/* Claim input */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">
            Claim (optional)
          </label>
          <Input
            placeholder="e.g., Active NEAR builder since 2023"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            maxLength={256}
          />
          <p className="text-xs text-text-muted mt-1">
            A public description attached to your on-chain credential.
          </p>
        </div>

        {/* Storage cost */}
        {storageCost && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
            <span className="text-sm text-text-muted">Storage Deposit</span>
            <span className="text-sm font-medium text-text-primary">
              {formatNear(storageCost)} NEAR
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-error/20 bg-error/5 p-3 space-y-2">
            <p className="text-sm text-error">{error}</p>
            <Button variant="outline" size="sm" onClick={handleStore}>
              Retry
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStore} loading={isStoring} disabled={isStoring}>
            <Cloud className={cn('h-4 w-4 mr-2', isStoring && 'hidden')} />
            Store On-Chain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
