import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DataItem } from '@/types/data-sovereignty';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock('@/lib/utils/format', () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

import { DataInventory } from '../data-inventory';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockItems: DataItem[] = [
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

const defaultProps = {
  items: mockItems,
  searchQuery: '',
  categoryFilter: 'all' as const,
  locationFilter: 'all' as const,
  selectedItemIds: [] as string[],
  onSearchChange: vi.fn(),
  onCategoryFilterChange: vi.fn(),
  onLocationFilterChange: vi.fn(),
  onToggleSelection: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onExport: vi.fn(),
  onDelete: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state with no items and no filters', () => {
    render(<DataInventory {...defaultProps} items={[]} />);

    expect(screen.getByText('No data items yet')).toBeDefined();
  });

  it('renders "No matching items" with active filters', () => {
    render(
      <DataInventory
        {...defaultProps}
        items={[]}
        searchQuery="nonexistent"
      />
    );

    expect(screen.getByText('No matching items')).toBeDefined();
  });

  it('renders items grouped by category', () => {
    render(<DataInventory {...defaultProps} />);

    expect(screen.getByText('Documents')).toBeDefined();
    expect(screen.getByText('Credentials')).toBeDefined();
    expect(screen.getByText('proposal.pdf')).toBeDefined();
    expect(screen.getByText('Verified Builder')).toBeDefined();
  });

  it('search input calls onSearchChange', () => {
    render(<DataInventory {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search data items...');
    fireEvent.change(input, { target: { value: 'proposal' } });

    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('proposal');
  });

  it('toggle item selection calls onToggleSelection', () => {
    render(<DataInventory {...defaultProps} />);

    // Click on the first item row (proposal.pdf)
    const itemRow = screen.getByText('proposal.pdf').closest('[role="checkbox"]');
    expect(itemRow).toBeDefined();
    if (itemRow) fireEvent.click(itemRow);

    expect(defaultProps.onToggleSelection).toHaveBeenCalledWith('doc-1');
  });

  it('select all / deselect all works', () => {
    render(<DataInventory {...defaultProps} />);

    // Click "Select all"
    const selectAllBtn = screen.getByRole('checkbox', { name: /select all/i });
    fireEvent.click(selectAllBtn);

    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(['doc-1', 'cred-1']);
  });

  it('deselect all works when all are selected', () => {
    render(
      <DataInventory
        {...defaultProps}
        selectedItemIds={['doc-1', 'cred-1']}
      />
    );

    const selectAllBtn = screen.getByRole('checkbox', { name: /deselect all/i });
    fireEvent.click(selectAllBtn);

    expect(defaultProps.onClearSelection).toHaveBeenCalled();
  });

  it('bulk action bar appears when items selected', () => {
    render(
      <DataInventory
        {...defaultProps}
        selectedItemIds={['doc-1']}
      />
    );

    expect(screen.getByText('1 selected')).toBeDefined();
    expect(screen.getByText('Export')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('keyboard Enter/Space on item toggles selection', () => {
    render(<DataInventory {...defaultProps} />);

    const itemRow = screen.getByText('proposal.pdf').closest('[role="checkbox"]');
    expect(itemRow).toBeDefined();

    if (itemRow) {
      fireEvent.keyDown(itemRow, { key: 'Enter' });
      expect(defaultProps.onToggleSelection).toHaveBeenCalledWith('doc-1');

      vi.clearAllMocks();
      fireEvent.keyDown(itemRow, { key: ' ' });
      expect(defaultProps.onToggleSelection).toHaveBeenCalledWith('doc-1');
    }
  });

  it('keyboard Enter/Space on select-all toggles all', () => {
    render(<DataInventory {...defaultProps} />);

    const selectAllBtn = screen.getByRole('checkbox', { name: /select all/i });

    fireEvent.keyDown(selectAllBtn, { key: 'Enter' });
    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(['doc-1', 'cred-1']);

    vi.clearAllMocks();
    fireEvent.keyDown(selectAllBtn, { key: ' ' });
    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(['doc-1', 'cred-1']);
  });

  it('shows secondary location for documents', () => {
    render(<DataInventory {...defaultProps} />);

    // The inner span renders "+ near-social" next to the "ipfs" text
    expect(screen.getByText(/\+ near-social/)).toBeDefined();
  });
});
