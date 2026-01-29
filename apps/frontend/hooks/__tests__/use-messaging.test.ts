import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { walletState, cryptoMocks, ipfsMocks, mockExportedPublicKey, mockFingerprint, mockKeyPair } = vi.hoisted(() => {
  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    isConnected: true,
  };

  const mockKeyPair = {
    publicKey: { type: 'public' } as unknown as CryptoKey,
    privateKey: { type: 'private' } as unknown as CryptoKey,
  };

  const mockExportedPublicKey = { x: 'base64x', y: 'base64y' };
  const mockFingerprint = 'AB:CD:EF:01:23:45:67:89';
  const mockEncrypted = {
    ciphertext: 'encrypted_base64',
    iv: 'iv_base64',
    senderPublicKey: mockExportedPublicKey,
  };

  const cryptoMocks = {
    generateKeyPair: vi.fn().mockResolvedValue(mockKeyPair),
    exportPublicKey: vi.fn().mockResolvedValue(mockExportedPublicKey),
    importPublicKey: vi.fn().mockResolvedValue({ type: 'imported' } as unknown as CryptoKey),
    encryptMessage: vi.fn().mockResolvedValue(mockEncrypted),
    storeKeyPair: vi.fn().mockResolvedValue(undefined),
    getStoredKeyPair: vi.fn().mockResolvedValue(null),
    getKeyFingerprint: vi.fn().mockResolvedValue(mockFingerprint),
  };

  let cidCounter = 0;
  const ipfsMocks = {
    uploadJSONToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(`QmMockCid${++cidCounter}`)),
    uploadFileToIPFSViaAPI: vi.fn(),
    uploadTextToIPFSViaAPI: vi.fn(),
    fetchJSONFromIPFSViaAPI: vi.fn().mockResolvedValue({ content: 'test' }),
    fetchTextFromIPFSViaAPI: vi.fn().mockResolvedValue('test'),
    getIPFSGatewayUrl: vi.fn((cid: string) => `/api/ipfs/${cid}`),
    checkIPFSAvailable: vi.fn().mockResolvedValue(true),
  };

  return { walletState, cryptoMocks, ipfsMocks, mockExportedPublicKey, mockFingerprint, mockKeyPair };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/lib/crypto', () => cryptoMocks);

vi.mock('@/lib/ipfs-client', () => ipfsMocks);

vi.mock('@/lib/public-key-registry', () => ({
  publishPublicKey: vi.fn().mockResolvedValue('QmPublicKeyCid'),
}));

vi.mock('@/lib/profiles', () => ({
  saveProfile: vi.fn(),
}));

// Import hook after mocks
import { useMessaging } from '@/hooks/use-messaging';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALICE_ADDRESS = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
const BOB_ADDRESS = '0x00B0B0000000000000000000000000000000000000000000000000000000002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setWalletConnected(connected: boolean) {
  if (connected) {
    walletState.address = ALICE_ADDRESS;
    walletState.isConnected = true;
  } else {
    walletState.address = null;
    walletState.isConnected = false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setWalletConnected(true);
  cryptoMocks.getStoredKeyPair.mockResolvedValue(null);
  cryptoMocks.generateKeyPair.mockResolvedValue(mockKeyPair);
  cryptoMocks.exportPublicKey.mockResolvedValue(mockExportedPublicKey);
  cryptoMocks.getKeyFingerprint.mockResolvedValue(mockFingerprint);
  cryptoMocks.storeKeyPair.mockResolvedValue(undefined);
  cryptoMocks.encryptMessage.mockResolvedValue({
    ciphertext: 'encrypted_base64',
    iv: 'iv_base64',
    senderPublicKey: mockExportedPublicKey,
  });
  cryptoMocks.importPublicKey.mockResolvedValue({ type: 'imported' } as unknown as CryptoKey);

  let cidCounter = 0;
  ipfsMocks.uploadJSONToIPFSViaAPI.mockImplementation(
    () => Promise.resolve(`QmMockCid${++cidCounter}`),
  );

  localStorage.clear();
});

