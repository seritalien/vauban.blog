import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted so mock values are available inside vi.mock factories
const { mockKeyPair, mockExportedPublicKey, mockFetch, localStorageData } = vi.hoisted(() => {
  const mockKeyPair = {
    publicKey: {} as CryptoKey,
    privateKey: {} as CryptoKey,
  };
  const mockExportedPublicKey = { kty: 'EC', crv: 'P-256', x: 'test', y: 'test' };
  const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
  const localStorageData: Record<string, string> = {};
  return { mockKeyPair, mockExportedPublicKey, mockFetch, localStorageData };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => ({
    address: '0xsender',
    isConnected: true,
  }),
}));

vi.mock('@/lib/crypto', () => ({
  generateKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
  exportPublicKey: vi.fn().mockResolvedValue(mockExportedPublicKey),
  importPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encryptMessage: vi.fn().mockResolvedValue({ encrypted: 'data', nonce: '123' }),
  storeKeyPair: vi.fn().mockResolvedValue(undefined),
  getStoredKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
  getKeyFingerprint: vi.fn().mockResolvedValue('AB:CD:EF'),
}));

vi.mock('@/lib/ipfs-client', () => ({
  uploadJSONToIPFSViaAPI: vi.fn().mockResolvedValue('QmTestCid123'),
}));

vi.mock('@/lib/public-key-registry', () => ({
  publishPublicKey: vi.fn().mockResolvedValue('QmKeyCid'),
}));

vi.mock('@/lib/profiles', () => ({
  saveProfile: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
});

import { useMessaging } from '@/hooks/use-messaging';

describe('useMessaging — notification emission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageData).forEach((k) => delete localStorageData[k]);
  });

  it('emits message:received SSE event after sending a message', async () => {
    const { result } = renderHook(() => useMessaging());

    // Wait for key initialization
    await vi.waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    // Start a conversation
    await act(async () => {
      await result.current.startConversation('0xrecipient', mockExportedPublicKey);
    });

    expect(result.current.currentConversation).not.toBeNull();

    // Send a message
    await act(async () => {
      await result.current.sendMessage('Hello from test!');
    });

    // Verify SSE event was emitted
    expect(mockFetch).toHaveBeenCalledWith('/api/events/emit', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message:received',
        data: {
          conversationId: '0xsender-0xrecipient',
          from: '0xsender',
        },
      }),
    }));
  });

  it('does not fail if SSE emission fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMessaging());

    await vi.waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation('0xrecipient2', mockExportedPublicKey);
    });

    // Should not throw even though fetch fails
    await act(async () => {
      await result.current.sendMessage('This should not fail');
    });

    expect(result.current.error).toBeNull();
  });
});
