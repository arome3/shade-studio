/**
 * TEE Attestation Verification API Route
 *
 * Server-side attestation verification endpoint that performs
 * cryptographic signature validation beyond client-side structural checks.
 *
 * POST: Verify an attestation document against the registry codehash.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAttestationChain, type AttestationVerificationResult } from '@/lib/agents/attestation-verifier';
import { getAgentInstance } from '@/lib/agents/registry-client';

// ============================================================================
// Request Validation
// ============================================================================

const verifyRequestSchema = z.object({
  agentAccountId: z.string().min(2).max(64),
  attestation: z.object({
    codehash: z.string().min(1),
    teeType: z.string().min(1),
    attestationDocument: z.string(),
    signature: z.string(),
    timestamp: z.string(),
    verified: z.boolean(),
  }),
});

// ============================================================================
// In-memory verification cache (10 min TTL)
// ============================================================================

interface CachedResult {
  result: AttestationVerificationResult;
  expiresAt: number;
}

const verificationCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(agentAccountId: string, codehash: string, signature: string): string {
  return `${agentAccountId}:${codehash}:${signature.slice(0, 16)}`;
}

// ============================================================================
// POST /api/agents/verify-attestation
// ============================================================================

export async function POST(request: NextRequest) {
  // Feature gate
  if (process.env.NEXT_PUBLIC_ENABLE_SHADE_AGENTS !== 'true') {
    return NextResponse.json(
      { error: 'Shade Agents feature is disabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validation = verifyRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { agentAccountId, attestation } = validation.data;

    // Check cache
    const cacheKey = getCacheKey(agentAccountId, attestation.codehash, attestation.signature);
    const cached = verificationCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result);
    }

    // Fetch the agent's registered codehash
    const instance = await getAgentInstance(agentAccountId);
    if (!instance) {
      return NextResponse.json(
        {
          valid: false,
          level: 'none',
          reason: `Agent instance not found: ${agentAccountId}`,
          warnings: [],
        } satisfies AttestationVerificationResult,
        { status: 200 }
      );
    }

    // Run the full verification chain
    const result = verifyAttestationChain(attestation, instance.codehash);

    // Cache the result
    verificationCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Attestation verification error:', error);

    return NextResponse.json(
      {
        valid: false,
        level: 'none',
        reason: error instanceof Error ? error.message : 'Verification failed',
        warnings: [],
      } satisfies AttestationVerificationResult,
      { status: 500 }
    );
  }
}
