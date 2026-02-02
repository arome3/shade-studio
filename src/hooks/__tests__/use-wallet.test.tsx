import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWallet } from '../use-wallet';
import { useAuthStore } from '@/stores/auth-store';

// Mock the NEAR wallet modules
vi.mock('@/lib/near', async () => {
  const actual = await vi.importActual('@/lib/near/errors');
  return {
    ...actual,
    initWalletSelector: vi.fn(),
    getWalletSelector: vi.fn(),
    showWalletModal: vi.fn(),
    trackWalletEvent: vi.fn(),
  };
});

// Import mocked modules
import {
  initWalletSelector,
  getWalletSelector,
  showWalletModal,
} from '@/lib/near';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create mock wallet selector
const createMockSelector = (accounts: Array<{ accountId: string }> = []) => {
  const subscribers: Array<(state: unknown) => void> = [];
  return {
    store: {
      getState: () => ({
        accounts,
        selectedWalletId: accounts.length > 0 ? 'my-near-wallet' : null,
      }),
      observable: {
        subscribe: (callback: (state: unknown) => void) => {
          subscribers.push(callback);
          // Immediately call with current state
          callback({
            accounts,
            selectedWalletId: accounts.length > 0 ? 'my-near-wallet' : null,
          });
          return {
            unsubscribe: () => {
              const index = subscribers.indexOf(callback);
              if (index > -1) subscribers.splice(index, 1);
            },
          };
        },
      },
    },
    wallet: vi.fn().mockResolvedValue({
      signOut: vi.fn().mockResolvedValue(undefined),
      signMessage: vi.fn(),
    }),
    _notifySubscribers: (state: unknown) => {
      subscribers.forEach((sub) => sub(state));
    },
  };
};

describe('useWallet', () => {
  let mockSelector: ReturnType<typeof createMockSelector>;

  beforeEach(() => {
    // Reset store
    useAuthStore.getState().reset();
    localStorageMock.clear();
    vi.clearAllMocks();

    // Setup default mock selector
    mockSelector = createMockSelector();
    vi.mocked(initWalletSelector).mockResolvedValue(mockSelector as never);
    vi.mocked(getWalletSelector).mockReturnValue(mockSelector as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return disconnected status initially', async () => {
      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('should have null accountId initially', async () => {
      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.accountId).toBeNull();
    });

    it('should initialize wallet selector on mount', async () => {
      renderHook(() => useWallet());

      await waitFor(() => {
        expect(initWalletSelector).toHaveBeenCalled();
      });
    });
  });

  describe('connect', () => {
    it('should show wallet modal when connect is called', async () => {
      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(showWalletModal).toHaveBeenCalled();
    });

    it('should set connecting status when connect is called', async () => {
      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.connect();
      });

      expect(result.current.isConnecting).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect wallet successfully', async () => {
      // Start with connected state
      mockSelector = createMockSelector([{ accountId: 'test.near' }]);
      vi.mocked(initWalletSelector).mockResolvedValue(mockSelector as never);
      vi.mocked(getWalletSelector).mockReturnValue(mockSelector as never);

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await act(async () => {
        await result.current.disconnect();
      });

      expect(result.current.status).toBe('disconnected');
      expect(result.current.accountId).toBeNull();
    });

    it('should throw when selector is not initialized', async () => {
      vi.mocked(getWalletSelector).mockReturnValue(null);

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await expect(result.current.disconnect()).rejects.toThrow();
    });
  });

  describe('auto-reconnect', () => {
    it('should reconnect when persisted accountId matches selector accounts', async () => {
      // Set up persisted state
      useAuthStore.setState({
        accountId: 'test.near',
        status: 'reconnecting',
      });

      // Set up selector with matching account
      mockSelector = createMockSelector([{ accountId: 'test.near' }]);
      vi.mocked(initWalletSelector).mockResolvedValue(mockSelector as never);
      vi.mocked(getWalletSelector).mockReturnValue(mockSelector as never);

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.accountId).toBe('test.near');
    });

    it('should disconnect when persisted accountId does not match selector', async () => {
      // Set up persisted state
      useAuthStore.setState({
        accountId: 'old-account.near',
        status: 'reconnecting',
      });

      // Set up selector with no accounts
      mockSelector = createMockSelector([]);
      vi.mocked(initWalletSelector).mockResolvedValue(mockSelector as never);

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.status).toBe('disconnected');
      });
    });
  });

  describe('derived state', () => {
    it('should correctly compute isConnected', async () => {
      mockSelector = createMockSelector([{ accountId: 'test.near' }]);
      vi.mocked(initWalletSelector).mockResolvedValue(mockSelector as never);
      vi.mocked(getWalletSelector).mockReturnValue(mockSelector as never);

      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should correctly compute isConnecting for connecting status', async () => {
      const { result } = renderHook(() => useWallet());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.connect();
      });

      expect(result.current.isConnecting).toBe(true);
    });
  });
});
