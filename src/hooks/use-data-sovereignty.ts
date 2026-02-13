'use client';

import { useCallback, useMemo } from 'react';
import {
  HardDrive,
  Cloud,
  Globe,
  Link2,
} from 'lucide-react';
import { useWallet } from './use-wallet';
import { useDocuments } from './use-documents';
import { useCredentials } from './use-credentials';
import { useEncryption } from './use-encryption';
import {
  useDataSovereigntyStore,
  useActivitiesRecord,
  useActivityOrder,
  usePrivacySettings,
  useSelectedItemIds,
  useExportStatus,
  useExportError,
  useSearchQuery,
  useCategoryFilter,
  useLocationFilter,
} from '@/stores/data-sovereignty-store';
import { CIRCUIT_DISPLAY } from '@/lib/zk/circuit-display';
import type {
  DataItem,
  StorageLocation,
  StorageLocationConfig,
  StorageSummary,
  StorageBreakdown,
  EncryptionSummary,
  LocationEncryption,
  DataSovereigntyStats,
  ActivityEntry,
  ActivityAction,
  DataCategory,
  ExportOptions,
  DeleteResult,
  PrivacySettings,
} from '@/types/data-sovereignty';

// ============================================================================
// Storage Location Config
// ============================================================================

export const STORAGE_LOCATION_CONFIG: Record<StorageLocation, StorageLocationConfig> = {
  local: {
    label: 'Local',
    icon: HardDrive,
    hex: '#00EC97',
    tailwindColor: 'text-near-green-500',
  },
  ipfs: {
    label: 'IPFS',
    icon: Cloud,
    hex: '#3B82F6',
    tailwindColor: 'text-info',
  },
  'near-social': {
    label: 'NEAR Social',
    icon: Globe,
    hex: '#FBBF24',
    tailwindColor: 'text-warning',
  },
  'near-contract': {
    label: 'NEAR Contract',
    icon: Link2,
    hex: '#A855F7',
    tailwindColor: 'text-near-purple-500',
  },
};

