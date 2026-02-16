'use client';

import { useAccountId } from '@/stores/auth-store';
import { DocumentManager } from './document-manager';

export function DocumentVaultDashboard() {
  const accountId = useAccountId();

  if (!accountId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted">Loading account...</p>
      </div>
    );
  }

  return <DocumentManager projectId={accountId} title="Document Vault" />;
}
