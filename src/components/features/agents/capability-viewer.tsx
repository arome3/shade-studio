'use client';

import { Shield, FileText, FilePen, MessageSquare, Brain, Search, Send, Download, Upload, Eye, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AgentCapability, AgentPermission } from '@/types/agents';
import { CAPABILITY_LABELS } from '@/types/agents';
import { getCapabilityConfig } from '@/lib/agents/capabilities';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  FilePen,
  MessageSquare,
  Brain,
  Search,
  Send,
  Download,
  Upload,
  Eye,
  Pencil,
};

const RISK_VARIANT: Record<string, 'default' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CapabilityViewerProps {
  capabilities: AgentCapability[];
  permissions?: AgentPermission[];
  compact?: boolean;
}

export function CapabilityViewer({ capabilities, permissions, compact }: CapabilityViewerProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {capabilities.map((cap) => (
          <Badge key={cap} variant="secondary" className="text-xs">
            {CAPABILITY_LABELS[cap]}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-2">Capabilities</h4>
        <div className="grid grid-cols-2 gap-2">
          {capabilities.map((cap) => {
            const cfg = getCapabilityConfig(cap);
            const Icon = ICON_MAP[cfg.icon] ?? Shield;
            return (
              <div
                key={cap}
                className="flex items-center gap-2 p-2 rounded-md bg-surface border border-border"
              >
                <Icon className="h-4 w-4 text-text-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{cfg.label}</p>
                  <Badge variant={RISK_VARIANT[cfg.risk] ?? 'default'} className="text-[10px] mt-0.5">
                    {cfg.risk} risk
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {permissions && permissions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text-primary mb-2">
            Required Permissions
          </h4>
          <div className="space-y-2">
            {permissions.map((perm, i) => (
              <div
                key={`${perm.receiverId}-${i}`}
                className="p-2 rounded-md bg-surface border border-border text-sm"
              >
                <p className="text-text-primary font-mono text-xs truncate">
                  {perm.receiverId}
                </p>
                <p className="text-text-muted text-xs mt-1">{perm.purpose}</p>
                {perm.methodNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {perm.methodNames.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] font-mono">
                        {m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
