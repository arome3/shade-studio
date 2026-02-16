import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Browser-specific mocks — skip when running in Node environment (e.g. E2E ZK tests)
if (typeof window !== 'undefined') {
  // Mock window.matchMedia for components using media queries
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));
}

// Suppress logger noise during tests
process.env.LOG_LEVEL ??= 'error';

// Environment variable stubs — only set if not already defined
process.env.NEXT_PUBLIC_NEAR_NETWORK ??= 'testnet';
process.env.NEXT_PUBLIC_AI_ENDPOINT ??= 'https://api.test.near.ai';
process.env.NEXT_PUBLIC_IPFS_GATEWAY ??= 'https://gateway.pinata.cloud/ipfs';
process.env.NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID ??= 'zk-verifier.testnet';
process.env.NEXT_PUBLIC_ASYNC_AI_CONTRACT_ID ??= 'async-ai.testnet';
process.env.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID ??= 'agent-registry.testnet';
process.env.NEXT_PUBLIC_GRANT_REGISTRY_CONTRACT_ID ??= 'grant-registry.testnet';
process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES ??= 'true';
process.env.NEXT_PUBLIC_ENABLE_ZK_PROOFS ??= 'true';
process.env.NEXT_PUBLIC_ENABLE_IPFS ??= 'true';
process.env.NEXT_PUBLIC_ENABLE_SOCIAL ??= 'true';

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out React 19 specific warnings that are expected in tests
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('ReactDOMTestUtils.act') ||
      message.includes('Warning: ReactDOM.render'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
