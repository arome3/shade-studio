import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProofGenerationDialog } from '../proof-generation-dialog';
import type { UseCredentialsReturn } from '@/hooks/use-credentials';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock('@/lib/zk/proof-data-fetcher', () => ({
  fetchVerifiedBuilderData: vi.fn(),
  fetchGrantTrackRecordData: vi.fn(),
  fetchTeamAttestationData: vi.fn(),
}));

import {
  fetchVerifiedBuilderData,
} from '@/lib/zk/proof-data-fetcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockZkProof(overrides: Partial<UseCredentialsReturn['zkProof']> = {}): UseCredentialsReturn['zkProof'] {
  return {
    proofs: [],
    currentOperation: null,
    isBusy: false,
    error: null,
    isConnected: true,
    generateVerifiedBuilderProof: vi.fn().mockResolvedValue({ id: 'proof-new' }),
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProofGenerationDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('select step', () => {
    it('should render circuit selector on initial open', () => {
      const zkProof = createMockZkProof();

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId="alice.near"
        />
      );

      expect(screen.getByText('Generate ZK Credential')).toBeDefined();
      expect(screen.getByText('Verified Builder')).toBeDefined();
      expect(screen.getByText('Grant Track Record')).toBeDefined();
      expect(screen.getByText('Team Attestation')).toBeDefined();
    });

    it('should disable Next button when no circuit selected', () => {
      const zkProof = createMockZkProof();

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId="alice.near"
        />
      );

      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toHaveProperty('disabled', true);
    });
  });

  describe('configure step', () => {
    it('should advance to configure step after circuit selection + Next', () => {
      const zkProof = createMockZkProof();

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId="alice.near"
        />
      );

      // Select a circuit
      fireEvent.click(screen.getByText('Verified Builder'));

      // Click Next
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Should show configure step
      expect(screen.getByText('Configure Verified Builder')).toBeDefined();
      expect(screen.getByText('Generate Proof')).toBeDefined();
    });
  });

  describe('accountId guard (Fix 7)', () => {
    it('should disable Generate Proof button when accountId is null', () => {
      const zkProof = createMockZkProof();

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId={null}
        />
      );

      // Select circuit and advance
      fireEvent.click(screen.getByText('Verified Builder'));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const generateButton = screen.getByRole('button', { name: 'Generate Proof' });
      expect(generateButton).toHaveProperty('disabled', true);
    });

    it('should enable Generate Proof button when accountId is present', () => {
      const zkProof = createMockZkProof();

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId="alice.near"
        />
      );

      fireEvent.click(screen.getByText('Verified Builder'));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const generateButton = screen.getByRole('button', { name: 'Generate Proof' });
      expect(generateButton).toHaveProperty('disabled', false);
    });
  });

  describe('error display', () => {
    it('should show error and retry button on generation failure', async () => {
      const zkProof = createMockZkProof();
      vi.mocked(fetchVerifiedBuilderData).mockRejectedValue(
        new Error('Indexer unavailable')
      );

      render(
        <ProofGenerationDialog
          open={true}
          onOpenChange={onOpenChange}
          zkProof={zkProof}
          proofOperation={null}
          accountId="alice.near"
        />
      );

      // Navigate to configure step
      fireEvent.click(screen.getByText('Verified Builder'));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Click Generate
      fireEvent.click(screen.getByRole('button', { name: 'Generate Proof' }));

      // Should show error message and retry button
      await waitFor(() => {
        expect(screen.getByText('Indexer unavailable')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
      });
    });
  });
});
