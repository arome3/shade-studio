import { describe, it, expect, beforeEach } from 'vitest';
import { useDataSovereigntyStore } from '../data-sovereignty-store';

describe('data-sovereignty-store', () => {
  beforeEach(() => {
    useDataSovereigntyStore.getState().reset();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts with correct initial state', () => {
    const state = useDataSovereigntyStore.getState();
    expect(state.activities).toEqual({});
    expect(state.activityOrder).toEqual([]);
    expect(state.privacySettings.autoEncrypt).toBe(true);
    expect(state.privacySettings.activityLogEnabled).toBe(true);
    expect(state.privacySettings.analyticsEnabled).toBe(false);
    expect(state.selectedItemIds).toEqual([]);
    expect(state.exportStatus).toBe('idle');
    expect(state.exportError).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.categoryFilter).toBe('all');
    expect(state.locationFilter).toBe('all');
  });

  // -------------------------------------------------------------------------
  // Activity log
  // -------------------------------------------------------------------------

  it('addActivity adds to record and prepends to order', () => {
    useDataSovereigntyStore.getState().addActivity('upload', 'Uploaded file.pdf', 'documents', 'doc-1');

    const state = useDataSovereigntyStore.getState();
    expect(state.activityOrder).toHaveLength(1);

    const id = state.activityOrder[0]!;
    const entry = state.activities[id];
    expect(entry).toBeDefined();
    expect(entry!.action).toBe('upload');
    expect(entry!.description).toBe('Uploaded file.pdf');
    expect(entry!.category).toBe('documents');
    expect(entry!.itemId).toBe('doc-1');
    expect(entry!.timestamp).toBeGreaterThan(0);
  });

  it('addActivity prepends new entries (newest first)', () => {
    useDataSovereigntyStore.getState().addActivity('upload', 'First');
    useDataSovereigntyStore.getState().addActivity('download', 'Second');

    const state = useDataSovereigntyStore.getState();
    expect(state.activityOrder).toHaveLength(2);

    const first = state.activities[state.activityOrder[0]!]!;
    const second = state.activities[state.activityOrder[1]!]!;
    expect(first.description).toBe('Second');
    expect(second.description).toBe('First');
  });

  it('clearActivities resets both record and order', () => {
    useDataSovereigntyStore.getState().addActivity('upload', 'Test');
    useDataSovereigntyStore.getState().addActivity('delete', 'Test2');
    useDataSovereigntyStore.getState().clearActivities();

    const state = useDataSovereigntyStore.getState();
    expect(state.activities).toEqual({});
    expect(state.activityOrder).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Privacy settings
  // -------------------------------------------------------------------------

  it('updatePrivacySetting updates individual keys', () => {
    useDataSovereigntyStore.getState().updatePrivacySetting('autoEncrypt', false);

    const state = useDataSovereigntyStore.getState();
    expect(state.privacySettings.autoEncrypt).toBe(false);
    // Other settings unchanged
    expect(state.privacySettings.activityLogEnabled).toBe(true);
  });

  it('updatePrivacySetting works for numeric values', () => {
    useDataSovereigntyStore.getState().updatePrivacySetting('shareExpiryDays', 30);

    expect(useDataSovereigntyStore.getState().privacySettings.shareExpiryDays).toBe(30);
  });

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  it('toggleItemSelection adds and removes items', () => {
    useDataSovereigntyStore.getState().toggleItemSelection('item-1');
    expect(useDataSovereigntyStore.getState().selectedItemIds).toEqual(['item-1']);

    useDataSovereigntyStore.getState().toggleItemSelection('item-2');
    expect(useDataSovereigntyStore.getState().selectedItemIds).toEqual(['item-1', 'item-2']);

    // Toggle off
    useDataSovereigntyStore.getState().toggleItemSelection('item-1');
    expect(useDataSovereigntyStore.getState().selectedItemIds).toEqual(['item-2']);
  });

  it('selectAllItems replaces selection', () => {
    useDataSovereigntyStore.getState().toggleItemSelection('old');
    useDataSovereigntyStore.getState().selectAllItems(['a', 'b', 'c']);

    expect(useDataSovereigntyStore.getState().selectedItemIds).toEqual(['a', 'b', 'c']);
  });

  it('clearSelection empties selection', () => {
    useDataSovereigntyStore.getState().selectAllItems(['a', 'b']);
    useDataSovereigntyStore.getState().clearSelection();

    expect(useDataSovereigntyStore.getState().selectedItemIds).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Export state
  // -------------------------------------------------------------------------

  it('setExportStatus updates export status', () => {
    useDataSovereigntyStore.getState().setExportStatus('exporting');
    expect(useDataSovereigntyStore.getState().exportStatus).toBe('exporting');
  });

  it('setExportError sets error and error status', () => {
    useDataSovereigntyStore.getState().setExportError('Download failed');

    const state = useDataSovereigntyStore.getState();
    expect(state.exportError).toBe('Download failed');
    expect(state.exportStatus).toBe('error');
  });

  it('setExportError with null resets to idle', () => {
    useDataSovereigntyStore.getState().setExportError('err');
    useDataSovereigntyStore.getState().setExportError(null);

    const state = useDataSovereigntyStore.getState();
    expect(state.exportError).toBeNull();
    expect(state.exportStatus).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  it('setSearchQuery updates search query', () => {
    useDataSovereigntyStore.getState().setSearchQuery('test');
    expect(useDataSovereigntyStore.getState().searchQuery).toBe('test');
  });

  it('setCategoryFilter updates category filter', () => {
    useDataSovereigntyStore.getState().setCategoryFilter('documents');
    expect(useDataSovereigntyStore.getState().categoryFilter).toBe('documents');
  });

  it('setLocationFilter updates location filter', () => {
    useDataSovereigntyStore.getState().setLocationFilter('ipfs');
    expect(useDataSovereigntyStore.getState().locationFilter).toBe('ipfs');
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  it('reset returns to initial state', () => {
    // Modify everything
    useDataSovereigntyStore.getState().addActivity('upload', 'test');
    useDataSovereigntyStore.getState().updatePrivacySetting('autoEncrypt', false);
    useDataSovereigntyStore.getState().toggleItemSelection('item-1');
    useDataSovereigntyStore.getState().setSearchQuery('query');
    useDataSovereigntyStore.getState().setCategoryFilter('documents');
    useDataSovereigntyStore.getState().setExportError('err');

    // Reset
    useDataSovereigntyStore.getState().reset();

    const state = useDataSovereigntyStore.getState();
    expect(state.activities).toEqual({});
    expect(state.activityOrder).toEqual([]);
    expect(state.privacySettings.autoEncrypt).toBe(true);
    expect(state.selectedItemIds).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.categoryFilter).toBe('all');
    expect(state.exportStatus).toBe('idle');
    expect(state.exportError).toBeNull();
  });
});
