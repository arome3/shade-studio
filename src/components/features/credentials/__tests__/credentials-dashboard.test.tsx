import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UICredential } from '@/types/credentials';
import type { UseCredentialsReturn } from '@/hooks/use-credentials';

// ---------------------------------------------------------------------------
// Mock the hook
// ---------------------------------------------------------------------------

const mockSetFilter = vi.fn();
const mockStoreOnChain = vi.fn().mockResolvedValue('cred-1');
const mockRemoveCredential = vi.fn();
const mockGetStorageCost = vi.fn().mockResolvedValue('10000000000000000000000');

const defaultMock: UseCredentialsReturn = {
  credentials: [] as UICredential[],
  stats: {
    total: 0,
    localProofs: 0,
    onChain: 0,
    verified: 0,
    expired: 0,
    byCircuit: {
      'verified-builder': 0,
      'grant-track-record': 0,
      'team-attestation': 0,
    },
  },
  isFetching: false,
  isStoring: false,
  error: null,
  isConnected: true,
  accountId: 'alice.near',
  proofOperation: null,
  isBusy: false,
  filter: {},
  setFilter: mockSetFilter,
  fetchOnChainCredentials: vi.fn(),
  storeOnChain: mockStoreOnChain,
  removeCredential: mockRemoveCredential,
  getStorageCost: mockGetStorageCost,
  clearError: vi.fn(),
  retryLastAction: vi.fn(),
  zkProof: {
    proofs: [],
    currentOperation: null,
    isBusy: false,
    error: null,
    isConnected: true,
    generateVerifiedBuilderProof: vi.fn(),
    generateGrantTrackRecordProof: vi.fn(),
    generateTeamAttestationProof: vi.fn(),
    verifyProof: vi.fn(),
    verifyOnChain: vi.fn(),
    exportForOnChain: vi.fn(),
    exportToJson: vi.fn(),
    removeProof: vi.fn(),
    cancelOperation: vi.fn(),
    generateComposite: vi.fn(),
    preloadCircuit: vi.fn(),
    getEstimatedTime: vi.fn(),
    pruneExpired: vi.fn(),
    isExpired: vi.fn(),
    clearError: vi.fn(),
  },
};

let currentMock: UseCredentialsReturn = { ...defaultMock };

vi.mock('@/hooks/use-credentials', () => ({
  useCredentials: () => currentMock,
  CIRCUIT_DISPLAY: {
    'verified-builder': {
      id: 'verified-builder',
      name: 'Verified Builder',
      description: 'Proves activity history',
      requirement: 'Minimum active days',
      accentColor: 'near-green-500',
      gradientFrom: 'from-near-green-500/20',
      gradientTo: 'to-near-green-500/5',
    },
    'grant-track-record': {
      id: 'grant-track-record',
      name: 'Grant Track Record',
      description: 'Proves grant history',
      requirement: 'Minimum completed grants',
      accentColor: 'near-cyan-500',
      gradientFrom: 'from-near-cyan-500/20',
      gradientTo: 'to-near-cyan-500/5',
    },
    'team-attestation': {
      id: 'team-attestation',
      name: 'Team Attestation',
      description: 'Proves team endorsements',
      requirement: 'Minimum attestations',
      accentColor: 'near-purple-500',
      gradientFrom: 'from-near-purple-500/20',
      gradientTo: 'to-near-purple-500/5',
    },
  },
}));

