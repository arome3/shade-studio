'use client';

import { Bot, Download, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgentTemplate } from '@/types/agents';
import { CapabilityViewer } from './capability-viewer';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: AgentTemplate;
  onDeploy: (templateId: string) => void;
}

export function TemplateCard({ template, onDeploy }: TemplateCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-md bg-surface-hover flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-text-muted" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-text-primary truncate">
              {template.name}
            </h3>
            <p className="text-xs text-text-muted truncate">
              by {template.creator}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px]">
            v{template.version}
          </Badge>
          {template.isAudited && (
            <Badge variant="success" className="text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-0.5" />
              Audited
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted line-clamp-2">
        {template.description}
      </p>

      <CapabilityViewer capabilities={template.capabilities} compact />

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {template.deployments}
          </span>
          {template.sourceUrl && (
            <a
              href={template.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onDeploy(template.id)}
          className="text-xs"
        >
          Deploy
        </Button>
      </div>
    </div>
  );
}
