'use client';

import { useEffect } from 'react';
import {
  Shield,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Cpu,
  Hash,
  FileCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils/cn';
import { useAttestationEnhanced } from '@/hooks/use-attestation-enhanced';
import { VerificationStatus } from './verification-status';
import { SECURITY_LEVEL_DESCRIPTIONS } from '@/lib/attestation/constants';
import type {
  TEEAttestation,
  NEARAIAttestation,
  VerificationStep,
  VerificationStepStatus,
  SecurityLevel,
} from '@/types/attestation';
import { getExternalVerificationUrl, formatHash } from '@/lib/attestation';

export interface AttestationDetailsProps {
  /** Attestation data to display and verify */
  attestation: TEEAttestation | NEARAIAttestation;
  /** Automatically start verification on mount */
  autoVerify?: boolean;
  /** Include remote verification step */
  fullVerification?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon for verification step status
 */
function getStepIcon(status: VerificationStepStatus) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-error" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-near-green-500 animate-spin" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-text-muted" />;
    case 'pending':
    default:
      return <Circle className="h-4 w-4 text-text-muted" />;
  }
}

/**
 * Verification step row component
 */
function VerificationStepRow({ step }: { step: VerificationStep }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">{getStepIcon(step.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">{step.name}</span>
          {step.durationMs !== undefined && (
            <span className="text-xs text-text-muted">{step.durationMs}ms</span>
          )}
        </div>
        {step.message && (
          <p className="text-xs text-text-muted mt-0.5">{step.message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Comprehensive attestation details view with verification.
 *
 * Features:
 * - Header with TEE type and verification badge
 * - Basic info grid (timestamp, enclave ID, code hash)
 * - TEE description with security level
 * - Verification steps accordion
 * - Errors/warnings display
 * - External verification link
 *
 * @example
 * ```tsx
 * <AttestationDetails
 *   attestation={message.attestation}
 *   autoVerify
 *   fullVerification
 * />
 * ```
 */
export function AttestationDetails({
  attestation,
  autoVerify = true,
  fullVerification = false,
  className,
}: AttestationDetailsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const {
    result,
    steps,
    isVerifying,
    verify,
    getInfo,
  } = useAttestationEnhanced();

  // Auto-verify on mount if enabled
  useEffect(() => {
    if (autoVerify && attestation) {
      verify(attestation, { includeRemoteVerification: fullVerification });
    }
  }, [attestation, autoVerify, fullVerification, verify]);

  const teeInfo = getInfo(attestation.tee_type);
  const verificationUrl = getExternalVerificationUrl(attestation as TEEAttestation);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const securityLevelPercent = (teeInfo.securityLevel / 5) * 100;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-near-green-500" />
          <h3 className="text-lg font-semibold text-text-primary">{teeInfo.name}</h3>
        </div>
        <VerificationStatus
          result={result}
          isVerifying={isVerifying}
          showLabel
          size="md"
        />
      </div>

      {/* TEE Description */}
      <div className="p-3 rounded-lg bg-surface">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">Security Level</span>
          <span className="text-xs text-text-muted">
            {SECURITY_LEVEL_DESCRIPTIONS[teeInfo.securityLevel as SecurityLevel]}
          </span>
        </div>
        <Progress value={securityLevelPercent} className="h-2" />
        <p className="text-xs text-text-muted mt-3">{teeInfo.description}</p>
      </div>

      {/* Basic Info Grid */}
      <div className="grid grid-cols-1 gap-2">
        <InfoRow
          icon={<Clock className="h-4 w-4" />}
          label="Timestamp"
          value={new Date(attestation.timestamp).toLocaleString()}
        />
        <InfoRow
          icon={<Cpu className="h-4 w-4" />}
          label="Enclave ID"
          value={formatHash(attestation.enclave_id, 12)}
          fullValue={attestation.enclave_id}
          onCopy={() => handleCopy(attestation.enclave_id, 'enclave')}
          isCopied={copied === 'enclave'}
        />
        <InfoRow
          icon={<Hash className="h-4 w-4" />}
          label="Code Hash"
          value={formatHash(attestation.code_hash, 12)}
          fullValue={attestation.code_hash}
          onCopy={() => handleCopy(attestation.code_hash, 'hash')}
          isCopied={copied === 'hash'}
        />
        {attestation.version && (
          <InfoRow
            icon={<FileCheck className="h-4 w-4" />}
            label="Version"
            value={attestation.version}
          />
        )}
      </div>

      {/* Verification Steps Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="steps" className="border-border">
          <AccordionTrigger className="text-sm hover:no-underline">
            <div className="flex items-center gap-2">
              <span>Verification Steps</span>
              {steps.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {steps.filter((s) => s.status === 'passed').length}/{steps.length}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-1 pt-2">
              {steps.length > 0 ? (
                steps.map((step) => (
                  <VerificationStepRow key={step.id} step={step} />
                ))
              ) : (
                <p className="text-sm text-text-muted py-2">
                  {isVerifying ? 'Starting verification...' : 'Click verify to see steps'}
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Errors */}
      {result?.errors && result.errors.length > 0 && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/20">
          <h4 className="text-sm font-medium text-error mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Errors
          </h4>
          <ul className="space-y-1">
            {result.errors.map((error, i) => (
              <li key={i} className="text-xs text-text-muted">
                <span className="font-mono text-error">[{error.code}]</span> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result?.warnings && result.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <h4 className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Warnings
          </h4>
          <ul className="space-y-1">
            {result.warnings.map((warning, i) => (
              <li key={i} className="text-xs text-text-muted">
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!autoVerify && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => verify(attestation, { includeRemoteVerification: fullVerification })}
            disabled={isVerifying}
            className="flex-1"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
        )}
        {verificationUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(verificationUrl, '_blank')}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Verify Externally
          </Button>
        )}
      </div>

      {/* Cache indicator */}
      {result?.fromCache && (
        <p className="text-[10px] text-text-muted text-center">
          Result from cache (verified {new Date(result.verifiedAt).toLocaleTimeString()})
        </p>
      )}
    </div>
  );
}

/**
 * Info row component for displaying attestation fields
 */
function InfoRow({
  icon,
  label,
  value,
  fullValue,
  onCopy,
  isCopied,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  isCopied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-surface/50">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-text-primary">{value}</span>
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onCopy}
            title={fullValue ? `Copy: ${fullValue}` : 'Copy'}
          >
            {isCopied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
