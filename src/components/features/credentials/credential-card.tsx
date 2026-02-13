'use client';

import {
  MoreVertical,
  Eye,
  Cloud,
  Trash2,
  Share2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { getCircuitDisplay } from '@/lib/zk/circuit-display';
import type { UICredential } from '@/types/credentials';
import type { BadgeProps } from '@/components/ui/badge';

const STATUS_BADGE_VARIANT: Record<
  string,
  BadgeProps['variant']
> = {
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

interface CredentialCardProps {
  credential: UICredential;
  onView: (credential: UICredential) => void;
  onStoreOnChain: (credential: UICredential) => void;
  onShare: (credential: UICredential) => void;
  onRemove: (credential: UICredential) => void;
}

export function CredentialCard({
  credential,
  onView,
  onStoreOnChain,
  onShare,
  onRemove,
}: CredentialCardProps) {
  const display = getCircuitDisplay(credential.circuit);
  const Icon = display.icon;

  const canStoreOnChain =
    credential.source === 'local' &&
    (credential.status === 'ready' || credential.status === 'verified');

  const formattedDate = new Date(credential.createdAt).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  );

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-surface border-l-[3px] p-4 transition-all hover:border-border-hover',
        display.borderClass
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            display.iconBgClass
          )}
        >
          <Icon className={cn('h-5 w-5', display.iconTextClass)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-text-primary truncate">
              {display.name}
            </h4>
            <Badge variant={STATUS_BADGE_VARIANT[credential.status]}>
              {STATUS_LABEL[credential.status]}
            </Badge>
            {credential.source === 'on-chain' && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                <Cloud className="h-3 w-3 mr-1" />
                On-Chain
              </Badge>
            )}
          </div>
          {credential.claim && (
            <p className="text-xs text-text-muted mt-1 truncate">
              {credential.claim}
            </p>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(credential)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {canStoreOnChain && (
              <DropdownMenuItem onClick={() => onStoreOnChain(credential)}>
                <Cloud className="h-4 w-4 mr-2" />
                Store On-Chain
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onShare(credential)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(credential)}
              className="text-error focus:text-error"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-xs text-text-muted">{formattedDate}</span>
        <span className="text-xs text-text-muted">
          {credential.publicSignals.length} signal{credential.publicSignals.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
