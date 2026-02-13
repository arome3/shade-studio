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
