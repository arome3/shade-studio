'use client';

import { useState } from 'react';
import {
  Shield,
  Lock,
  EyeOff,
  Cpu,
  FileCheck,
  ChevronDown,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils/cn';
import {
  TEE_INFO,
  TEE_BENEFITS,
  SECURITY_LEVEL_DESCRIPTIONS,
} from '@/lib/attestation/constants';
import type { TEEType, SecurityLevel } from '@/types/attestation';

export interface TEEExplainerProps {
  /** TEE type to highlight (optional) */
  highlightType?: TEEType;
  /** Use compact collapsible mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon component for benefit
 */
function getBenefitIcon(iconName: string) {
  const iconClass = 'h-5 w-5 text-near-green-500';
  switch (iconName) {
    case 'Lock':
      return <Lock className={iconClass} />;
    case 'EyeOff':
      return <EyeOff className={iconClass} />;
    case 'Cpu':
      return <Cpu className={iconClass} />;
    case 'FileCheck':
      return <FileCheck className={iconClass} />;
    default:
      return <Shield className={iconClass} />;
  }
}

/**
 * Benefit card component
 */
function BenefitCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border hover:border-near-green-500/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-near-green-500/10">
          {getBenefitIcon(icon)}
        </div>
        <div>
          <h4 className="text-sm font-medium text-text-primary">{title}</h4>
          <p className="text-xs text-text-muted mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * TEE type card component
 */
function TEETypeCard({
  type,
  isHighlighted,
}: {
  type: TEEType;
  isHighlighted: boolean;
}) {
  const info = TEE_INFO[type];
  if (!info || type === 'unknown') return null;

  const securityPercent = (info.securityLevel / 5) * 100;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        isHighlighted
          ? 'bg-near-green-500/10 border-near-green-500/50'
          : 'bg-surface border-border'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-text-primary">{info.name}</h4>
          <span className="text-xs text-text-muted">{info.provider}</span>
        </div>
        <span className="text-xs text-text-muted">
          Level {info.securityLevel}/5
        </span>
      </div>
      <Progress value={securityPercent} className="h-1.5 mb-2" />
      {info.documentationUrl && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs p-0 text-text-muted hover:text-near-green-500"
          onClick={() => window.open(info.documentationUrl, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Learn more
        </Button>
      )}
    </div>
  );
}

/**
 * Educational component explaining Trusted Execution Environments.
 *
 * Features:
 * - Compact mode (collapsible "What is TEE?")
 * - Full mode with benefits grid
 * - Supported TEE technologies with security levels
 * - Optional highlighting of a specific TEE type
 *
 * @example
 * ```tsx
 * // Compact collapsible mode
 * <TEEExplainer compact />
 *
 * // Full mode with highlighted type
 * <TEEExplainer highlightType="intel-tdx" />
 * ```
 */
export function TEEExplainer({
  highlightType,
  compact = false,
  className,
}: TEEExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Ordered TEE types for display (excluding 'unknown')
  const orderedTypes: TEEType[] = [
    'intel-tdx',
    'amd-sev-snp',
    'intel-sgx',
    'arm-cca',
    'nvidia-cc',
    'amd-sev',
  ];

  const content = (
    <div className="space-y-4">
      {/* Introduction */}
      <div className="text-sm text-text-secondary leading-relaxed">
        <p>
          <strong className="text-text-primary">Trusted Execution Environments (TEEs)</strong> are
          secure areas within processors that protect your data during computation. When AI inference
          runs inside a TEE, your prompts and responses remain encrypted and inaccessible to anyone—
          including cloud operators and potential attackers.
        </p>
      </div>

      {/* Benefits Grid */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Key Benefits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEE_BENEFITS.map((benefit) => (
            <BenefitCard
              key={benefit.id}
              title={benefit.title}
              description={benefit.description}
              icon={benefit.icon}
            />
          ))}
        </div>
      </div>

      {/* Supported Technologies */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Supported Technologies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {orderedTypes.map((type) => (
            <TEETypeCard
              key={type}
              type={type}
              isHighlighted={type === highlightType}
            />
          ))}
        </div>
      </div>

      {/* Security Level Legend */}
      <div className="p-3 rounded-lg bg-surface/50 border border-border">
        <h4 className="text-xs font-medium text-text-primary mb-2">Security Level Guide</h4>
        <div className="space-y-1">
          {([5, 4, 3, 2, 1] as SecurityLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-2 text-xs">
              <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full bg-near-green-500 rounded-full"
                  style={{ width: `${(level / 5) * 100}%` }}
                />
              </div>
              <span className="text-text-muted">
                {level}: {SECURITY_LEVEL_DESCRIPTIONS[level]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2 px-3 hover:bg-surface"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-near-green-500" />
              <span className="text-sm">What is a TEE?</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-text-muted transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 px-1">
          {content}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-near-green-500" />
        <h2 className="text-lg font-semibold text-text-primary">
          Understanding TEE Security
        </h2>
      </div>
      {content}
    </div>
  );
}

/**
 * Mini TEE explainer for tooltips or small spaces
 */
export function TEEExplainerMini({ className }: { className?: string }) {
  return (
    <div className={cn('text-xs text-text-muted space-y-2', className)}>
      <p>
        <strong className="text-text-primary">TEE (Trusted Execution Environment)</strong> is
        hardware-based security that protects your data during AI processing.
      </p>
      <ul className="space-y-1">
        <li className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-near-green-500" />
          Data encrypted in memory
        </li>
        <li className="flex items-center gap-1.5">
          <EyeOff className="h-3 w-3 text-near-green-500" />
          Hidden from cloud operators
        </li>
        <li className="flex items-center gap-1.5">
          <FileCheck className="h-3 w-3 text-near-green-500" />
          Cryptographically verified
        </li>
      </ul>
    </div>
  );
}
