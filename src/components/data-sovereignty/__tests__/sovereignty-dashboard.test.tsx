import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { UseDataSovereigntyReturn } from '@/hooks/use-data-sovereignty';
import type { DataItem, PrivacySettings } from '@/types/data-sovereignty';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const defaultPrivacySettings: PrivacySettings = {
  autoEncrypt: true,
  localMetadataOnly: false,
  autoExpireShares: true,
  shareExpiryDays: 7,
  activityLogEnabled: true,
  analyticsEnabled: false,
};

const mockDataItems: DataItem[] = [
  {
    id: 'doc-1',
    name: 'proposal.pdf',
    sizeBytes: 2048,
    encrypted: true,
    createdAt: Date.now() - 3600000,
    location: 'ipfs',
    secondaryLocation: 'near-social',
    category: 'documents',
  },
  {
    id: 'cred-1',
    name: 'Verified Builder',
    sizeBytes: 200,
    encrypted: false,
    createdAt: Date.now() - 7200000,
    location: 'near-contract',
    category: 'credentials',
  },
];

// ---------------------------------------------------------------------------
// Mock the hook
// ---------------------------------------------------------------------------

const defaultMock: UseDataSovereigntyReturn = {
  dataItems: [],
  filteredItems: [],
  storageSummary: { totalBytes: 0, totalItems: 0, breakdown: [] },
  encryptionSummary: {
    encryptedCount: 0,
    totalCount: 0,
    overallPercentage: 0,
    encryptionReady: true,
    byLocation: [],
  },
  stats: {
    totalItems: 0,
    totalBytes: 0,
    encryptionPercentage: 0,
    recentActivityCount: 0,
  },
  activities: [],
  isConnected: true,
  isLoading: false,
  error: null,
  searchQuery: '',
  categoryFilter: 'all',
  locationFilter: 'all',
  selectedItemIds: [],
  exportStatus: 'idle',
  exportError: null,
  exportProgress: 0,
  deleteResult: null,
  exportData: vi.fn(),
  deleteSelectedItems: vi.fn().mockResolvedValue({ successCount: 0, failedItems: [] }),
  logActivity: vi.fn(),
  clearActivities: vi.fn(),
  retry: vi.fn(),
  setSearchQuery: vi.fn(),
  setCategoryFilter: vi.fn(),
  setLocationFilter: vi.fn(),
  toggleItemSelection: vi.fn(),
  selectAllItems: vi.fn(),
  clearSelection: vi.fn(),
  privacySettings: defaultPrivacySettings,
  updatePrivacySetting: vi.fn(),
};

let currentMock: UseDataSovereigntyReturn = { ...defaultMock };

vi.mock('@/hooks/use-data-sovereignty', () => ({
  useDataSovereignty: () => currentMock,
  STORAGE_LOCATION_CONFIG: {
    local: { label: 'Local', icon: () => null, hex: '#00EC97', tailwindColor: 'text-near-green-500' },
    ipfs: { label: 'IPFS', icon: () => null, hex: '#3B82F6', tailwindColor: 'text-info' },
    'near-social': { label: 'NEAR Social', icon: () => null, hex: '#FBBF24', tailwindColor: 'text-warning' },
    'near-contract': { label: 'NEAR Contract', icon: () => null, hex: '#A855F7', tailwindColor: 'text-near-purple-500' },
  },
}));

