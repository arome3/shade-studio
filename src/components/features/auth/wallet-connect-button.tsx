'use client';

import { useState, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Wallet, Copy, ExternalLink, LogOut, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { useMounted } from '@/hooks/use-mounted';
import { formatAccountId, getExplorerAccountUrl } from '@/lib/near';
import { cn } from '@/lib/utils/cn';

/**
 * Wallet connection button with dropdown menu for connected state.
 *
 * States:
 * - Disconnected: Green "Connect Wallet" button
 * - Connecting: Loading spinner with "Connecting..."
 * - Connected: Account avatar + truncated ID + dropdown
 *
 * Dropdown menu items:
 * - Copy Address (with checkmark feedback)
 * - View on Explorer (external link)
 * - Disconnect
 */
export function WalletConnectButton() {
  const mounted = useMounted();
  const { isConnected, isConnecting, accountId, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  /**
   * Copy account ID to clipboard with visual feedback.
   */
  const handleCopyAddress = useCallback(async () => {
    if (!accountId) return;

    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [accountId]);

  /**
   * Open explorer in new tab.
   */
  const handleViewExplorer = useCallback(() => {
    if (!accountId) return;
    window.open(getExplorerAccountUrl(accountId), '_blank', 'noopener,noreferrer');
  }, [accountId]);

  /**
   * Handle disconnect with error handling.
   */
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }, [disconnect]);

  // Prevent hydration mismatch by showing nothing until mounted
  if (!mounted) {
    return (
      <Button variant="default" disabled className="min-w-[140px]">
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <Button variant="default" disabled loading className="min-w-[140px]">
        Connecting...
      </Button>
    );
  }

  // Disconnected state
  if (!isConnected || !accountId) {
    return (
      <Button variant="default" onClick={connect} className="min-w-[140px]">
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  // Connected state with dropdown
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="secondary"
          className="min-w-[140px] justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <AccountAvatar accountId={accountId} />
            <span className="max-w-[120px] truncate">
              {formatAccountId(accountId, 16)}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-50 min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
          sideOffset={8}
          align="end"
        >
          {/* Account ID header */}
          <div className="px-2 py-1.5 text-xs text-text-muted">
            {formatAccountId(accountId, 24)}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          {/* Copy Address */}
          <DropdownMenu.Item
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary outline-none',
              'hover:bg-surface-hover focus:bg-surface-hover'
            )}
            onSelect={handleCopyAddress}
          >
            {copied ? (
              <Check className="h-4 w-4 text-near-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy Address'}
          </DropdownMenu.Item>

          {/* View on Explorer */}
          <DropdownMenu.Item
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary outline-none',
              'hover:bg-surface-hover focus:bg-surface-hover'
            )}
            onSelect={handleViewExplorer}
          >
            <ExternalLink className="h-4 w-4" />
            View on Explorer
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          {/* Disconnect */}
          <DropdownMenu.Item
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-error outline-none',
              'hover:bg-error/10 focus:bg-error/10'
            )}
            onSelect={handleDisconnect}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Simple avatar component that generates a consistent color from account ID.
 */
function AccountAvatar({ accountId }: { accountId: string }) {
  // Generate a consistent hue from the account ID
  const hue = accountId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  // Get first character(s) for display
  const initials = accountId
    .replace(/\.(near|testnet)$/, '')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-near-white"
      style={{
        backgroundColor: `hsl(${hue}, 60%, 45%)`,
      }}
    >
      {initials}
    </div>
  );
}
