/**
 * Integration Test: AI Client Pipeline
 *
 * Tests NEARAIClient through MSW-intercepted HTTP responses,
 * including non-streaming chat, streaming SSE, abort, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '@/test';
import { NEARAIClient, resetAIClient } from '@/lib/ai/client';
import { http, HttpResponse } from 'msw';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAIClient();
});
afterAll(() => server.close());

describe('AI Pipeline: NEARAIClient', () => {
  let client: NEARAIClient;

  beforeAll(() => {
    client = new NEARAIClient();
  });

  describe('non-streaming chat', () => {
    it('should receive response and attestation', async () => {
      const result = await client.chat([
        { role: 'user', content: 'Hello, AI!' },
      ]);

      expect(result.content).toBe('This is a test AI response.');
      expect(result.attestation).toBeDefined();
      expect(result.attestation?.tee_type).toBe('intel-tdx');
      expect(result.attestation?.enclave_id).toBe('test-enclave');
    });

    it('should pass model and temperature options', async () => {
      let capturedBody: Record<string, unknown> = {};

      server.use(
        http.post('/api/ai/chat', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'llama-3.3-70b-instruct',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'ok' },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      await client.chat(
        [{ role: 'user', content: 'test' }],
        { model: 'custom-model', temperature: 0.3, maxTokens: 100 }
      );

      expect(capturedBody.model).toBe('custom-model');
      expect(capturedBody.temperature).toBe(0.3);
      expect(capturedBody.max_tokens).toBe(100);
      expect(capturedBody.stream).toBe(false);
    });
  });

  describe('streaming chat', () => {
    it('should fire onToken for each chunk and onComplete at end', async () => {
      const tokens: string[] = [];
      let completedContent = '';
      let completedAttestation: unknown = null;

      await client.chatStream(
        [{ role: 'user', content: 'Stream test' }],
        {
          onToken: (token) => tokens.push(token),
          onComplete: (content, attestation) => {
            completedContent = content;
            completedAttestation = attestation;
          },
          onError: (err) => {
            throw err;
          },
        }
      );

      expect(tokens.length).toBeGreaterThan(0);
      expect(completedContent).toBe('This is a test AI response. ');
      expect(completedAttestation).toBeDefined();
    });
  });

  describe('AbortController cancellation', () => {
    it('should handle abort gracefully without crashing', async () => {
      const abortController = new AbortController();
      const onToken = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      // Abort immediately — in jsdom, AbortSignal may cause a TypeError
      // instead of an AbortError. The client should handle both gracefully.
      abortController.abort();

      await client.chatStream(
        [{ role: 'user', content: 'cancel me' }],
        { onToken, onComplete, onError },
        { abortController }
      );

      // The client should NOT have completed successfully with tokens
      expect(onToken).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw on non-200 response (non-streaming)', async () => {
      server.use(
        http.post('/api/ai/chat', () => {
          return HttpResponse.json(
            { message: 'Rate limit exceeded' },
            { status: 429 }
          );
        })
      );

      await expect(
        client.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should call onError on non-200 response (streaming)', async () => {
      server.use(
        http.post('/api/ai/chat', () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const onError = vi.fn();

      await client.chatStream(
        [{ role: 'user', content: 'test' }],
        {
          onToken: () => {},
          onComplete: () => {},
          onError,
        }
      );

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    });
  });

  describe('JSON extraction from markdown-wrapped responses', () => {
    it('should parse JSON from markdown code block wrapper', async () => {
      const jsonData = { score: 85, summary: 'Good proposal' };
      const markdownWrapped = '```json\n' + JSON.stringify(jsonData) + '\n```';

      server.use(
        http.post('/api/ai/chat', () => {
          return HttpResponse.json({
            id: 'test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'llama-3.3-70b-instruct',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: markdownWrapped },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const result = await client.chat([
        { role: 'user', content: 'Analyze this' },
      ]);

      // Strip markdown code block wrapper (common pattern in the app)
      const stripped = result.content
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
      const parsed = JSON.parse(stripped);

      expect(parsed).toEqual(jsonData);
    });
  });
});
