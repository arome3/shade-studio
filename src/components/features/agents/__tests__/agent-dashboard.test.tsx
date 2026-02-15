import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentDashboard } from '../agent-dashboard';

// ---------------------------------------------------------------------------
// Mock the hook to control each guard state independently
// ---------------------------------------------------------------------------

const mockHook = {
  templates: [] as unknown[],
  myAgents: [] as unknown[],
  activeAgent: null,
  isFetching: false,
  isDeploying: false,
  error: null as string | null,
  isConnected: true,
  deploy: vi.fn(),
  selectAgent: vi.fn(),
  verify: vi.fn(),
  invoke: vi.fn(),
  deactivate: vi.fn(),
  refreshTemplates: vi.fn(),
  refreshMyAgents: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('@/hooks/use-shade-agent', () => ({
  useShadeAgent: () => mockHook,
}));

// Mock useWallet to prevent @near-js/crypto ESM resolution error
vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    accountId: 'alice.testnet',
    isConnected: true,
    isSignedIn: true,
  }),
}));

// Mock config used by child components
vi.mock('@/lib/config', () => ({
  config: {
    agents: { registryContractId: 'agent-registry.testnet' },
    asyncAI: { contractId: 'async-ai.testnet' },
    near: { explorerUrl: 'https://testnet.nearblocks.io' },
    features: { shadeAgents: true },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_TEMPLATE = {
  id: 'tmpl-analysis-v1',
  name: 'Analysis Agent',
  description: 'Analyzes grant proposals',
  version: '1.0.0',
  codehash: 'abc123',
  sourceUrl: 'https://example.com',
  creator: 'alice.testnet',
  capabilities: ['ai-analysis'],
  requiredPermissions: [],
  createdAt: new Date().toISOString(),
  deployments: 5,
  isAudited: false,
};

const MOCK_AGENT = {
  accountId: 'my-agent.alice.testnet',
  ownerAccountId: 'alice.testnet',
  templateId: 'tmpl-analysis-v1',
  codehash: 'abc123',
  name: 'My Analysis Agent',
  status: 'active' as const,
  deployedAt: new Date().toISOString(),
  invocationCount: 42,
  capabilities: ['ai-analysis'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentDashboard', () => {
  beforeEach(() => {
    // Reset to default state before each test
    mockHook.templates = [];
    mockHook.myAgents = [];
    mockHook.activeAgent = null;
    mockHook.isFetching = false;
    mockHook.isDeploying = false;
    mockHook.error = null;
    mockHook.isConnected = true;
    vi.clearAllMocks();
  });

  // 1. Not connected
  it('should show wallet connect prompt when not connected', () => {
    mockHook.isConnected = false;

    render(<AgentDashboard />);

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(
      screen.getByText(/Connect your NEAR wallet/)
    ).toBeInTheDocument();
  });

  // 2. Loading state (no data)
  it('should show skeleton loading when fetching with no data', () => {
    mockHook.isFetching = true;
    mockHook.myAgents = [];
    mockHook.templates = [];

    const { container } = render(<AgentDashboard />);

    // Should render pulse skeleton elements
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // 3. Error state (no data)
  it('should show error with retry when error with no data', () => {
    mockHook.error = 'Network timeout';
    mockHook.myAgents = [];
    mockHook.templates = [];

    render(<AgentDashboard />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  // 4. Empty state (connected, no error, no data)
  it('should show empty state when no agents or templates', () => {
    mockHook.myAgents = [];
    mockHook.templates = [];

    render(<AgentDashboard />);

    expect(screen.getByText('No Agents Yet')).toBeInTheDocument();
    expect(screen.getByText(/registry is empty/)).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  // 5. Full content with tabs
  it('should render full content with tabs when data exists', () => {
    mockHook.templates = [MOCK_TEMPLATE];
    mockHook.myAgents = [MOCK_AGENT];

    render(<AgentDashboard />);

    // Header
    expect(screen.getByText('Shade Agents')).toBeInTheDocument();
    expect(screen.getByText('Deploy Agent')).toBeInTheDocument();

    // Tabs
    expect(screen.getByText(/My Agents/)).toBeInTheDocument();
    expect(screen.getByText(/Agent Registry/)).toBeInTheDocument();
  });

  // Error banner (with data still showing)
  it('should show error banner alongside data when both exist', () => {
    mockHook.templates = [MOCK_TEMPLATE];
    mockHook.myAgents = [MOCK_AGENT];
    mockHook.error = 'Partial fetch failure';

    render(<AgentDashboard />);

    // Both the error banner AND content should be visible
    expect(screen.getByText('Partial fetch failure')).toBeInTheDocument();
    expect(screen.getByText('Shade Agents')).toBeInTheDocument();
  });

  // Templates tab shows when no agents
  it('should show empty agents message when no agents but templates exist', () => {
    mockHook.templates = [MOCK_TEMPLATE];
    mockHook.myAgents = [];

    render(<AgentDashboard />);

    expect(
      screen.getByText(/haven.*deployed any agents yet/)
    ).toBeInTheDocument();
    expect(screen.getByText('Deploy Your First Agent')).toBeInTheDocument();
  });
});
