'use client';

import Link from 'next/link';
import { Shield, FileText, FolderOpen, Sparkles, Cpu } from 'lucide-react';
import { WalletConnectButton, ConnectionStatus } from '@/components/features/auth';
import { useMounted } from '@/hooks/use-mounted';
import { useIsConnected } from '@/stores/auth-store';
import { cn } from '@/lib/utils/cn';

/**
 * Navigation items for authenticated users.
 */
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: FolderOpen },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/ai', label: 'AI Studio', icon: Sparkles },
  { href: '/ai/pipelines', label: 'Pipelines', icon: Cpu },
] as const;

/**
 * Application header with logo, navigation, and wallet connection.
 *
 * Features:
 * - Responsive logo (icon only on mobile)
 * - Navigation shown only when connected
 * - Wallet connect button with status indicator
 * - Sticky positioning with blur backdrop
 */
export function Header() {
  const mounted = useMounted();
  const isConnected = useIsConnected();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-text-primary transition-colors hover:text-near-green-500"
        >
          <Shield className="h-7 w-7 text-near-green-500" />
          <span className="hidden font-semibold sm:inline-block">
            Private Grant Studio
          </span>
        </Link>

        {/* Navigation - only show when connected */}
        {mounted && isConnected && (
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Right side: Status + Wallet */}
        <div className="flex items-center gap-4">
          {mounted && isConnected && (
            <ConnectionStatus className="hidden sm:flex" />
          )}
          <WalletConnectButton />
        </div>
      </div>

      {/* Mobile navigation */}
      {mounted && isConnected && (
        <nav className="flex items-center gap-1 border-t border-border/50 px-4 md:hidden">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.href} href={item.href}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </MobileNavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

/**
 * Desktop navigation link component.
 */
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors',
        'hover:bg-surface hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-near-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Mobile navigation link component.
 */
function MobileNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 py-3 text-xs font-medium text-text-secondary transition-colors',
        'hover:text-text-primary',
        'focus-visible:outline-none focus-visible:text-near-green-500'
      )}
    >
      {children}
    </Link>
  );
}