// ============================
// Key initialization
// ============================

describe('useMessaging - key initialization', () => {
  it('auto-initializes keys when connected', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.keyPair).not.toBeNull();
    });

    expect(cryptoMocks.generateKeyPair).toHaveBeenCalledOnce();
    expect(cryptoMocks.storeKeyPair).toHaveBeenCalledWith(ALICE_ADDRESS, mockKeyPair);
  });

  it('loads existing keys from store instead of generating new ones', async () => {
    cryptoMocks.getStoredKeyPair.mockResolvedValue(mockKeyPair);

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    expect(cryptoMocks.generateKeyPair).not.toHaveBeenCalled();
    expect(cryptoMocks.storeKeyPair).not.toHaveBeenCalled();
  });

  it('generates new keys when none are stored', async () => {
    cryptoMocks.getStoredKeyPair.mockResolvedValue(null);

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    expect(cryptoMocks.generateKeyPair).toHaveBeenCalledOnce();
    expect(cryptoMocks.storeKeyPair).toHaveBeenCalledOnce();
  });

  it('exports the public key after initialization', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.publicKey).not.toBeNull();
    });

    expect(result.current.publicKey).toEqual(mockExportedPublicKey);
    expect(cryptoMocks.exportPublicKey).toHaveBeenCalledWith(mockKeyPair.publicKey);
  });

  it('generates fingerprint after initialization', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.fingerprint).not.toBeNull();
    });

    expect(result.current.fingerprint).toBe(mockFingerprint);
    expect(cryptoMocks.getKeyFingerprint).toHaveBeenCalledWith(mockKeyPair.publicKey);
  });

  it('sets error when key initialization fails', async () => {
    cryptoMocks.getStoredKeyPair.mockRejectedValue(new Error('IndexedDB error'));

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(result.current.error).toBe('Failed to initialize encryption keys');
    expect(result.current.keyPair).toBeNull();
  });
});

// ============================
// Conversations
// ============================

