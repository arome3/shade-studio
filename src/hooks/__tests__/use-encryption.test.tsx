import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { useEncryption } from '../use-encryption';
import { useEncryptionStore } from '@/stores/encryption-store';
import { KEY_DERIVATION_MESSAGE } from '@/lib/crypto';
import type { EncryptedPayload } from '@/types/document';

// Create mock signature - uses random bytes instead of actual signing
// which requires TextEncoder that behaves differently in test environment
const createMockSignedMessage = () => {
  const signature = nacl.randomBytes(64);
  const publicKey = nacl.randomBytes(32);
  return {
    signature: encodeBase64(signature),
    publicKey: encodeBase64(publicKey),
    accountId: 'test.near',
  };
};

// Mock useWallet hook
const mockSignMessage = vi.fn();
const mockIsConnected = vi.fn(() => true);
const mockAccountId = vi.fn(() => 'test.near');

vi.mock('../use-wallet', () => ({
  useWallet: () => ({
    isConnected: mockIsConnected(),
    accountId: mockAccountId(),
    signMessage: mockSignMessage,
  }),
}));

describe('useEncryption', () => {
  beforeEach(() => {
    // Reset store
    useEncryptionStore.getState().reset();
    vi.clearAllMocks();

    // Default mocks
    mockIsConnected.mockReturnValue(true);
    mockAccountId.mockReturnValue('test.near');
    mockSignMessage.mockResolvedValue(createMockSignedMessage());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return uninitialized status initially', () => {
      const { result } = renderHook(() => useEncryption());

      expect(result.current.status).toBe('uninitialized');
      expect(result.current.isReady).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.keyId).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize encryption successfully', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.isReady).toBe(true);
      expect(result.current.keyId).toBeTruthy();
      expect(mockSignMessage).toHaveBeenCalledWith(KEY_DERIVATION_MESSAGE);
    });

    it('should set initializing status during initialization', async () => {
      // Make signMessage async to capture initializing state
      let resolveSign: (value: ReturnType<typeof createMockSignedMessage>) => void;
      mockSignMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveSign = resolve;
        })
      );

      const { result } = renderHook(() => useEncryption());

      act(() => {
        result.current.initialize();
      });

      expect(result.current.isInitializing).toBe(true);

      await act(async () => {
        resolveSign!(createMockSignedMessage());
      });

      expect(result.current.isReady).toBe(true);
    });

    it('should throw if wallet not connected', async () => {
      mockIsConnected.mockReturnValue(false);
      mockAccountId.mockReturnValue(null as unknown as string);

      const { result } = renderHook(() => useEncryption());

      await expect(
        act(async () => {
          await result.current.initialize();
        })
      ).rejects.toThrow();
    });

    it('should handle user rejection', async () => {
      mockSignMessage.mockRejectedValue(new Error('User rejected request'));

      const { result } = renderHook(() => useEncryption());

      await expect(
        act(async () => {
          await result.current.initialize();
        })
      ).rejects.toThrow();

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });
      expect(result.current.error).toBeTruthy();
    });

    it('should not reinitialize if already ready for same account', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      const firstKeyId = result.current.keyId;
      mockSignMessage.mockClear();

      await act(async () => {
        await result.current.initialize();
      });

      // Should not have called signMessage again
      expect(mockSignMessage).not.toHaveBeenCalled();
      expect(result.current.keyId).toBe(firstKeyId);
    });
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt string', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      const plaintext = 'Hello, World!';
      let encrypted: EncryptedPayload | undefined;

      await act(async () => {
        encrypted = await result.current.encrypt(plaintext);
      });

      expect(encrypted).toBeTruthy();
      expect(encrypted!.ciphertext).toBeTruthy();

      let decrypted: string | undefined;
      await act(async () => {
        decrypted = await result.current.decrypt(encrypted!);
      });

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt object as JSON', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      const data = { name: 'Alice', count: 42 };
      let encrypted: EncryptedPayload | undefined;

      await act(async () => {
        encrypted = await result.current.encrypt(data);
      });

      let decrypted: typeof data | undefined;
      await act(async () => {
        decrypted = await result.current.decrypt<typeof data>(encrypted!);
      });

      expect(decrypted).toEqual(data);
    });

    it('should throw if not initialized', async () => {
      const { result } = renderHook(() => useEncryption());

      await expect(
        act(async () => {
          await result.current.encrypt('test');
        })
      ).rejects.toThrow();
    });
  });

  describe('encryptFileData / decryptFileData', () => {
    // Note: File.arrayBuffer() is not available in jsdom, so we skip full round-trip test
    it.skip('should encrypt and decrypt file', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      const content = new Uint8Array([1, 2, 3, 4, 5]);
      const file = new File([content], 'test.bin', { type: 'application/octet-stream' });

      let encrypted: { payload: EncryptedPayload; metadata: { name: string; type: string; size: number; lastModified: number } } | undefined;
      await act(async () => {
        encrypted = await result.current.encryptFileData(file);
      });

      expect(encrypted!.metadata.name).toBe('test.bin');

      let decrypted: File | undefined;
      await act(async () => {
        decrypted = await result.current.decryptFileData(
          encrypted!.payload,
          encrypted!.metadata
        );
      });

      const decryptedContent = new Uint8Array(await decrypted!.arrayBuffer());
      expect(decryptedContent).toEqual(content);
    });

    it('should throw if not initialized', async () => {
      const { result } = renderHook(() => useEncryption());
      const file = new File(['test'], 'test.txt');

      await expect(
        act(async () => {
          await result.current.encryptFileData(file);
        })
      ).rejects.toThrow();
    });
  });

  describe('lock', () => {
    it('should lock encryption and clear keys', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isReady).toBe(true);

      act(() => {
        result.current.lock();
      });

      expect(result.current.status).toBe('locked');
      expect(result.current.isReady).toBe(false);
    });

    it('should prevent encryption after lock', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.lock();
      });

      await expect(
        act(async () => {
          await result.current.encrypt('test');
        })
      ).rejects.toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should correctly identify encrypted payloads', async () => {
      const { result } = renderHook(() => useEncryption());

      await act(async () => {
        await result.current.initialize();
      });

      let encrypted;
      await act(async () => {
        encrypted = await result.current.encrypt('test');
      });

      expect(result.current.isEncrypted(encrypted)).toBe(true);
      expect(result.current.isEncrypted(null)).toBe(false);
      expect(result.current.isEncrypted('string')).toBe(false);
      expect(result.current.isEncrypted({ foo: 'bar' })).toBe(false);
    });
  });

  describe('deterministic key derivation', () => {
    it('should derive same keys for same signature', async () => {
      const signedMessage = createMockSignedMessage();
      mockSignMessage.mockResolvedValue(signedMessage);

      const { result: result1 } = renderHook(() => useEncryption());

      await act(async () => {
        await result1.current.initialize();
      });

      const keyId1 = result1.current.keyId;

      // Encrypt something
      let encrypted: EncryptedPayload | undefined;
      await act(async () => {
        encrypted = await result1.current.encrypt('secret');
      });

      // Simulate page refresh (reset store, new hook instance)
      useEncryptionStore.getState().reset();
      mockSignMessage.mockResolvedValue(signedMessage);

      const { result: result2 } = renderHook(() => useEncryption());

      await act(async () => {
        await result2.current.initialize();
      });

      expect(result2.current.keyId).toBe(keyId1);

      // Should be able to decrypt with re-derived keys
      let decrypted: string | undefined;
      await act(async () => {
        decrypted = await result2.current.decrypt(encrypted!);
      });

      expect(decrypted).toBe('secret');
    });
  });
});
