'use client';

import { useState } from 'react';
import {
  Bot,
  MoreVertical,
  ShieldCheck,
  Play,
  Power,
  ExternalLink,
  Activity,
  XCircle,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import type { AgentInstance } from '@/types/agents';
import type { KeyHealth } from '@/lib/agents/key-lifecycle';
import { CapabilityViewer } from './capability-viewer';
import { config } from '@/lib/config';

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { variant: BadgeProps['variant']; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  paused: { variant: 'warning', label: 'Paused' },
  deactivated: { variant: 'error', label: 'Deactivated' },
};

// ---------------------------------------------------------------------------
// Key health indicator
// ---------------------------------------------------------------------------

function getKeyHealthColor(health: { owner: KeyHealth; execution: KeyHealth } | null): {
  color: string;
  label: string;
} {
  if (!health) return { color: 'bg-text-muted', label: 'Unknown' };

  const hasExpired = health.owner.status === 'expired' || health.execution.status === 'expired';
  const hasMissing = health.owner.status === 'missing' || health.execution.status === 'missing';
  const hasExpiringSoon = health.owner.status === 'expiring-soon' || health.execution.status === 'expiring-soon';

  if (hasExpired || hasMissing) return { color: 'bg-error', label: 'Keys expired' };
  if (hasExpiringSoon) return { color: 'bg-warning', label: 'Keys expiring soon' };
  return { color: 'bg-success', label: 'Keys valid' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: AgentInstance;
  keyHealth?: { owner: KeyHealth; execution: KeyHealth } | null;
  isInvoking?: boolean;
  onVerify: (accountId: string) => void;
  onInvoke: (accountId: string) => void;
  onCancelInvocation?: () => void;
  onDeactivate: (accountId: string) => void;
  onSelect: (accountId: string) => void;
}

export function AgentCard({
  agent,
  keyHealth,
  isInvoking,
  onVerify,
  onInvoke,
  onCancelInvocation,
  onDeactivate,
  onSelect,
}: AgentCardProps) {
  const [showActions, setShowActions] = useState(false);
  const statusDisplay = STATUS_BADGE[agent.status] ?? STATUS_BADGE.active!;
  const explorerUrl = `${config.near.explorerUrl}/address/${agent.accountId}`;
  const keyIndicator = getKeyHealthColor(keyHealth ?? null);

  return (
    <div
      className="rounded-lg border border-border bg-surface p-4 space-y-3 hover:border-border/80 transition-colors cursor-pointer"
      onClick={() => onSelect(agent.accountId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(agent.accountId);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-md bg-surface-hover flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-text-muted" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-text-primary truncate">
              {agent.name}
            </h3>
            <p className="text-xs text-text-muted font-mono truncate">
              {agent.accountId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Key health indicator dot */}
          {keyHealth && (
            <span
              className={`h-2 w-2 rounded-full ${keyIndicator.color} shrink-0`}
              title={keyIndicator.label}
            />
          )}
          <Badge variant={statusDisplay.variant} className="text-[10px]">
            {statusDisplay.label}
          </Badge>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {showActions && (
              <div
                className="absolute right-0 top-8 z-10 w-44 rounded-md border border-border bg-surface shadow-lg py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-hover flex items-center gap-2"
                  onClick={() => {
                    onVerify(agent.accountId);
                    setShowActions(false);
                  }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  Verify
                </button>
                {agent.status === 'active' && !isInvoking && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-hover flex items-center gap-2"
                    onClick={() => {
                      onInvoke(agent.accountId);
                      setShowActions(false);
                    }}
                  >
                    <Play className="h-3 w-3" />
                    Invoke
                  </button>
                )}
                {isInvoking && onCancelInvocation && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs text-warning hover:bg-surface-hover flex items-center gap-2"
                    onClick={() => {
                      onCancelInvocation();
                      setShowActions(false);
                    }}
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel Invocation
                  </button>
                )}
                {keyHealth && (keyHealth.owner.status === 'expiring-soon' || keyHealth.execution.status === 'expiring-soon') && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs text-warning hover:bg-surface-hover flex items-center gap-2"
                    onClick={() => setShowActions(false)}
                  >
                    <KeyRound className="h-3 w-3" />
                    Rotate Keys
                  </button>
                )}
                {agent.status !== 'deactivated' && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs text-error hover:bg-surface-hover flex items-center gap-2"
                    onClick={() => {
                      onDeactivate(agent.accountId);
                      setShowActions(false);
                    }}
                  >
                    <Power className="h-3 w-3" />
                    Deactivate
                  </button>
                )}
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-surface-hover flex items-center gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Explorer
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <CapabilityViewer capabilities={agent.capabilities} compact />

      <div className="flex items-center gap-4 text-xs text-text-muted pt-1 border-t border-border">
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {agent.invocationCount} invocations
        </span>
        {agent.lastActiveAt && (
          <span>
            Last active: {new Date(agent.lastActiveAt).toLocaleDateString()}
          </span>
        )}
        {agent.lastAttestation?.verified && (
          <Badge variant="success" className="text-[10px]">
            <ShieldCheck className="h-3 w-3 mr-0.5" />
            Verified
          </Badge>
        )}
      </div>
    </div>
  );
}
