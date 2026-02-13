'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Mail, Link as LinkIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import type { UICredential } from '@/types/credentials';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildShareUrl(credential: UICredential): string {
  const params = new URLSearchParams({
    circuit: credential.circuit,
    id: credential.id,
    source: credential.source,
  });
  if (credential.claim) {
    params.set('claim', credential.claim);
  }
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/credentials/verify?${params.toString()}`;
}

function buildEmailBody(credential: UICredential, url: string): string {
  const circuitName = credential.circuit
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return encodeURIComponent(
    `I'd like to share my ZK credential with you.\n\n` +
      `Type: ${circuitName}\n` +
      (credential.claim ? `Claim: ${credential.claim}\n` : '') +
      `\nVerify here: ${url}\n\n` +
      `This credential was generated using zero-knowledge proofs — ` +
      `only the public claim is visible; no private data is shared.`
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ShareCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: UICredential | null;
}

export function ShareCredentialDialog({
  open,
  onOpenChange,
  credential,
}: ShareCredentialDialogProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = credential ? buildShareUrl(credential) : '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op, user can manually copy from input
    }
  }, [shareUrl]);

  if (!credential) return null;

  const emailSubject = encodeURIComponent('ZK Credential Verification');
  const emailBody = buildEmailBody(credential, shareUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Share Credential</DialogTitle>
          <DialogDescription>
            Share your ZK credential for verification. Only public claims are
            shared — no private data is revealed.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              <LinkIcon className="h-4 w-4 mr-1.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex-1">
              QR Code
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="h-4 w-4 mr-1.5" />
              Email
            </TabsTrigger>
          </TabsList>

          {/* Link tab */}
          <TabsContent value="link" className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-near-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>

          {/* QR tab */}
          <TabsContent value="qr" className="flex justify-center pt-4 pb-2">
            {/* QR codes require a white background for reliable scanning */}
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          </TabsContent>

          {/* Email tab */}
          <TabsContent value="email" className="pt-2">
            <Button
              variant="secondary"
              className="w-full"
              asChild
            >
              <a
                href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="h-4 w-4 mr-2" />
                Open Email Client
              </a>
            </Button>
          </TabsContent>
        </Tabs>

        {/* Privacy note */}
        <p className="text-xs text-text-muted border-t border-border pt-3">
          Only your public claim and verification link are shared. Your private
          data (activity dates, grant details, attester identities) remains
          hidden by the zero-knowledge proof.
        </p>
      </DialogContent>
    </Dialog>
  );
}