// Mock circuit-display for components that import directly
vi.mock('@/lib/zk/circuit-display', () => {
  const Shield = () => null;
  const Award = () => null;
  const Users = () => null;
  const config = {
    'verified-builder': {
      id: 'verified-builder',
      name: 'Verified Builder',
      description: 'Proves activity history',
      requirement: 'Minimum active days',
      accentColor: 'near-green-500',
      gradientFrom: 'from-near-green-500/20',
      gradientTo: 'to-near-green-500/5',
      icon: Shield,
      borderClass: 'border-l-near-green-500',
      borderActiveClass: 'border-near-green-500/30',
      hoverBorderClass: 'hover:border-near-green-500/60',
      iconBgClass: 'bg-near-green-500/10',
      iconTextClass: 'text-near-green-500',
      ringClass: 'border-near-green-500/30',
      progressClass: 'bg-near-green-500',
      dotColorClass: 'bg-near-green-500',
    },
    'grant-track-record': {
      id: 'grant-track-record',
      name: 'Grant Track Record',
      description: 'Proves grant history',
      requirement: 'Minimum completed grants',
      accentColor: 'near-cyan-500',
      gradientFrom: 'from-near-cyan-500/20',
      gradientTo: 'to-near-cyan-500/5',
      icon: Award,
      borderClass: 'border-l-near-cyan-500',
      borderActiveClass: 'border-near-cyan-500/30',
      hoverBorderClass: 'hover:border-near-cyan-500/60',
      iconBgClass: 'bg-near-cyan-500/10',
      iconTextClass: 'text-near-cyan-500',
      ringClass: 'border-near-cyan-500/30',
      progressClass: 'bg-near-cyan-500',
      dotColorClass: 'bg-near-cyan-500',
    },
    'team-attestation': {
      id: 'team-attestation',
      name: 'Team Attestation',
      description: 'Proves team endorsements',
      requirement: 'Minimum attestations',
      accentColor: 'near-purple-500',
      gradientFrom: 'from-near-purple-500/20',
      gradientTo: 'to-near-purple-500/5',
      icon: Users,
      borderClass: 'border-l-near-purple-500',
      borderActiveClass: 'border-near-purple-500/30',
      hoverBorderClass: 'hover:border-near-purple-500/60',
      iconBgClass: 'bg-near-purple-500/10',
      iconTextClass: 'text-near-purple-500',
      ringClass: 'border-near-purple-500/30',
      progressClass: 'bg-near-purple-500',
      dotColorClass: 'bg-near-purple-500',
    },
  };
  return {
    CIRCUIT_DISPLAY: config,
    getCircuitDisplay: (circuit: string) => config[circuit as keyof typeof config],
    getCircuitLabel: (circuit: string) => config[circuit as keyof typeof config]?.name,
    getCircuitIcon: (circuit: string) => config[circuit as keyof typeof config]?.icon,
  };
});