vi.mock('@/lib/utils/format', () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return <span {...rest}>{children}</span>;
    },
    circle: (props: Record<string, unknown>) => {
      const { initial, animate, transition, ...rest } = props;
      return <circle {...rest} />;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

// Mock Radix Tabs — Radix uses pointer events internally which jsdom doesn't
// fully support. Replace with simple HTML elements that respond to onClick.
vi.mock('@/components/ui/tabs', () => {
  const React = require('react');
  const Ctx = React.createContext({ value: '', onValueChange: (_v: string) => {} });

  return {
    Tabs: ({ value, onValueChange, children, ...rest }: {
      value: string;
      onValueChange: (v: string) => void;
      children: React.ReactNode;
      [k: string]: unknown;
    }) => (
      <Ctx.Provider value={{ value, onValueChange }}>
        <div {...rest}>{children}</div>
      </Ctx.Provider>
    ),
    TabsList: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div role="tablist" {...rest}>{children}</div>
    ),
    TabsTrigger: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      return (
        <button role="tab" data-state={ctx.value === value ? 'active' : 'inactive'} onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

import { SovereigntyDashboard } from '../sovereignty-dashboard';

// ---------------------------------------------------------------------------
// Helper to set up a full dashboard mock
// ---------------------------------------------------------------------------

function withDashboard(overrides: Partial<UseDataSovereigntyReturn> = {}) {
  currentMock = {
    ...defaultMock,
    dataItems: mockDataItems,
    filteredItems: mockDataItems,
    stats: { totalItems: 2, totalBytes: 2248, encryptionPercentage: 50, recentActivityCount: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SovereigntyDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMock = { ...defaultMock };
  });

  describe('guard cascade', () => {
    it('shows wallet prompt when not connected', () => {
      currentMock = { ...defaultMock, isConnected: false };

      render(<SovereigntyDashboard />);

      expect(screen.getByText('Connect Your Wallet')).toBeDefined();
      expect(screen.getByText(/Connect your NEAR wallet/)).toBeDefined();
    });

    it('shows skeleton when loading with no data', () => {
      currentMock = { ...defaultMock, isLoading: true };

      const { container } = render(<SovereigntyDashboard />);

      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('shows error state when error with no data', () => {
      currentMock = { ...defaultMock, error: 'Failed to fetch data' };

      render(<SovereigntyDashboard />);

      expect(screen.getByText('Something went wrong')).toBeDefined();
      expect(screen.getByText('Failed to fetch data')).toBeDefined();
    });

    it('shows retry button in error state (Gap 5)', () => {
      currentMock = { ...defaultMock, error: 'Network error' };

      render(<SovereigntyDashboard />);

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeDefined();

      fireEvent.click(retryButton);
      expect(currentMock.retry).toHaveBeenCalledTimes(1);
    });
  });

  describe('full dashboard', () => {
    it('renders stats bar with correct values', () => {
      withDashboard({ stats: { totalItems: 2, totalBytes: 2248, encryptionPercentage: 50, recentActivityCount: 3 } });

      render(<SovereigntyDashboard />);

      expect(screen.getByText('Data Sovereignty')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined(); // Total Items
      expect(screen.getByText('2248 B')).toBeDefined(); // Total Storage
      expect(screen.getByText('50%')).toBeDefined(); // Encryption
      expect(screen.getByText('3')).toBeDefined(); // Activity
    });

    it('renders tabs for Overview, Inventory, Activity, Privacy', () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      expect(screen.getByRole('tab', { name: 'Overview' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Inventory' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Activity' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Privacy' })).toBeDefined();
    });

    it('renders storage and encryption sections in overview tab', () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      expect(screen.getByText('Storage Distribution')).toBeDefined();
      expect(screen.getByText('Encryption Status')).toBeDefined();
    });

    it('opens export dialog on Export All click', () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      fireEvent.click(screen.getByText('Export All'));

      expect(screen.getByText('Export Data')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Test Gap 3: Tab switching
  // -------------------------------------------------------------------------
  describe('tab switching', () => {
    it('Inventory tab shows DataInventory content', async () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));

      // DataInventory renders search input and filter selects
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search data items...')).toBeDefined();
      });
    });

    it('Activity tab shows ActivityLog content', async () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));

      // ActivityLog renders "No activity yet" empty state
      await waitFor(() => {
        expect(screen.getByText('No activity yet')).toBeDefined();
      });
    });

    it('Privacy tab shows PrivacySettingsPanel content', async () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: 'Privacy' }));

      await waitFor(() => {
        expect(screen.getByText('Privacy Preferences')).toBeDefined();
        expect(screen.getByText('Auto-encrypt new data')).toBeDefined();
      });
    });

    it('switching back to Overview shows storage chart + encryption', async () => {
      withDashboard();

      render(<SovereigntyDashboard />);

      // Go to Inventory
      fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search data items...')).toBeDefined();
      });

      // Go back to Overview
      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
      await waitFor(() => {
        expect(screen.getByText('Storage Distribution')).toBeDefined();
        expect(screen.getByText('Encryption Status')).toBeDefined();
      });
    });
  });

  describe('empty states', () => {
    it('renders empty dashboard with no items', () => {
      currentMock = {
        ...defaultMock,
        stats: { totalItems: 0, totalBytes: 0, encryptionPercentage: 0, recentActivityCount: 0 },
      };

      render(<SovereigntyDashboard />);

      // Should still render the dashboard structure
      expect(screen.getByText('Data Sovereignty')).toBeDefined();
      // Multiple stat cards show 0 — use getAllByText
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
    });
  });
});
