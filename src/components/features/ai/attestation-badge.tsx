'use client';

import { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useAttestation } from '@/hooks/use-attestation';
import { verifyAttestation } from '@/lib/ai/attestation';
import type { NEARAIAttestation } from '@/types/ai';
import { AttestationDetails } from '@/components/features/attestation';

export interface AttestationBadgeProps {
  /** The attestation data to display */
  attestation: NEARAIAttestation;
  /**
   * Use enhanced view with detailed verification steps.
   * When true, uses the new AttestationDetails component in the dialog.
   * @default false
   */
  useEnhancedView?: boolean;
}

/**
 * Displays TEE attestation status with detailed verification dialog.
 * Shows a badge indicating whether the AI response was processed
 * in a Trusted Execution Environment.
 *
 * @example
 * ```tsx
 * // Basic usage (legacy view)
 * <AttestationBadge attestation={message.attestation} />
 *
 * // Enhanced view with verification steps
 * <AttestationBadge attestation={message.attestation} useEnhancedView />
 * ```
 */
export function AttestationBadge({
  attestation,
  useEnhancedView = false,
}: AttestationBadgeProps) {
  const [copied, setCopied] = useState(false);
  const { getDescription, getBadge, getVerificationUrl } =
    useAttestation();

  // Verify as a pure computation — NOT via the hook's verify() which calls
  // setState and would cause an infinite re-render loop when called during render.
  const result = useMemo(
    () => verifyAttestation(attestation),
    [attestation]
  );
  const badge = getBadge(result);
  const teeInfo = getDescription(attestation.tee_type);
  const verificationUrl = getVerificationUrl(attestation);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = () => {
    switch (badge.icon) {
      case 'check':
        return <ShieldCheck className="h-3 w-3" />;
      case 'alert':
        return <ShieldAlert className="h-3 w-3" />;
      case 'x':
        return <ShieldX className="h-3 w-3" />;
      default:
        return <ShieldQuestion className="h-3 w-3" />;
    }
  };

  const getBadgeVariant = () => {
    switch (badge.color) {
      case 'green':
        return 'success';
      case 'yellow':
        return 'warning';
      case 'red':
        return 'error';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Badge
                variant={getBadgeVariant()}
                className="cursor-pointer gap-1 text-[10px] px-1.5 py-0.5"
              >
                {getIcon()}
                <span className="hidden sm:inline">TEE</span>
              </Badge>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {result.isValid
                ? `Verified ${teeInfo.name} attestation`
                : 'Click to view attestation details'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-near-green-500" />
            TEE Attestation Details
          </DialogTitle>
          <DialogDescription>
            This response was processed in a Trusted Execution Environment
          </DialogDescription>
        </DialogHeader>

        {useEnhancedView ? (
          /* Enhanced view with AttestationDetails component */
          <AttestationDetails
            attestation={attestation}
            autoVerify
            fullVerification={false}
          />
        ) : (
          /* Legacy view */
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
              <span className="text-sm text-text-muted">Status</span>
              <Badge variant={getBadgeVariant()} className="gap-1">
                {getIcon()}
                {badge.label}
              </Badge>
            </div>

            {/* TEE Type */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-primary">
                TEE Environment
              </h4>
              <div className="p-3 rounded-lg bg-surface space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">Type</span>
                  <span className="text-sm font-medium">{teeInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">Provider</span>
                  <span className="text-sm">{teeInfo.provider}</span>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {teeInfo.description}
                </p>
              </div>
            </div>

            {/* Attestation Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-primary">
                Attestation Data
              </h4>
              <div className="p-3 rounded-lg bg-surface space-y-2 text-xs font-mono">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted shrink-0">Enclave ID:</span>
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[200px]">
                      {attestation.enclave_id}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => handleCopy(attestation.enclave_id)}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted shrink-0">Code Hash:</span>
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[200px]">
                      {attestation.code_hash}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => handleCopy(attestation.code_hash)}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Timestamp:</span>
                  <span>
                    {new Date(attestation.timestamp).toLocaleString()}
                  </span>
                </div>
                {attestation.version && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Version:</span>
                    <span>{attestation.version}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <h4 className="text-sm font-medium text-warning mb-1">
                  Warnings
                </h4>
                <ul className="text-xs text-text-muted space-y-1">
                  {result.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* External verification */}
            {verificationUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(verificationUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Verify Externally
              </Button>
            )}

            <p className="text-xs text-text-muted text-center">
              TEE attestations prove that AI inference ran in a secure,
              privacy-preserving environment where your data cannot be accessed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
