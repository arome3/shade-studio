import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

/**
 * Health check endpoint for monitoring and deployment verification.
 *
 * GET /api/health
 *
 * Returns:
 * - status: "healthy" or "unhealthy"
 * - timestamp: ISO 8601 timestamp
 * - version: Application version
 * - environment: Current environment info
 */
export async function GET() {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: {
        nodeVersion: process.version,
        nearNetwork: config.near.network,
        features: {
          zkProofs: config.features.zkProofs,
          aiFeatures: config.features.aiFeatures,
          dailyBriefings: config.features.dailyBriefings,
        },
      },
    };

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
