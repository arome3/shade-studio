/**
 * MSW v2 request handlers for test HTTP interception.
 *
 * Covers three subsystems:
 * - IPFS (upload/download/delete via /api/ipfs)
 * - AI Chat (non-streaming + streaming via /api/ai/chat)
 * - NEAR RPC (JSON-RPC view_call via rpc.testnet.near.org)
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// IPFS Handlers
// ============================================================================

let ipfsStore: Record<string, ArrayBuffer> = {};
let cidCounter = 0;

export function resetIPFSStore() {
  ipfsStore = {};
  cidCounter = 0;
}

const ipfsHandlers = [
  // Upload — accepts both FormData and JSON/raw body
  // (jsdom's FormData doesn't serialize properly through MSW)
  http.post('/api/ipfs', async ({ request }) => {
    let buffer: ArrayBuffer;

    try {
      const contentType = request.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        // JSON body (used in test helpers)
        const text = await request.text();
        buffer = new TextEncoder().encode(text).buffer as ArrayBuffer;
      } else if (contentType.includes('multipart/form-data')) {
        // FormData body (used by IPFSClient)
        const formData = await request.formData();
        const file = formData.get('file') as Blob | null;
        if (!file) {
          return HttpResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        buffer = await file.arrayBuffer();
      } else {
        // Raw body fallback
        buffer = await request.arrayBuffer();
      }
    } catch {
      // Fallback: read as raw body if FormData parsing fails (jsdom compat)
      try {
        const cloned = request.clone();
        buffer = await cloned.arrayBuffer();
      } catch {
        return HttpResponse.json({ error: 'Failed to read upload body' }, { status: 400 });
      }
    }

    const cid = `QmTest${String(++cidCounter).padStart(40, 'a')}hash`;
    ipfsStore[cid] = buffer;

    return HttpResponse.json({
      cid,
      size: buffer.byteLength,
      timestamp: new Date().toISOString(),
    });
  }),

  // Download
  http.get('/api/ipfs', ({ request }) => {
    const url = new URL(request.url);
    const cid = url.searchParams.get('cid');

    if (!cid || !ipfsStore[cid]) {
      return HttpResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return new HttpResponse(ipfsStore[cid], {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }),

  // Delete (unpin)
  http.delete('/api/ipfs', ({ request }) => {
    const url = new URL(request.url);
    const cid = url.searchParams.get('cid');

    if (!cid) {
      return HttpResponse.json({ error: 'Missing CID' }, { status: 400 });
    }

    delete ipfsStore[cid];
    return HttpResponse.json({ success: true });
  }),
];

// ============================================================================
// AI Chat Handlers
// ============================================================================

const DEFAULT_AI_RESPONSE = 'This is a test AI response.';

const aiHandlers = [
  http.post('/api/ai/chat', async ({ request }) => {
    const body = (await request.json()) as { stream?: boolean; messages?: unknown[] };
    const attestationHeader = btoa(
      JSON.stringify({
        version: '1.0',
        tee_type: 'intel-tdx',
        enclave_id: 'test-enclave',
        code_hash: 'abc123',
        timestamp: new Date().toISOString(),
        quote: 'dGVzdC1xdW90ZQ==',
      })
    );

    // Streaming response
    if (body.stream) {
      const tokens = DEFAULT_AI_RESPONSE.split(' ');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const token of tokens) {
            const chunk = JSON.stringify({
              id: 'chatcmpl-test',
              object: 'chat.completion.chunk',
              created: Date.now(),
              model: 'llama-3.3-70b-instruct',
              choices: [
                {
                  index: 0,
                  delta: { content: token + ' ' },
                  finish_reason: null,
                },
              ],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new HttpResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'X-TEE-Attestation': attestationHeader,
        },
      });
    }

    // Non-streaming response
    return HttpResponse.json(
      {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama-3.3-70b-instruct',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: DEFAULT_AI_RESPONSE },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      },
      {
        headers: {
          'X-TEE-Attestation': attestationHeader,
        },
      }
    );
  }),
];

// ============================================================================
// NEAR RPC Handlers
// ============================================================================

const nearRpcHandlers = [
  http.post('https://rpc.testnet.near.org', async ({ request }) => {
    const body = (await request.json()) as {
      method: string;
      params?: { request_type?: string; method_name?: string };
    };

    // Default view_call response
    if (body.method === 'query' && body.params?.request_type === 'call_function') {
      const methodName = body.params.method_name ?? '';
      let resultValue: unknown = {};

      if (methodName === 'get_credentials') {
        resultValue = { credentials: [], total: 0, has_more: false };
      } else if (methodName === 'get_stats') {
        resultValue = {
          total_verifications: 0,
          total_credentials: 0,
          is_paused: false,
          verification_keys_registered: 3,
        };
      }

      const resultBytes = Array.from(
        new TextEncoder().encode(JSON.stringify(resultValue))
      );

      return HttpResponse.json({
        jsonrpc: '2.0',
        id: 'test',
        result: {
          result: resultBytes,
          logs: [],
          block_height: 100000000,
          block_hash: 'test-block-hash',
        },
      });
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: 'test',
      result: {},
    });
  }),
];

// ============================================================================
// Combined Handlers
// ============================================================================

export const handlers = [...ipfsHandlers, ...aiHandlers, ...nearRpcHandlers];
