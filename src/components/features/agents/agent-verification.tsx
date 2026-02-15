'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Shield, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgentVerificationResult, CodehashAttestation } from '@/types/agents';

// ---------------------------------------------------------------------------
// Verification level display
// ---------------------------------------------------------------------------

type VerificationLevel = 'full' | 'structural' | 'none' | undefined;

function getVerificationDisplay(level: VerificationLevel, isVerified?: boolean) {
  if (level === 'full') {
    return {
      Icon: ShieldCheck,
      color: 'text-success',
      label: 'Fully Verified',
      variant: 'success' as const,
      description: 'Server-side cryptographic verification passed',
    };
  }
  if (level === 'structural') {
    return {
      Icon: Shield,
      color: 'text-warning',
      label: 'Structurally Verified',
      variant: 'warning' as const,
      description: 'Client-side validation only — signature not cryptographically verified',
    };
  }
  if (isVerified) {
    return {
      Icon: ShieldCheck,
      color: 'text-success',
      label: 'Verified',
      variant: 'success' as const,
      description: 'Codehash matches registry',
    };
  }
  return {
    Icon: ShieldAlert,
    color: 'text-warning',
    label: 'Unverified',
    variant: 'warning' as const,
    description: 'Verification not yet performed',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentVerificationProps {
  codehash: string;
  sourceUrl?: string;
  isAudited?: boolean;
  lastAttestation?: CodehashAttestation;
  onVerify: () => Promise<AgentVerificationResult | null>;
}

export function AgentVerification({
  codehash,
  sourceUrl,
  isAudited,
  lastAttestation,
  onVerify,
}: AgentVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<AgentVerificationResult | null>(null);
  const [verificationLevel, setVerificationLevel] = useState<VerificationLevel>(undefined);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await onVerify();
      setResult(res);
      // Determine verification level from the response
      if (res?.valid) {
        // If the result came back from our enhanced verification, it may have a level
        // For now, mark as structural since verifyAgent uses on-chain verification
        setVerificationLevel('structural');
      } else {
        setVerificationLevel('none');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const verified = result?.valid ?? lastAttestation?.verified;
  const display = getVerificationDisplay(verificationLevel, verified);
  const { Icon: StatusIcon, color: statusColor } = display;

  return (
    <div className="space-y-3 p-4 rounded-lg bg-surface border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
          <h4 className="text-sm font-medium text-text-primary">
            Code Verification
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {isAudited && (
            <Badge variant="success" className="text-xs">
              Audited
            </Badge>
          )}
          {verificationLevel && (
            <Badge variant={display.variant} className="text-xs">
              {display.label}
            </Badge>
          )}
          {!verificationLevel && verified !== undefined && (
            <Badge variant={verified ? 'success' : 'warning'} className="text-xs">
              {verified ? 'Verified' : 'Unverified'}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs text-text-muted">Codehash (SHA-256)</p>
          <p className="text-xs font-mono text-text-primary break-all mt-0.5">
            {codehash}
          </p>
        </div>

        {verificationLevel && (
          <p className="text-xs text-text-muted">{display.description}</p>
        )}

        {result && !result.valid && result.reason && (
          <p className="text-xs text-error">{result.reason}</p>
        )}

        {lastAttestation && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-text-muted mb-1">TEE Attestation</p>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {lastAttestation.teeType}
              </Badge>
              <span className="text-text-muted">
                {new Date(lastAttestation.timestamp).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={isVerifying}
          className="text-xs"
        >
          {isVerifying ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          {isVerifying ? 'Verifying...' : 'Re-verify'}
        </Button>

        {sourceUrl && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Source
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