describe('useMessaging - conversations', () => {
  it('loads conversations from localStorage on address change', async () => {
    const conversations = [
      {
        id: `${ALICE_ADDRESS}-${BOB_ADDRESS}`,
        participant: BOB_ADDRESS,
        participantPublicKey: mockExportedPublicKey,
        unreadCount: 2,
        updatedAt: Date.now(),
      },
    ];
    localStorage.setItem(
      `vauban-conversations-${ALICE_ADDRESS}`,
      JSON.stringify(conversations),
    );

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(result.current.conversations[0].participant).toBe(BOB_ADDRESS);
  });

  it('saves conversations to localStorage when they change', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation(BOB_ADDRESS, mockExportedPublicKey);
    });

    const stored = localStorage.getItem(`vauban-conversations-${ALICE_ADDRESS}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].participant).toBe(BOB_ADDRESS);
  });

  it('handles corrupted localStorage data gracefully', async () => {
    localStorage.setItem(
      `vauban-conversations-${ALICE_ADDRESS}`,
      'not valid json {{{',
    );

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    // Should not crash, conversations should remain empty
    expect(result.current.conversations).toEqual([]);
  });
});

// ============================
// sendMessage
// ============================

describe('useMessaging - sendMessage', () => {
  async function setupConversation() {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation(BOB_ADDRESS, mockExportedPublicKey);
    });

    return result;
  }

  it('encrypts with recipient key and uploads to IPFS', async () => {
    const result = await setupConversation();

    await act(async () => {
      await result.current.sendMessage('Hello Bob!');
    });

    expect(cryptoMocks.importPublicKey).toHaveBeenCalledWith(mockExportedPublicKey);
    expect(cryptoMocks.encryptMessage).toHaveBeenCalledWith(
      'Hello Bob!',
      mockKeyPair.privateKey,
      mockKeyPair.publicKey,
      expect.anything(), // imported recipient key
    );
    expect(ipfsMocks.uploadJSONToIPFSViaAPI).toHaveBeenCalledOnce();
  });

  it('updates local messages state', async () => {
    const result = await setupConversation();

    await act(async () => {
      await result.current.sendMessage('Hello Bob!');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello Bob!');
    expect(result.current.messages[0].from).toBe(ALICE_ADDRESS);
    expect(result.current.messages[0].to).toBe(BOB_ADDRESS);
    expect(result.current.messages[0].status).toBe('sent');
  });

  it('sets isSending during send operation', async () => {
    const result = await setupConversation();

    // Track isSending states during execution
    const sendingStates: boolean[] = [];
    ipfsMocks.uploadJSONToIPFSViaAPI.mockImplementationOnce(async (_data: unknown) => {
      sendingStates.push(true); // Should be true during upload
      return 'QmSent1';
    });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    // isSending was true during the upload
    expect(sendingStates).toContain(true);
    // After completion, isSending is false
    expect(result.current.isSending).toBe(false);
  });

  it('sets error when encryption fails', async () => {
    const result = await setupConversation();

    cryptoMocks.encryptMessage.mockRejectedValueOnce(new Error('Encryption failed'));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Failed to send message');
  });

  it('sets error when not initialized (no keyPair or currentConversation)', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Cannot send message: not initialized');
  });
});

// ============================
// selectConversation
// ============================

describe('useMessaging - selectConversation', () => {
  it('loads messages from localStorage and sets currentConversation', async () => {
    const convId = `${ALICE_ADDRESS}-${BOB_ADDRESS}`;
    const conversations = [
      {
        id: convId,
        participant: BOB_ADDRESS,
        participantPublicKey: mockExportedPublicKey,
        unreadCount: 3,
        updatedAt: Date.now(),
      },
    ];
    const storedMessages = [
      {
        id: 'msg-1',
        from: ALICE_ADDRESS,
        to: BOB_ADDRESS,
        content: 'Hi!',
        timestamp: Date.now(),
        status: 'sent',
      },
    ];

    localStorage.setItem(
      `vauban-conversations-${ALICE_ADDRESS}`,
      JSON.stringify(conversations),
    );
    localStorage.setItem(
      `vauban-messages-${convId}`,
      JSON.stringify(storedMessages),
    );

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      result.current.selectConversation(convId);
    });

    expect(result.current.currentConversation).not.toBeNull();
    expect(result.current.currentConversation?.id).toBe(convId);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hi!');
  });

  it('marks conversation as read (unreadCount = 0)', async () => {
    const convId = `${ALICE_ADDRESS}-${BOB_ADDRESS}`;
    const conversations = [
      {
        id: convId,
        participant: BOB_ADDRESS,
        participantPublicKey: mockExportedPublicKey,
        unreadCount: 5,
        updatedAt: Date.now(),
      },
    ];

    localStorage.setItem(
      `vauban-conversations-${ALICE_ADDRESS}`,
      JSON.stringify(conversations),
    );

    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    expect(result.current.conversations[0].unreadCount).toBe(5);

    act(() => {
      result.current.selectConversation(convId);
    });

    expect(result.current.conversations[0].unreadCount).toBe(0);
  });
});

// ============================
// startConversation
// ============================

describe('useMessaging - startConversation', () => {
  it('creates a new conversation', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation(BOB_ADDRESS, mockExportedPublicKey);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].participant).toBe(BOB_ADDRESS);
    expect(result.current.currentConversation).not.toBeNull();
    expect(result.current.currentConversation?.participant).toBe(BOB_ADDRESS);
  });

  it('reuses existing conversation for same participant', async () => {
    const { result } = renderHook(() => useMessaging());

    await waitFor(() => {
      expect(result.current.keyPair).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation(BOB_ADDRESS, mockExportedPublicKey);
    });

    await act(async () => {
      await result.current.startConversation(BOB_ADDRESS, mockExportedPublicKey);
    });

    // Should still be 1 conversation, not 2
    expect(result.current.conversations).toHaveLength(1);
  });
});
