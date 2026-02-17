'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  AlertCircle,
  Download,
  Database,
  HardDrive,
  ShieldCheck,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDataSovereignty } from '@/hooks/use-data-sovereignty';
import { formatBytes } from '@/lib/utils/format';
import { StorageChart } from './storage-chart';
import { EncryptionOverview } from './encryption-overview';
import { DataInventory } from './data-inventory';
import { ActivityLog } from './activity-log';
import { PrivacySettingsPanel } from './privacy-settings';
import { ExportDialog } from './export-dialog';
import { DeleteDialog } from './delete-dialog';
import { CredentialsDashboard } from '@/components/features/credentials';

// ============================================================================
// Component
// ============================================================================

export function SovereigntyDashboard() {
  const {
    dataItems,
    filteredItems,
    storageSummary,
    encryptionSummary,
    stats,
    activities,
    isConnected,
    isLoading,
    error,
    searchQuery,
    categoryFilter,
    locationFilter,
    selectedItemIds,
    exportStatus,
    exportError,
    exportProgress,
    deleteResult,
    exportData,
    deleteSelectedItems,
    clearActivities,
    retry,
    setSearchQuery,
    setCategoryFilter,
    setLocationFilter,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    privacySettings,
    updatePrivacySetting,
  } = useDataSovereignty();

  // Dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Items selected for deletion
  const selectedItems = dataItems.filter((item) =>
    selectedItemIds.includes(item.id)
  );

  const handleExportAll = useCallback(() => {
    setExportOpen(true);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.length > 0) {
      setDeleteOpen(true);
    }
  }, [selectedItemIds]);

  const handleConfirmDelete = useCallback(async () => {
    return await deleteSelectedItems();
  }, [deleteSelectedItems]);

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
            Connect your NEAR wallet to view and manage your data sovereignty settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 2. Loading with no data
  if (isLoading && dataItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-gradient-to-r from-near-green-500/10 via-near-cyan-500/10 to-near-purple-500/10 rounded-lg p-6 mb-6 -mx-6 -mt-6">
            <div className="animate-pulse h-6 w-48 bg-surface-hover rounded mb-2" />
            <div className="animate-pulse h-4 w-72 bg-surface-hover rounded" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-background-secondary p-4">
                <div className="animate-pulse h-3 w-16 bg-surface-hover rounded mb-2" />
                <div className="animate-pulse h-6 w-12 bg-surface-hover rounded" />
              </div>
            ))}
          </div>
          <div className="animate-pulse h-64 bg-surface-hover rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // 3. Error with no data
  if (error && dataItems.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-error mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-text-muted text-center max-w-sm mb-4">
            {error}
          </p>
          <Button variant="outline" onClick={retry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
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
                Data Sovereignty
              </h2>
              <p className="text-sm text-text-muted mt-1">
                Full transparency and control over your stored data
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportAll}>
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <motion.div
              className="rounded-lg border border-border bg-background-secondary p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs text-text-muted">Total Items</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stats.totalItems}</p>
            </motion.div>

            <motion.div
              className="rounded-lg border border-border bg-background-secondary p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs text-text-muted">Total Storage</span>
              </div>
              <p className="text-lg font-bold text-text-primary">
                {formatBytes(stats.totalBytes)}
              </p>
            </motion.div>

            <motion.div
              className="rounded-lg border border-border bg-background-secondary p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs text-text-muted">Encryption</span>
              </div>
              <p className="text-lg font-bold text-text-primary">
                {Math.round(stats.encryptionPercentage)}%
              </p>
            </motion.div>

            <motion.div
              className="rounded-lg border border-border bg-background-secondary p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs text-text-muted">Activity (24h)</span>
              </div>
              <p className="text-lg font-bold text-text-primary">
                {stats.recentActivityCount}
              </p>
            </motion.div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid lg:grid-cols-2 gap-6 mt-4">
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="text-sm font-semibold text-text-primary mb-4">
                    Storage Distribution
                  </h3>
                  <StorageChart summary={storageSummary} />
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="text-sm font-semibold text-text-primary mb-4">
                    Encryption Status
                  </h3>
                  <EncryptionOverview summary={encryptionSummary} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="inventory">
              <div className="mt-4">
                <DataInventory
                  items={filteredItems}
                  searchQuery={searchQuery}
                  categoryFilter={categoryFilter}
                  locationFilter={locationFilter}
                  selectedItemIds={selectedItemIds}
                  onSearchChange={setSearchQuery}
                  onCategoryFilterChange={setCategoryFilter}
                  onLocationFilterChange={setLocationFilter}
                  onToggleSelection={toggleItemSelection}
                  onSelectAll={selectAllItems}
                  onClearSelection={clearSelection}
                  onExport={handleExportAll}
                  onDelete={handleDeleteSelected}
                />
              </div>
            </TabsContent>

            <TabsContent value="credentials">
              <div className="mt-4">
                <CredentialsDashboard />
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <div className="mt-4 rounded-lg border border-border bg-background-secondary p-5">
                <ActivityLog
                  activities={activities}
                  onClear={clearActivities}
                />
              </div>
            </TabsContent>

            <TabsContent value="privacy">
              <div className="mt-4 rounded-lg border border-border bg-background-secondary p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  Privacy Preferences
                </h3>
                <PrivacySettingsPanel
                  settings={privacySettings}
                  onUpdate={updatePrivacySetting}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        exportStatus={exportStatus}
        exportError={exportError}
        exportProgress={exportProgress}
        onExport={exportData}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        items={selectedItems}
        deleteResult={deleteResult}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
