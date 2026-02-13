/**
 * Data Sovereignty Store
 *
 * Manages state unique to the data sovereignty dashboard: activity log,
 * privacy preferences, and ephemeral UI state (selections, filters, export).
 *
 * Follows the credential-store.ts pattern: Zustand v5 with devtools + persist.
 * Document/credential data stays in their own stores — this store only holds
 * sovereignty-specific concerns.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  ActivityEntry,
  ActivityAction,
  PrivacySettings,
  DataCategory,
  StorageLocation,
  DeleteResult,
} from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

export interface DataSovereigntyState {
  /** Activity entries keyed by ID */
  activities: Record<string, ActivityEntry>;
  /** Activity IDs in newest-first order */
  activityOrder: string[];
  /** Privacy preferences */
  privacySettings: PrivacySettings;

  // Ephemeral UI state (not persisted)
  /** IDs of items selected for bulk operations */
  selectedItemIds: string[];
  /** Export progress status */
  exportStatus: 'idle' | 'exporting' | 'complete' | 'error';
  /** Export error message */
  exportError: string | null;
  /** Export progress percentage (0-100) */
  exportProgress: number;
  /** Result of the last delete operation */
  deleteResult: DeleteResult | null;
  /** Search query for data inventory */
  searchQuery: string;
  /** Category filter */
  categoryFilter: DataCategory | 'all';
  /** Location filter */
  locationFilter: StorageLocation | 'all';
}

export interface DataSovereigntyActions {
  // Activity log
  addActivity: (
    action: ActivityAction,
    description: string,
    category?: DataCategory,
    itemId?: string
  ) => void;
  clearActivities: () => void;

  // Privacy settings
  updatePrivacySetting: <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => void;

  // Selection
  toggleItemSelection: (id: string) => void;
  selectAllItems: (ids: string[]) => void;
  clearSelection: () => void;

  // Export state
  setExportStatus: (status: DataSovereigntyState['exportStatus']) => void;
  setExportError: (error: string | null) => void;
  setExportProgress: (progress: number) => void;

  // Delete result
  setDeleteResult: (result: DeleteResult | null) => void;

  // Filters
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (filter: DataCategory | 'all') => void;
  setLocationFilter: (filter: StorageLocation | 'all') => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Defaults
// ============================================================================

const defaultPrivacySettings: PrivacySettings = {
  autoEncrypt: true,
  localMetadataOnly: false,
  autoExpireShares: true,
  shareExpiryDays: 7,
  activityLogEnabled: true,
  analyticsEnabled: false,
};

const initialState: DataSovereigntyState = {
  activities: {},
  activityOrder: [],
  privacySettings: defaultPrivacySettings,
  selectedItemIds: [],
  exportStatus: 'idle',
  exportError: null,
  exportProgress: 0,
  deleteResult: null,
  searchQuery: '',
  categoryFilter: 'all',
  locationFilter: 'all',
};

// ============================================================================
// Store
// ============================================================================

export const useDataSovereigntyStore = create<
  DataSovereigntyState & DataSovereigntyActions
>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        addActivity: (
          action: ActivityAction,
          description: string,
          category?: DataCategory,
          itemId?: string
        ) =>
          set(
            (state) => {
              const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const entry: ActivityEntry = {
                id,
                action,
                description,
                category,
                itemId,
                timestamp: Date.now(),
              };
              return {
                activities: { ...state.activities, [id]: entry },
                activityOrder: [id, ...state.activityOrder],
              };
            },
            false,
            'addActivity'
          ),

        clearActivities: () =>
          set(
            { activities: {}, activityOrder: [] },
            false,
            'clearActivities'
          ),

        updatePrivacySetting: (key, value) =>
          set(
            (state) => ({
              privacySettings: { ...state.privacySettings, [key]: value },
            }),
            false,
            'updatePrivacySetting'
          ),

        toggleItemSelection: (id: string) =>
          set(
            (state) => ({
              selectedItemIds: state.selectedItemIds.includes(id)
                ? state.selectedItemIds.filter((sid) => sid !== id)
                : [...state.selectedItemIds, id],
            }),
            false,
            'toggleItemSelection'
          ),

        selectAllItems: (ids: string[]) =>
          set({ selectedItemIds: ids }, false, 'selectAllItems'),

        clearSelection: () =>
          set({ selectedItemIds: [] }, false, 'clearSelection'),

        setExportStatus: (exportStatus) =>
          set({ exportStatus }, false, 'setExportStatus'),

        setExportError: (exportError) =>
          set({ exportError, exportStatus: exportError ? 'error' : 'idle' }, false, 'setExportError'),

        setExportProgress: (exportProgress) =>
          set({ exportProgress }, false, 'setExportProgress'),

        setDeleteResult: (deleteResult) =>
          set({ deleteResult }, false, 'setDeleteResult'),

        setSearchQuery: (searchQuery) =>
          set({ searchQuery }, false, 'setSearchQuery'),

        setCategoryFilter: (categoryFilter) =>
          set({ categoryFilter }, false, 'setCategoryFilter'),

        setLocationFilter: (locationFilter) =>
          set({ locationFilter }, false, 'setLocationFilter'),

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'data-sovereignty-store',
        partialize: (state) => ({
          activities: state.activities,
          activityOrder: state.activityOrder,
          privacySettings: state.privacySettings,
        }),
      }
    ),
    {
      name: 'data-sovereignty-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Get the activities record. */
export const useActivitiesRecord = () =>
  useDataSovereigntyStore((state) => state.activities);

/** Get the activity order array. */
export const useActivityOrder = () =>
  useDataSovereigntyStore((state) => state.activityOrder);

/** Get privacy settings. */
export const usePrivacySettings = () =>
  useDataSovereigntyStore((state) => state.privacySettings);

/** Get selected item IDs. */
export const useSelectedItemIds = () =>
  useDataSovereigntyStore((state) => state.selectedItemIds);

/** Get export status. */
export const useExportStatus = () =>
  useDataSovereigntyStore((state) => state.exportStatus);

/** Get export error. */
export const useExportError = () =>
  useDataSovereigntyStore((state) => state.exportError);

/** Get search query. */
export const useSearchQuery = () =>
  useDataSovereigntyStore((state) => state.searchQuery);

/** Get category filter. */
export const useCategoryFilter = () =>
  useDataSovereigntyStore((state) => state.categoryFilter);

/** Get location filter. */
export const useLocationFilter = () =>
  useDataSovereigntyStore((state) => state.locationFilter);
