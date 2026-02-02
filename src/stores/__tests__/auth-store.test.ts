import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../auth-store';
import { WalletError, WalletErrorCode } from '@/lib/near/errors';

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

describe('auth-store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.getState().reset();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have disconnected status by default', () => {
      const state = useAuthStore.getState();
      expect(state.status).toBe('disconnected');
    });

    it('should have null accountId by default', () => {
      const state = useAuthStore.getState();
      expect(state.accountId).toBeNull();
    });

    it('should have null walletType by default', () => {
      const state = useAuthStore.getState();
      expect(state.walletType).toBeNull();
    });

    it('should have null error by default', () => {
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it('should have 0 connection attempts by default', () => {
      const state = useAuthStore.getState();
      expect(state.connectionAttempts).toBe(0);
    });
  });

  describe('setConnecting', () => {
    it('should transition to connecting status', () => {
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().status).toBe('connecting');
    });

    it('should clear any existing error', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should increment connection attempts', () => {
      expect(useAuthStore.getState().connectionAttempts).toBe(0);
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().connectionAttempts).toBe(1);
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().connectionAttempts).toBe(2);
    });
  });

  describe('setConnected', () => {
    it('should transition to connected status', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().status).toBe('connected');
    });

    it('should store accountId', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().accountId).toBe('test.near');
    });

    it('should store walletType', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().walletType).toBe('my-near-wallet');
    });

    it('should clear any existing error', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should set lastConnectedAt timestamp', () => {
      const before = Date.now();
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      const after = Date.now();

      const lastConnectedAt = useAuthStore.getState().lastConnectedAt;
      expect(lastConnectedAt).toBeGreaterThanOrEqual(before);
      expect(lastConnectedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('setDisconnected', () => {
    it('should transition to disconnected status', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      useAuthStore.getState().setDisconnected();
      expect(useAuthStore.getState().status).toBe('disconnected');
    });

    it('should clear accountId', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      useAuthStore.getState().setDisconnected();
      expect(useAuthStore.getState().accountId).toBeNull();
    });

    it('should clear walletType', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      useAuthStore.getState().setDisconnected();
      expect(useAuthStore.getState().walletType).toBeNull();
    });

    it('should clear error', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().setDisconnected();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setReconnecting', () => {
    it('should transition to reconnecting status', () => {
      useAuthStore.getState().setReconnecting();
      expect(useAuthStore.getState().status).toBe('reconnecting');
    });

    it('should clear error', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().setReconnecting();
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should preserve accountId if set', () => {
      // Simulate persisted state scenario
      useAuthStore.setState({ accountId: 'test.near' });
      useAuthStore.getState().setReconnecting();
      expect(useAuthStore.getState().accountId).toBe('test.near');
    });
  });

  describe('setError', () => {
    it('should transition to error status', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      expect(useAuthStore.getState().status).toBe('error');
    });

    it('should store the error', () => {
      const error = new WalletError(WalletErrorCode.USER_REJECTED);
      useAuthStore.getState().setError(error);
      expect(useAuthStore.getState().error).toBe(error);
    });
  });

  describe('clearError', () => {
    it('should clear the error', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should not change the status', () => {
      useAuthStore.getState().setError(new WalletError(WalletErrorCode.UNKNOWN));
      useAuthStore.getState().clearError();
      // Status remains 'error' until explicitly changed
      expect(useAuthStore.getState().status).toBe('error');
    });
  });

  describe('resetConnectionAttempts', () => {
    it('should reset connection attempts to 0', () => {
      useAuthStore.getState().setConnecting();
      useAuthStore.getState().setConnecting();
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().connectionAttempts).toBe(3);

      useAuthStore.getState().resetConnectionAttempts();
      expect(useAuthStore.getState().connectionAttempts).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      useAuthStore.getState().setConnecting();
      useAuthStore.getState().reset();

      const state = useAuthStore.getState();
      expect(state.status).toBe('disconnected');
      expect(state.accountId).toBeNull();
      expect(state.walletType).toBeNull();
      expect(state.error).toBeNull();
      expect(state.connectionAttempts).toBe(0);
    });
  });

  describe('state transitions', () => {
    it('should follow connecting → connected flow', () => {
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().status).toBe('connecting');

      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().status).toBe('connected');
    });

    it('should follow connecting → error flow', () => {
      useAuthStore.getState().setConnecting();
      expect(useAuthStore.getState().status).toBe('connecting');

      useAuthStore.getState().setError(new WalletError(WalletErrorCode.USER_REJECTED));
      expect(useAuthStore.getState().status).toBe('error');
    });

    it('should follow reconnecting → connected flow', () => {
      useAuthStore.getState().setReconnecting();
      expect(useAuthStore.getState().status).toBe('reconnecting');

      useAuthStore.getState().setConnected('test.near', 'my-near-wallet');
      expect(useAuthStore.getState().status).toBe('connected');
    });

    it('should follow reconnecting → disconnected flow (session expired)', () => {
      useAuthStore.getState().setReconnecting();
      expect(useAuthStore.getState().status).toBe('reconnecting');

      useAuthStore.getState().setDisconnected();
      expect(useAuthStore.getState().status).toBe('disconnected');
    });
  });
});
