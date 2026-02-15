'use client';

import { Bot } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { AgentInstance } from '@/types/agents';
import { AGENT_STATUS_DISPLAY } from '@/types/agents';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentSelectorProps {
  agents: AgentInstance[];
  activeAgentId: string | null;
  onSelect: (accountId: string | null) => void;
}

export function AgentSelector({ agents, activeAgentId, onSelect }: AgentSelectorProps) {
  const activeAgents = agents.filter((a) => a.status === 'active');

  if (activeAgents.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface border border-border text-sm text-text-muted">
        <Bot className="h-4 w-4" />
        <span>No active agents</span>
      </div>
    );
  }

  return (
    <Select
      value={activeAgentId ?? ''}
      onValueChange={(value) => onSelect(value || null)}
    >
      <SelectTrigger className="w-[240px]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-text-muted" />
          <SelectValue placeholder="Select an agent" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {activeAgents.map((agent) => {
          const display = AGENT_STATUS_DISPLAY[agent.status];
          return (
            <SelectItem key={agent.accountId} value={agent.accountId}>
              <div className="flex items-center gap-2">
                <span className="truncate">{agent.name}</span>
                <Badge variant={display.variant} className="text-[10px]">
                  {display.label}
                </Badge>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