import { CredentialsDashboard } from '../credentials-dashboard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CredentialsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMock = { ...defaultMock };
  });

  describe('guard cascade', () => {
    it('should show wallet prompt when not connected', () => {
      currentMock = { ...defaultMock, isConnected: false };

      render(<CredentialsDashboard />);

      expect(screen.getByText('Connect Your Wallet')).toBeDefined();
    });

    it('should show skeleton when fetching with no data', () => {
      currentMock = { ...defaultMock, isFetching: true };

      const { container } = render(<CredentialsDashboard />);

      // Skeleton has animate-pulse elements
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should show error state when error with no data', () => {
      currentMock = { ...defaultMock, error: 'Network error' };

      render(<CredentialsDashboard />);

      expect(screen.getByText('Something went wrong')).toBeDefined();
      expect(screen.getByText('Network error')).toBeDefined();
    });

    it('should show empty state when connected with no credentials', () => {
      render(<CredentialsDashboard />);

      expect(screen.getByText('No Credentials Yet')).toBeDefined();
      expect(screen.getByText('Generate Your First Credential')).toBeDefined();
    });
  });

  describe('full dashboard', () => {
    const mockCredentials: UICredential[] = [
      {
        id: 'proof-1',
        circuit: 'verified-builder',
        source: 'local',
        status: 'ready',
        createdAt: '2024-01-15T10:00:00.000Z',
        isExpired: false,
        publicSignals: ['100', '200'],
      },
      {
        id: 'cred-1',
        circuit: 'grant-track-record',
        source: 'on-chain',
        status: 'on-chain',
        createdAt: '2024-01-15T10:00:00.000Z',
        verifiedAt: '2024-01-15T10:00:00.000Z',
        isExpired: false,
        publicSignals: ['300', '400'],
        claim: 'Completed 5+ grants',
        owner: 'alice.near',
      },
    ];

    it('should render credential cards when data exists', () => {
      currentMock = {
        ...defaultMock,
        credentials: mockCredentials,
        stats: {
          ...defaultMock.stats,
          total: 2,
          localProofs: 1,
          onChain: 1,
          verified: 1,
        },
      };

      render(<CredentialsDashboard />);

      expect(screen.getByText('ZK Credentials')).toBeDefined();
      expect(screen.getByText('New Credential')).toBeDefined();
      expect(screen.getByText('Verified Builder')).toBeDefined();
      expect(screen.getByText('Grant Track Record')).toBeDefined();
    });

    it('should render tabs for All, Local, On-Chain', () => {
      currentMock = {
        ...defaultMock,
        credentials: mockCredentials,
        stats: { ...defaultMock.stats, total: 2 },
      };

      render(<CredentialsDashboard />);

      expect(screen.getByRole('tab', { name: 'All' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Local' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'On-Chain' })).toBeDefined();
    });

    it('should open proof generation dialog on New Credential click', () => {
      currentMock = {
        ...defaultMock,
        credentials: mockCredentials,
        stats: { ...defaultMock.stats, total: 2 },
      };

      render(<CredentialsDashboard />);

      fireEvent.click(screen.getByText('New Credential'));

      // Dialog should open with circuit selector
      expect(screen.getByText('Generate ZK Credential')).toBeDefined();
    });
  });

  describe('stats display', () => {
    it('should render stat cards with correct values', () => {
      currentMock = {
        ...defaultMock,
        credentials: [
          {
            id: 'p1',
            circuit: 'verified-builder',
            source: 'local',
            status: 'ready',
            createdAt: '2024-01-15T10:00:00.000Z',
            isExpired: false,
            publicSignals: [],
          } as UICredential,
        ],
        stats: {
          ...defaultMock.stats,
          total: 3,
          onChain: 2,
          verified: 2,
          expired: 1,
        },
      };

      render(<CredentialsDashboard />);

      // Stats should be visible — use getAllByText since 'On-Chain' appears
      // as both a stat label and a tab trigger / badge
      expect(screen.getByText('Total')).toBeDefined();
      expect(screen.getAllByText('On-Chain').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Verified')).toBeDefined();
      expect(screen.getByText('Expired')).toBeDefined();
    });
  });

  describe('tab filtering', () => {
    const mixedCredentials: UICredential[] = [
      {
        id: 'local-1',
        circuit: 'verified-builder',
        source: 'local',
        status: 'ready',
        createdAt: '2024-01-15T10:00:00.000Z',
        isExpired: false,
        publicSignals: ['100'],
      },
      {
        id: 'chain-1',
        circuit: 'grant-track-record',
        source: 'on-chain',
        status: 'on-chain',
        createdAt: '2024-01-15T10:00:00.000Z',
        verifiedAt: '2024-01-15T10:00:00.000Z',
        isExpired: false,
        publicSignals: ['200'],
        owner: 'alice.near',
      },
    ];

    it('should show all credentials on All tab', () => {
      currentMock = {
        ...defaultMock,
        credentials: mixedCredentials,
        stats: { ...defaultMock.stats, total: 2 },
      };

      const { container } = render(<CredentialsDashboard />);

      // Both cards should be rendered within the credential grid (mt-4 distinguishes it from stats grid)
      const cards = container.querySelectorAll('.mt-4.grid > div');
      expect(cards.length).toBe(2);
    });

    it('should render only local credentials when only local exist', () => {
      // Tests the rendering path for local-only credentials.
      // Radix TabsTrigger doesn't fire onValueChange reliably in jsdom,
      // so we verify the rendering outcome directly.
      currentMock = {
        ...defaultMock,
        credentials: [mixedCredentials[0]!], // local only
        stats: { ...defaultMock.stats, total: 1 },
      };

      const { container } = render(<CredentialsDashboard />);

      const cards = container.querySelectorAll('.mt-4.grid > div');
      expect(cards.length).toBe(1);
    });

    it('should render only on-chain credentials when only on-chain exist', () => {
      currentMock = {
        ...defaultMock,
        credentials: [mixedCredentials[1]!], // on-chain only
        stats: { ...defaultMock.stats, total: 1 },
      };

      const { container } = render(<CredentialsDashboard />);

      const cards = container.querySelectorAll('.mt-4.grid > div');
      expect(cards.length).toBe(1);
    });
  });

  describe('error recovery', () => {
    it('should show targeted retry button instead of page reload', () => {
      currentMock = {
        ...defaultMock,
        error: 'Network error. Please check your connection and try again.',
      };

      render(<CredentialsDashboard />);

      // Should have a retry button
      expect(screen.getByText('Retry Connection')).toBeDefined();
      // Should have dismiss button
      expect(screen.getByText('Dismiss')).toBeDefined();
    });

    it('should show contract paused state', () => {
      currentMock = {
        ...defaultMock,
        error: 'ZK verifier contract is currently paused. Please try again later.',
      };

      render(<CredentialsDashboard />);

      expect(screen.getByText('Contract Paused')).toBeDefined();
      expect(screen.getByText('Check Status')).toBeDefined();
    });
  });
});
