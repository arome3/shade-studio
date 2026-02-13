'use client';

import { useState, useCallback } from 'react';
import { Plus, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCredentials } from '@/hooks/use-credentials';
import { CredentialStatsBar } from './credential-stats';
import { CredentialFilterBar } from './credential-filter-bar';
import { CredentialCard } from './credential-card';
import { CredentialEmptyState } from './credential-empty-state';
import { CredentialSkeleton } from './credential-skeleton';
import { ProofGenerationDialog } from './proof-generation-dialog';
import { StoreOnChainDialog } from './store-on-chain-dialog';
import { ShareCredentialDialog } from './share-credential-dialog';
import { CredentialDetailDialog } from './credential-detail-dialog';
import type { UICredential } from '@/types/credentials';

// ============================================================================
// Component
// ============================================================================

export function CredentialsDashboard() {
  const {
    credentials,
    stats,
    isFetching,
    error,
    isConnected,
    accountId,
    filter,
    setFilter,
    storeOnChain,
    removeCredential,
    getStorageCost,
    clearError,
    retryLastAction,
    proofOperation,
    zkProof,
  } = useCredentials();

  // Dialog state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<UICredential | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Tab-filtered credentials
  const tabCredentials = credentials.filter((c) => {
    if (activeTab === 'local') return c.source === 'local';
    if (activeTab === 'on-chain') return c.source === 'on-chain';
    return true;
  });

  // Handlers
  const handleView = useCallback((cred: UICredential) => {
    setSelectedCredential(cred);
    setDetailOpen(true);
  }, []);

  const handleStoreOnChain = useCallback((cred: UICredential) => {
    setSelectedCredential(cred);
    setStoreOpen(true);
  }, []);

  const handleShare = useCallback((cred: UICredential) => {
    setSelectedCredential(cred);
    setShareOpen(true);
  }, []);

  const handleRemoveClick = useCallback((cred: UICredential) => {
    setSelectedCredential(cred);
    setDeleteOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!selectedCredential) return;
    removeCredential(selectedCredential.id, selectedCredential.source);
  }, [selectedCredential, removeCredential]);

  const handleStoreFromGenerate = useCallback(
    (proofId: string) => {
      const cred = credentials.find((c) => c.id === proofId);
      if (cred) {
        setSelectedCredential(cred);
        setStoreOpen(true);
      }
    },
    [credentials]
  );

  // -------------------------------------------------------------------------
  // Guard cascade
  // -------------------------------------------------------------------------

  // 1. Not connected
  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Wallet className="h-12 w-12 text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-sm text-text-muted text-center max-w-sm">
            Connect your NEAR wallet to manage your ZK credentials.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 2. Loading with no data
  if (isFetching && credentials.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 rounded-lg p-6 mb-6 -mx-6 -mt-6">
            <div className="animate-pulse h-6 w-40 bg-surface-hover rounded mb-2" />
            <div className="animate-pulse h-4 w-64 bg-surface-hover rounded" />
          </div>
          <CredentialSkeleton />
        </CardContent>
      </Card>
    );
  }

  // 3. Error with no data
  if (error && credentials.length === 0) {
    const isPaused = error.includes('paused');
    const isNetwork = error.includes('Network error');

    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-error mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {isPaused ? 'Contract Paused' : 'Something went wrong'}
          </h3>
          <p className="text-sm text-text-muted text-center max-w-sm mb-4">
            {error}
          </p>
          <div className="flex gap-2">
            {clearError && (
              <Button variant="ghost" onClick={clearError}>
                Dismiss
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                clearError();
                retryLastAction();
              }}
            >
              {isPaused ? 'Check Status' : isNetwork ? 'Retry Connection' : 'Retry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Full dashboard
  // -------------------------------------------------------------------------

  return (
    <>
      <Card>
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 rounded-t-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                ZK Credentials
              </h2>
              <p className="text-sm text-text-muted mt-1">
                Privacy-preserving proofs of your on-chain activity
              </p>
            </div>
            <Button onClick={() => setGenerateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Credential
            </Button>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Stats */}
          <CredentialStatsBar stats={stats} />

          {/* Tabs + Filters */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="local">Local</TabsTrigger>
                <TabsTrigger value="on-chain">On-Chain</TabsTrigger>
              </TabsList>

              <CredentialFilterBar
                filter={filter}
                onFilterChange={setFilter}
              />
            </div>

            <TabsContent value={activeTab}>
              {tabCredentials.length === 0 ? (
                <CredentialEmptyState onGenerate={() => setGenerateOpen(true)} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {tabCredentials.map((cred) => (
                    <CredentialCard
                      key={cred.id}
                      credential={cred}
                      onView={handleView}
                      onStoreOnChain={handleStoreOnChain}
                      onShare={handleShare}
                      onRemove={handleRemoveClick}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ProofGenerationDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        zkProof={zkProof}
        proofOperation={proofOperation}
        onStoreOnChain={handleStoreFromGenerate}
        accountId={accountId}
      />

      <StoreOnChainDialog
        open={storeOpen}
        onOpenChange={setStoreOpen}
        credential={selectedCredential}
        onStore={storeOnChain}
        getStorageCost={getStorageCost}
      />

      <ShareCredentialDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        credential={selectedCredential}
      />

      <CredentialDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        credential={selectedCredential}
        onStoreOnChain={handleStoreOnChain}
        onVerifyLocally={(proofId) => {
          zkProof.verifyProof(proofId);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove Credential"
        description={
          selectedCredential?.source === 'on-chain'
            ? 'This will remove the credential from the NEAR blockchain. This action requires a transaction.'
            : 'This will remove the local proof. This action cannot be undone.'
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmRemove}
      />
    </>
  );
}
