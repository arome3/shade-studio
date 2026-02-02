/**
 * AI Chat API Route
 *
 * Proxies chat requests to NEAR AI Cloud and forwards responses
 * including TEE attestation headers. Supports both streaming and
 * non-streaming responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Request validation schema
const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  stream: z.boolean().optional(),
});

// NEAR AI Cloud API configuration
const NEAR_AI_API_URL =
  process.env.NEXT_PUBLIC_NEAR_AI_API_URL || 'https://api.near.ai';
const NEAR_AI_API_KEY = process.env.NEAR_AI_API_KEY || '';

/**
 * POST /api/ai/chat
 *
 * Forwards chat requests to NEAR AI Cloud and returns responses
 * with TEE attestation headers preserved.
 */
export async function POST(request: NextRequest) {
  // Check if AI features are enabled
  if (process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== 'true') {
    return NextResponse.json(
      { error: 'AI features are disabled' },
      { status: 403 }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = chatRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { messages, model, temperature, max_tokens, stream } =
      validationResult.data;

    // Forward authorization header if present
    const authHeader = request.headers.get('Authorization');

    // Build headers for NEAR AI request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    if (NEAR_AI_API_KEY) {
      headers['X-API-Key'] = NEAR_AI_API_KEY;
    }

    // Make request to NEAR AI Cloud
    const nearAIResponse = await fetch(
      `${NEAR_AI_API_URL}/v1/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          model: model || 'llama-3.3-70b-instruct',
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens || 2048,
          stream: stream ?? true,
        }),
      }
    );

    if (!nearAIResponse.ok) {
      const errorText = await nearAIResponse.text();
      let errorMessage = 'AI service error';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: nearAIResponse.status }
      );
    }

    // Extract TEE attestation header
    const attestationHeader = nearAIResponse.headers.get('X-TEE-Attestation');

    // Handle streaming response
    if (stream) {
      const responseHeaders: HeadersInit = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      };

      if (attestationHeader) {
        responseHeaders['X-TEE-Attestation'] = attestationHeader;
      }

      // Create a TransformStream to forward the SSE data
      const { readable, writable } = new TransformStream();

      // Start forwarding the stream
      (async () => {
        const reader = nearAIResponse.body?.getReader();
        const writer = writable.getWriter();

        if (!reader) {
          await writer.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, { headers: responseHeaders });
    }

    // Handle non-streaming response
    const data = await nearAIResponse.json();

    const responseHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (attestationHeader) {
      responseHeaders['X-TEE-Attestation'] = attestationHeader;
    }

    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error) {
    console.error('AI chat error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat
 *
 * Returns API status and configuration.
 */
export async function GET() {
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true';

  return NextResponse.json({
    status: isEnabled ? 'available' : 'disabled',
    provider: 'NEAR AI Cloud',
    models: [
      'llama-3.3-70b-instruct',
      'llama-3.1-8b-instruct',
      'qwen-2.5-72b-instruct',
    ],
    features: {
      streaming: true,
      teeAttestation: true,
    },
  });
}
