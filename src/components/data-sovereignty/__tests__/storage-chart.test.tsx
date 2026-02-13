import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StorageSummary, StorageBreakdown } from '@/types/data-sovereignty';

// Mock framer-motion
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
}));

vi.mock('@/lib/utils/format', () => ({
  formatBytes: (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  },
}));

import { StorageChart } from '../storage-chart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBreakdown(
  location: string,
  totalBytes: number,
  itemCount: number,
  percentage: number
): StorageBreakdown {
  return {
    location: location as StorageBreakdown['location'],
    totalBytes,
    itemCount,
    percentage,
    config: {
      label: location.charAt(0).toUpperCase() + location.slice(1),
      icon: (() => null) as unknown as StorageBreakdown['config']['icon'],
      hex: '#000',
      tailwindColor: 'text-text-muted',
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorageChart', () => {
  it('renders empty state when totalItems is 0', () => {
    const summary: StorageSummary = { totalBytes: 0, totalItems: 0, breakdown: [] };

    render(<StorageChart summary={summary} />);

    expect(screen.getByText('No data stored yet')).toBeDefined();
  });

  it('renders single location with 1 arc and 1 detail card', () => {
    const summary: StorageSummary = {
      totalBytes: 2048,
      totalItems: 3,
      breakdown: [makeBreakdown('ipfs', 2048, 3, 100)],
    };

    const { container } = render(<StorageChart summary={summary} />);

    // One data arc (circle elements: 1 background + 1 data arc)
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // background + 1 arc

    // Center text and detail card both show "2.0 KB"
    const kbTexts = screen.getAllByText('2.0 KB');
    expect(kbTexts.length).toBe(2); // center + detail card

    // 1 detail card
    expect(screen.getByText('Ipfs')).toBeDefined();
  });

  it('renders multiple locations with correct number of arcs and cards', () => {
    const summary: StorageSummary = {
      totalBytes: 3000,
      totalItems: 5,
      breakdown: [
        makeBreakdown('ipfs', 2000, 3, 66.7),
        makeBreakdown('local', 1000, 2, 33.3),
      ],
    };

    const { container } = render(<StorageChart summary={summary} />);

    // 1 background + 2 data arcs
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);

    // Center text
    expect(screen.getByText('2.9 KB')).toBeDefined();
    expect(screen.getByText('5 items')).toBeDefined();

    // 2 detail cards
    expect(screen.getByText('Ipfs')).toBeDefined();
    expect(screen.getByText('Local')).toBeDefined();
  });

  it('shows singular "item" when totalItems is 1', () => {
    const summary: StorageSummary = {
      totalBytes: 512,
      totalItems: 1,
      breakdown: [makeBreakdown('local', 512, 1, 100)],
    };

    render(<StorageChart summary={summary} />);

    // "1 item" appears in both center and detail card
    const itemTexts = screen.getAllByText('1 item');
    expect(itemTexts.length).toBe(2);
  });
});
