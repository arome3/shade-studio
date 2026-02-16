import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { getLogger } from '@/lib/logger';

interface CheckResult {
  status: 'pass' | 'fail';
  latencyMs: number;
  message?: string;
}

const CHECK_TIMEOUT_MS = 3000;

async function checkNearRpc(): Promise<CheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(config.near.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'health', method: 'status', params: [] }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: 'fail', latencyMs: Date.now() - start, message: `HTTP ${res.status}` };
    }

    return { status: 'pass', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkIpfsGateway(): Promise<CheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    // Probe gateway root to verify reachability (401/403 is fine — means the server is up)
    const gatewayOrigin = new URL(config.ipfs.gatewayUrl).origin;
    await fetch(gatewayOrigin, {
      method: 'HEAD',
      signal: controller.signal,
    });

    // Any response (including 401/403) means the gateway is reachable
    return { status: 'pass', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Health check endpoint for monitoring and deployment verification.
 *
 * GET /api/health
 *
 * Returns:
 * - status: "healthy" | "degraded" | "unhealthy"
 * - timestamp: ISO 8601 timestamp
 * - version, buildId, environment info
 * - checks: external dependency health results
 */
export async function GET() {
  const logger = getLogger();

  try {
    const [nearResult, ipfsResult] = await Promise.all([
      checkNearRpc(),
      checkIpfsGateway(),
    ]);

    const allPassed = nearResult.status === 'pass' && ipfsResult.status === 'pass';
    const status = allPassed ? 'healthy' : 'degraded';

    if (status === 'degraded') {
      logger.warn('Health check degraded', {
        nearRpc: nearResult.status,
        ipfsGateway: ipfsResult.status,
      });
    }

    const healthData = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'local',
      environment: {
        nodeVersion: process.version,
        nearNetwork: config.near.network,
        features: {
          zkProofs: config.features.zkProofs,
          aiFeatures: config.features.aiFeatures,
          dailyBriefings: config.features.dailyBriefings,
          asyncAI: config.features.asyncAI,
          shadeAgents: config.features.shadeAgents,
          grantRegistry: config.features.grantRegistry,
        },
      },
      checks: {
        nearRpc: nearResult,
        ipfsGateway: ipfsResult,
      },
    };

    return NextResponse.json(healthData, {
      status: allPassed ? 200 : 207,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }
}