// Estimated metadata size for NEAR Social entries (~500 bytes)
const NEAR_SOCIAL_METADATA_ESTIMATE = 500;

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseDataSovereigntyReturn {
  // Data
  dataItems: DataItem[];
  filteredItems: DataItem[];
  storageSummary: StorageSummary;
  encryptionSummary: EncryptionSummary;
  stats: DataSovereigntyStats;
  activities: ActivityEntry[];

  // State
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Filter state
  searchQuery: string;
  categoryFilter: DataCategory | 'all';
  locationFilter: StorageLocation | 'all';
  selectedItemIds: string[];

  // Export state
  exportStatus: 'idle' | 'exporting' | 'complete' | 'error';
  exportError: string | null;
  exportProgress: number;

  // Delete result
  deleteResult: DeleteResult | null;

  // Actions
  exportData: (options: ExportOptions) => Promise<void>;
  deleteSelectedItems: () => Promise<DeleteResult>;
  logActivity: (
    action: ActivityAction,
    description: string,
    category?: DataCategory,
    itemId?: string
  ) => void;
  clearActivities: () => void;
  retry: () => Promise<void>;

  // Filter actions
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (filter: DataCategory | 'all') => void;
  setLocationFilter: (filter: StorageLocation | 'all') => void;
  toggleItemSelection: (id: string) => void;
  selectAllItems: (ids: string[]) => void;
  clearSelection: () => void;

  // Privacy
  privacySettings: PrivacySettings;
  updatePrivacySetting: <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useDataSovereignty(): UseDataSovereigntyReturn {
  const { isConnected } = useWallet();
  const {
    documents,
    isLoading: docsLoading,
    error: docsError,
    deleteDocument,
    downloadDocument,
    fetchDocuments,
  } = useDocuments();
  const {
    credentials,
    isFetching: credsFetching,
    error: credsError,
    removeCredential,
    fetchOnChainCredentials,
  } = useCredentials();
  const { isReady: encryptionReady } = useEncryption();

  // Store selectors
  const activitiesRecord = useActivitiesRecord();
  const activityOrder = useActivityOrder();
  const privacySettings = usePrivacySettings();
  const selectedItemIds = useSelectedItemIds();
  const exportStatus = useExportStatus();
  const exportError = useExportError();
  const searchQuery = useSearchQuery();
  const categoryFilter = useCategoryFilter();
  const locationFilter = useLocationFilter();

  // Store actions
  const addActivity = useDataSovereigntyStore((s) => s.addActivity);
  const clearActivities = useDataSovereigntyStore((s) => s.clearActivities);
  const storeUpdatePrivacySetting = useDataSovereigntyStore((s) => s.updatePrivacySetting);
  const toggleItemSelection = useDataSovereigntyStore((s) => s.toggleItemSelection);
  const selectAllItems = useDataSovereigntyStore((s) => s.selectAllItems);
  const clearSelection = useDataSovereigntyStore((s) => s.clearSelection);
  const setExportStatus = useDataSovereigntyStore((s) => s.setExportStatus);
  const setExportError = useDataSovereigntyStore((s) => s.setExportError);
  const setExportProgress = useDataSovereigntyStore((s) => s.setExportProgress);
  const setDeleteResult = useDataSovereigntyStore((s) => s.setDeleteResult);
  const setSearchQuery = useDataSovereigntyStore((s) => s.setSearchQuery);
  const setCategoryFilter = useDataSovereigntyStore((s) => s.setCategoryFilter);
  const setLocationFilter = useDataSovereigntyStore((s) => s.setLocationFilter);

  // Read exportProgress from store
  const exportProgress = useDataSovereigntyStore((s) => s.exportProgress);
  const deleteResult = useDataSovereigntyStore((s) => s.deleteResult);

  // Combined state
  const isLoading = docsLoading || credsFetching;
  const error = docsError || credsError;

  // ---------------------------------------------------------------------------
  // Gap 2: Privacy-gated activity logging
  // ---------------------------------------------------------------------------
  const logActivity = useCallback(
    (action: ActivityAction, description: string, category?: DataCategory, itemId?: string) => {
      if (!privacySettings.activityLogEnabled) return;
      addActivity(action, description, category, itemId);
    },
    [addActivity, privacySettings.activityLogEnabled]
  );

  // ---------------------------------------------------------------------------
  // Gap 2: Wrapped updatePrivacySetting — logs setting changes
  // ---------------------------------------------------------------------------
  const updatePrivacySetting = useCallback(
    <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) => {
      // Log the change before applying it (so activityLogEnabled is still true
      // when the user turns it off — avoids the paradox)
      if (privacySettings.activityLogEnabled) {
        addActivity(
          'setting-change',
          `Changed ${key} to ${String(value)}`,
          'settings'
        );
      }
      storeUpdatePrivacySetting(key, value);
    },
    [storeUpdatePrivacySetting, addActivity, privacySettings.activityLogEnabled]
  );

  // ---------------------------------------------------------------------------
  // Derive unified DataItem[] from documents + credentials
  // Gap 4: Documents get secondaryLocation: 'near-social'
  // Gap 7: Settings use stable timestamp (0)
  // ---------------------------------------------------------------------------
  const dataItems = useMemo<DataItem[]>(() => {
    const items: DataItem[] = [];

    // VaultDocument → DataItem
    for (const doc of documents) {
      items.push({
        id: doc.id,
        name: doc.metadata.name,
        sizeBytes: doc.metadata.size,
        encrypted: !!doc.metadata.encryptionNonce,
        createdAt: doc.metadata.createdAt,
        location: 'ipfs',
        secondaryLocation: 'near-social',
        category: 'documents',
        sourceDocument: doc,
      });
    }

    // UICredential → DataItem
    for (const cred of credentials) {
      const displayName = CIRCUIT_DISPLAY[cred.circuit]?.name ?? cred.circuit;
      items.push({
        id: cred.id,
        name: displayName,
        sizeBytes: 200, // estimated proof size
        encrypted: false, // ZK proofs are publicly verifiable
        createdAt: new Date(cred.createdAt).getTime(),
        location: cred.source === 'on-chain' ? 'near-contract' : 'local',
        category: cred.source === 'on-chain' ? 'credentials' : 'proofs',
        sourceCredential: cred,
      });
    }

    // Privacy settings as a virtual data item (Gap 7: stable timestamp)
    if (privacySettings) {
      items.push({
        id: 'settings-privacy',
        name: 'Privacy Settings',
        sizeBytes: JSON.stringify(privacySettings).length,
        encrypted: false,
        createdAt: 0,
        location: 'local',
        category: 'settings',
      });
    }

    // Sort newest first
    items.sort((a, b) => b.createdAt - a.createdAt);

    return items;
  }, [documents, credentials, privacySettings]);

  // ---------------------------------------------------------------------------
  // Filtered items
  // ---------------------------------------------------------------------------
  const filteredItems = useMemo<DataItem[]>(() => {
    return dataItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (locationFilter !== 'all' && item.location !== locationFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.category.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [dataItems, categoryFilter, locationFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Storage summary (Gap 4: count secondaryLocation in storage distribution)
  // ---------------------------------------------------------------------------
  const storageSummary = useMemo<StorageSummary>(() => {
    const locationMap = new Map<StorageLocation, { totalBytes: number; itemCount: number }>();

    for (const item of dataItems) {
      // Primary location
      const existing = locationMap.get(item.location) ?? { totalBytes: 0, itemCount: 0 };
      existing.totalBytes += item.sizeBytes;
      existing.itemCount += 1;
      locationMap.set(item.location, existing);

      // Secondary location (e.g. NEAR Social metadata for documents)
      if (item.secondaryLocation) {
        const secondary = locationMap.get(item.secondaryLocation) ?? { totalBytes: 0, itemCount: 0 };
        secondary.totalBytes += NEAR_SOCIAL_METADATA_ESTIMATE;
        secondary.itemCount += 1;
        locationMap.set(item.secondaryLocation, secondary);
      }
    }

    let totalBytes = 0;
    for (const data of locationMap.values()) {
      totalBytes += data.totalBytes;
    }
    const totalItems = dataItems.length;

    const breakdown: StorageBreakdown[] = [];
    for (const [location, data] of locationMap) {
      breakdown.push({
        location,
        totalBytes: data.totalBytes,
        itemCount: data.itemCount,
        percentage: totalBytes > 0 ? (data.totalBytes / totalBytes) * 100 : 0,
        config: STORAGE_LOCATION_CONFIG[location],
      });
    }

    // Sort by size descending
    breakdown.sort((a, b) => b.totalBytes - a.totalBytes);

    return { totalBytes, totalItems, breakdown };
  }, [dataItems]);

  // ---------------------------------------------------------------------------
  // Encryption summary
  // ---------------------------------------------------------------------------
  const encryptionSummary = useMemo<EncryptionSummary>(() => {
    const locationMap = new Map<StorageLocation, { encrypted: number; total: number }>();

    for (const item of dataItems) {
      if (item.category === 'settings') continue; // exclude settings from encryption stats
      const existing = locationMap.get(item.location) ?? { encrypted: 0, total: 0 };
      existing.total += 1;
      if (item.encrypted) existing.encrypted += 1;
      locationMap.set(item.location, existing);
    }

    const realItems = dataItems.filter((i) => i.category !== 'settings');
    const encryptedCount = realItems.filter((i) => i.encrypted).length;
    const totalCount = realItems.length;

    const byLocation: LocationEncryption[] = [];
    for (const [location, data] of locationMap) {
      byLocation.push({
        location,
        encrypted: data.encrypted,
        total: data.total,
        percentage: data.total > 0 ? (data.encrypted / data.total) * 100 : 0,
      });
    }

    return {
      encryptedCount,
      totalCount,
      overallPercentage: totalCount > 0 ? (encryptedCount / totalCount) * 100 : 0,
      encryptionReady,
      byLocation,
    };
  }, [dataItems, encryptionReady]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const stats = useMemo<DataSovereigntyStats>(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentActivityCount = activityOrder.filter((id) => {
      const entry = activitiesRecord[id];
      return entry && entry.timestamp > oneDayAgo;
    }).length;

    return {
      totalItems: dataItems.filter((i) => i.category !== 'settings').length,
      totalBytes: storageSummary.totalBytes,
      encryptionPercentage: encryptionSummary.overallPercentage,
      recentActivityCount,
    };
  }, [dataItems, storageSummary, encryptionSummary, activityOrder, activitiesRecord]);

  // ---------------------------------------------------------------------------
  // Activities (sorted from record + order)
  // ---------------------------------------------------------------------------
  const activities = useMemo<ActivityEntry[]>(() => {
    return activityOrder
      .map((id) => activitiesRecord[id])
      .filter((entry): entry is ActivityEntry => !!entry);
  }, [activitiesRecord, activityOrder]);

  // ---------------------------------------------------------------------------
  // Gap 3: Export with real progress tracking + file content in ZIP
  // ---------------------------------------------------------------------------
  const exportData = useCallback(
    async (options: ExportOptions) => {
      setExportStatus('exporting');
      setExportProgress(0);
      try {
        const itemsToExport = dataItems.filter(
          (item) => options.categories.includes(item.category)
        );

        if (options.format === 'json') {
          // JSON: metadata-only export (lightweight inventory)
          const exportPayload = {
            exportedAt: new Date().toISOString(),
            format: 'json',
            note: 'JSON exports include metadata only. Use ZIP for full data export.',
            items: itemsToExport.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              location: item.location,
              secondaryLocation: item.secondaryLocation,
              sizeBytes: item.sizeBytes,
              encrypted: item.encrypted,
              createdAt: new Date(item.createdAt).toISOString(),
            })),
            privacySettings,
          };

          const { saveAs } = await import('file-saver');
          const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
            type: 'application/json',
          });
          saveAs(blob, `shade-studio-export-${Date.now()}.json`);
          setExportProgress(100);
        } else {
          // ZIP: full data export with actual file content
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const errors: { id: string; name: string; error: string }[] = [];

          // Add data inventory
          const inventory = itemsToExport.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            location: item.location,
            secondaryLocation: item.secondaryLocation,
            sizeBytes: item.sizeBytes,
            encrypted: item.encrypted,
            createdAt: new Date(item.createdAt).toISOString(),
          }));
          zip.file('data-inventory.json', JSON.stringify(inventory, null, 2));

          // Add privacy settings (unless localMetadataOnly filters it)
          if (!privacySettings.localMetadataOnly) {
            zip.file('privacy-settings.json', JSON.stringify(privacySettings, null, 2));
          }

          // Add activity log
          zip.file('activity-log.json', JSON.stringify(activities, null, 2));

          // Download actual file content for each item
          const totalItems = itemsToExport.length;
          let processed = 0;

          for (const item of itemsToExport) {
            try {
              if (item.sourceDocument) {
                // Download document file
                const file = await downloadDocument(item.id);
                const buffer = await file.arrayBuffer();
                zip.file(`documents/${item.name}`, buffer);
              } else if (item.sourceCredential) {
                // Serialize credential/proof data as JSON
                const credData = {
                  id: item.sourceCredential.id,
                  circuit: item.sourceCredential.circuit,
                  publicSignals: item.sourceCredential.publicSignals,
                  source: item.sourceCredential.source,
                  createdAt: item.sourceCredential.createdAt,
                  status: item.sourceCredential.status,
                };
                zip.file(
                  `credentials/${item.name.replace(/[/\\?%*:|"<>]/g, '_')}.json`,
                  JSON.stringify(credData, null, 2)
                );
              }
            } catch (err) {
              errors.push({
                id: item.id,
                name: item.name,
                error: err instanceof Error ? err.message : 'Download failed',
              });
            }

            processed += 1;
            setExportProgress(Math.round((processed / totalItems) * 100));
          }

          // Include error log if any downloads failed
          if (errors.length > 0) {
            zip.file('export-errors.json', JSON.stringify(errors, null, 2));
          }

          const { saveAs } = await import('file-saver');
          const content = await zip.generateAsync({ type: 'blob' });
          saveAs(content, `shade-studio-export-${Date.now()}.zip`);
        }

        setExportStatus('complete');
        logActivity('export', `Exported ${options.categories.join(', ')} as ${options.format}`);

        // Reset after brief delay
        setTimeout(() => {
          setExportStatus('idle');
          setExportProgress(0);
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        setExportError(message);
        setExportProgress(0);
      }
    },
    [dataItems, privacySettings, activities, setExportStatus, setExportError, setExportProgress, logActivity, downloadDocument]
  );

  // ---------------------------------------------------------------------------
  // Gap 6: deleteSelectedItems collects errors and returns DeleteResult
  // ---------------------------------------------------------------------------
  const deleteSelectedItems = useCallback(async (): Promise<DeleteResult> => {
    const itemsToDelete = dataItems.filter((item) =>
      selectedItemIds.includes(item.id)
    );

    let successCount = 0;
    const failedItems: DeleteResult['failedItems'] = [];

    for (const item of itemsToDelete) {
      try {
        if (item.sourceDocument) {
          await deleteDocument(item.id);
          logActivity('delete', `Deleted document: ${item.name}`, 'documents', item.id);
          successCount += 1;
        } else if (item.sourceCredential) {
          await removeCredential(item.id, item.sourceCredential.source);
          logActivity('delete', `Removed credential: ${item.name}`, item.category, item.id);
          successCount += 1;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Delete failed';
        failedItems.push({ id: item.id, name: item.name, error: errorMsg });
        logActivity('delete', `Failed to delete: ${item.name} — ${errorMsg}`, item.category, item.id);
      }
    }

    const result: DeleteResult = { successCount, failedItems };
    setDeleteResult(result);
    clearSelection();
    return result;
  }, [dataItems, selectedItemIds, deleteDocument, removeCredential, clearSelection, logActivity, setDeleteResult]);

  // ---------------------------------------------------------------------------
  // Gap 5: Retry function — re-fetches documents and credentials
  // ---------------------------------------------------------------------------
  const retry = useCallback(async () => {
    await Promise.all([
      fetchDocuments?.('default'),
      fetchOnChainCredentials?.(),
    ]);
  }, [fetchDocuments, fetchOnChainCredentials]);

  return {
    // Data
    dataItems,
    filteredItems,
    storageSummary,
    encryptionSummary,
    stats,
    activities,

    // State
    isConnected,
    isLoading,
    error,

    // Filter state
    searchQuery,
    categoryFilter,
    locationFilter,
    selectedItemIds,

    // Export state
    exportStatus,
    exportError,
    exportProgress,

    // Delete result
    deleteResult,

    // Actions
    exportData,
    deleteSelectedItems,
    logActivity,
    clearActivities,
    retry,

    // Filter actions
    setSearchQuery,
    setCategoryFilter,
    setLocationFilter,
    toggleItemSelection,
    selectAllItems,
    clearSelection,

    // Privacy
    privacySettings,
    updatePrivacySetting,
  };
}
