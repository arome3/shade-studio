import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing the route
vi.mock('@/lib/config', () => ({
  config: {
    near: {
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
    },
    ipfs: {
      gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
    },
    features: {
      zkProofs: true,
      aiFeatures: true,
      dailyBriefings: true,
      asyncAI: true,
      shadeAgents: true,
      grantRegistry: true,
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('GET /api/health', () => {
  let GET: typeof import('../route').GET;
  let fetchSpy: any;

  beforeEach(async () => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_APP_VERSION = '0.1.0';
    process.env.NEXT_PUBLIC_BUILD_ID = 'abc1234';

    const mod = await import('../route');
    GET = mod.GET;

    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return healthy when all checks pass', async () => {
    fetchSpy.mockResolvedValue(new Response('OK', { status: 200 }));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.nearRpc.status).toBe('pass');
    expect(data.checks.ipfsGateway.status).toBe('pass');
  });

  it('should return degraded when NEAR RPC is down', async () => {
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('rpc.testnet.near.org')) {
        throw new Error('Connection refused');
      }
      return new Response('OK', { status: 200 });
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.status).toBe('degraded');
    expect(data.checks.nearRpc.status).toBe('fail');
    expect(data.checks.nearRpc.message).toBeDefined();
    expect(data.checks.ipfsGateway.status).toBe('pass');
  });

  it('should return degraded when IPFS gateway is down', async () => {
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('gateway.pinata.cloud')) {
        throw new Error('Gateway timeout');
      }
      return new Response('OK', { status: 200 });
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.status).toBe('degraded');
    expect(data.checks.nearRpc.status).toBe('pass');
    expect(data.checks.ipfsGateway.status).toBe('fail');
  });

  it('should handle HTTP error responses as failures', async () => {
    fetchSpy.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.status).toBe('degraded');
    expect(data.checks.nearRpc.status).toBe('fail');
    expect(data.checks.nearRpc.message).toBe('HTTP 500');
  });

  it('should include version, buildId, and feature flags', async () => {
    fetchSpy.mockResolvedValue(new Response('OK', { status: 200 }));

    const res = await GET();
    const data = await res.json();

    expect(data.version).toBe('0.1.0');
    expect(data.buildId).toBe('abc1234');
    expect(data.environment.nearNetwork).toBe('testnet');
    expect(data.environment.features).toEqual({
      zkProofs: true,
      aiFeatures: true,
      dailyBriefings: true,
      asyncAI: true,
      shadeAgents: true,
      grantRegistry: true,
    });
  });

  it('should include latencyMs in check results', async () => {
    fetchSpy.mockResolvedValue(new Response('OK', { status: 200 }));

    const res = await GET();
    const data = await res.json();

    expect(typeof data.checks.nearRpc.latencyMs).toBe('number');
    expect(data.checks.nearRpc.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof data.checks.ipfsGateway.latencyMs).toBe('number');
  });

  it('should include timestamp in ISO 8601 format', async () => {
    fetchSpy.mockResolvedValue(new Response('OK', { status: 200 }));

    const res = await GET();
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  it('should set Cache-Control no-store header', async () => {
    fetchSpy.mockResolvedValue(new Response('OK', { status: 200 }));

    const res = await GET();

    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });
});
