import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ActivityEntry } from '@/types/data-sovereignty';

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

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

import { ActivityLog } from '../activity-log';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockActivities: ActivityEntry[] = [
  {
    id: 'act-1',
    action: 'upload',
    description: 'Uploaded proposal.pdf',
    category: 'documents',
    itemId: 'doc-1',
    timestamp: Date.now() - 300000,
  },
  {
    id: 'act-2',
    action: 'delete',
    description: 'Deleted old-file.pdf',
    category: 'documents',
    itemId: 'doc-2',
    timestamp: Date.now() - 600000,
  },
  {
    id: 'act-3',
    action: 'setting-change',
    description: 'Changed autoEncrypt to false',
    category: 'settings',
    timestamp: Date.now() - 900000,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityLog', () => {
  const onClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no activities', () => {
    render(<ActivityLog activities={[]} onClear={onClear} />);

    expect(screen.getByText('No activity yet')).toBeDefined();
    expect(screen.getByText('Operations on your data will be logged here')).toBeDefined();
  });

  it('renders entries with descriptions and timestamps', () => {
    render(<ActivityLog activities={mockActivities} onClear={onClear} />);

    expect(screen.getByText('Uploaded proposal.pdf')).toBeDefined();
    expect(screen.getByText('Deleted old-file.pdf')).toBeDefined();
    expect(screen.getByText('Changed autoEncrypt to false')).toBeDefined();

    // All timestamps show "5 minutes ago" from the mock
    const timestamps = screen.getAllByText('5 minutes ago');
    expect(timestamps.length).toBe(3);
  });

  it('shows event count', () => {
    render(<ActivityLog activities={mockActivities} onClear={onClear} />);

    expect(screen.getByText('3 events')).toBeDefined();
  });

  it('singular "event" for 1 activity', () => {
    render(<ActivityLog activities={[mockActivities[0]!]} onClear={onClear} />);

    expect(screen.getByText('1 event')).toBeDefined();
  });

  it('Clear Log button calls onClear', () => {
    render(<ActivityLog activities={mockActivities} onClear={onClear} />);

    const clearButton = screen.getByText('Clear Log');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
