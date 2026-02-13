'use client';

import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CredentialEmptyStateProps {
  onGenerate: () => void;
}

export function CredentialEmptyState({ onGenerate }: CredentialEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-near-green-500/10 animate-ping" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-near-green-500/10 border border-near-green-500/20">
          <Shield className="h-8 w-8 text-near-green-500" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-text-primary mb-2">
        No Credentials Yet
      </h3>
      <p className="text-sm text-text-muted max-w-sm mb-6">
        Generate privacy-preserving ZK credentials to prove your on-chain
        activity, grant history, or team endorsements — without revealing
        sensitive details.
      </p>

      <Button onClick={onGenerate}>
        Generate Your First Credential
      </Button>
    </div>
  );
}
