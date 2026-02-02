/**
 * NEAR AI Cloud Client
 *
 * Handles communication with NEAR AI Cloud API for LLM inference.
 * Supports both streaming and non-streaming chat completions.
 * Extracts TEE attestations from response headers for privacy verification.
 */

import type {
  ChatRequest,
  ChatResponse,
  NEARAIAttestation,
  MessageRole,
} from '@/types/ai';

/** Configuration for NEAR AI Client */
export interface NEARAIClientConfig {
  /** API base URL */
  baseUrl: string;
  /** Default model to use */
  defaultModel?: string;
  /** Default temperature */
  defaultTemperature?: number;
  /** Request timeout in ms */
  timeout?: number;
}

/** Streaming callbacks for chat completions */
export interface StreamCallbacks {
  /** Called for each token received */
  onToken: (token: string) => void;
  /** Called when streaming completes */
  onComplete: (fullContent: string, attestation?: NEARAIAttestation) => void;
  /** Called on error */
  onError: (error: Error) => void;
}

/** Chat completion options */
export interface ChatOptions {
  /** Model to use (overrides default) */
  model?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Abort controller for cancellation */
  abortController?: AbortController;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<NEARAIClientConfig> = {
  baseUrl: process.env.NEXT_PUBLIC_NEAR_AI_API_URL || 'https://api.near.ai',
  defaultModel: 'llama-3.3-70b-instruct',
  defaultTemperature: 0.7,
  timeout: 60000,
};

/**
 * NEAR AI Cloud Client
 *
 * Provides methods for interacting with NEAR AI Cloud's LLM inference API.
 * Supports streaming responses and extracts TEE attestations for privacy verification.
 */
export class NEARAIClient {
  private config: Required<NEARAIClientConfig>;
  private authToken: string | null = null;

  constructor(config: Partial<NEARAIClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set authentication token (NEAR signature)
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Parse TEE attestation from response header
   */
  private parseAttestation(headerValue: string | null): NEARAIAttestation | undefined {
    if (!headerValue) return undefined;

    try {
      // Header is base64-encoded JSON
      const decoded = atob(headerValue);
      const attestation = JSON.parse(decoded) as NEARAIAttestation;
      return attestation;
    } catch (error) {
      console.warn('Failed to parse TEE attestation:', error);
      return undefined;
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    messages: Array<{ role: MessageRole; content: string }>,
    options: ChatOptions = {}
  ): Promise<{ content: string; attestation?: NEARAIAttestation }> {
    const { model, temperature, maxTokens, abortController } = options;

    const request: ChatRequest = {
      messages,
      model: model || this.config.defaultModel,
      temperature: temperature ?? this.config.defaultTemperature,
      max_tokens: maxTokens,
      stream: false,
    };

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
      signal: abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const attestation = this.parseAttestation(
      response.headers.get('X-TEE-Attestation')
    );

    const data: ChatResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';

    return { content, attestation };
  }

  /**
   * Streaming chat completion
   *
   * Uses Server-Sent Events (SSE) to stream tokens in real-time.
   * Calls onToken for each token, onComplete when done, onError on failure.
   */
  async chatStream(
    messages: Array<{ role: MessageRole; content: string }>,
    callbacks: StreamCallbacks,
    options: ChatOptions = {}
  ): Promise<void> {
    const { model, temperature, maxTokens, abortController } = options;

    const request: ChatRequest = {
      messages,
      model: model || this.config.defaultModel,
      temperature: temperature ?? this.config.defaultTemperature,
      max_tokens: maxTokens,
      stream: true,
    };

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `API error: ${response.status}`);
      }

      // Extract attestation from header
      const attestation = this.parseAttestation(
        response.headers.get('X-TEE-Attestation')
      );

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              callbacks.onComplete(fullContent, attestation);
              return;
            }

            try {
              const chunk: ChatResponse = JSON.parse(data);
              const token = chunk.choices[0]?.delta?.content || '';

              if (token) {
                fullContent += token;
                callbacks.onToken(token);
              }
            } catch {
              // Skip malformed JSON chunks
              console.warn('Failed to parse streaming chunk:', data);
            }
          }
        }
      }

      // Final complete callback if stream ended without [DONE]
      callbacks.onComplete(fullContent, attestation);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled - not an error
        return;
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check if AI features are enabled
   */
  isEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES === 'true';
  }

  /**
   * Get the API base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.config.defaultModel;
  }
}

// Singleton instance
let clientInstance: NEARAIClient | null = null;

/**
 * Get the singleton NEAR AI client instance
 */
export function getAIClient(config?: Partial<NEARAIClientConfig>): NEARAIClient {
  if (!clientInstance) {
    clientInstance = new NEARAIClient(config);
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAIClient(): void {
  clientInstance = null;
}
