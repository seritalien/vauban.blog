import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { web3Mocks, walletState, mockLocalStorage } = vi.hoisted(() => {
  const web3Mocks = {
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({
      getBlock: vi.fn(),
      waitForTransaction: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' }),
    })),
    setContractAddresses: vi.fn(),
    calculateContentHash: vi.fn(),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
    followsAbi: [],
  };

  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    account: {
      address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001',
      execute: vi.fn().mockResolvedValue({ transaction_hash: '0xTX1' }),
    } as Record<string, unknown> | null,
    isConnected: true,
  };

  // In-memory localStorage mock
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };

  return { web3Mocks, walletState, mockLocalStorage };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('starknet', () => ({
  ec: {
    starkCurve: {
      utils: {
        randomPrivateKey: vi.fn(() => new Uint8Array(32).fill(1)),
      },
      getStarkKey: vi.fn(() => '0xPUBLICKEY'),
    },
  },
  Contract: vi.fn(() => ({
    create_session_key: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_SESSION' }),
    revoke_session_key: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_REVOKE' }),
    get_session_key_nonce: vi.fn().mockResolvedValue(42),
  })),
}));

import { useSessionKey } from '@/hooks/use-session-key';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

function seedSessionKey(address: string, overrides: Partial<Record<string, unknown>> = {}) {
  const key = `vauban_session_key_${address}`;
  const data = {
    publicKey: '0xPUB',
    privateKey: '0xPRIV',
    masterAccount: address,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    isOnChain: true,
    ...overrides,
  };
  mockLocalStorage.setItem(key, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockLocalStorage.clear();
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

  walletState.address = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
  walletState.account = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001',
    execute: vi.fn().mockResolvedValue({ transaction_hash: '0xTX1' }),
  };
  walletState.isConnected = true;
});

describe('useSessionKey - status loading', () => {
  it('returns null session key when nothing in localStorage', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessionKey).toBeNull();
    });

    expect(result.current.hasActiveSessionKey).toBe(false);
    expect(result.current.isCreating).toBe(false);
  });

  it('loads session key from localStorage', async () => {
    seedSessionKey(walletState.address!);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessionKey).not.toBeNull();
    });

    expect(result.current.hasActiveSessionKey).toBe(true);
    expect(result.current.sessionKey?.masterAccount).toBe(walletState.address);
  });

  it('returns null when session key is expired', async () => {
    seedSessionKey(walletState.address!, {
      expiresAt: Date.now() - 1000, // expired 1 second ago
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    await waitFor(() => {
      // Should be cleaned up — query returns null for expired keys
      expect(result.current.sessionKey).toBeNull();
    });

    expect(result.current.hasActiveSessionKey).toBe(false);
  });

  it('returns null when master account mismatches', async () => {
    seedSessionKey('0xDIFFERENTACCOUNT', { masterAccount: '0xDIFFERENTACCOUNT' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessionKey).toBeNull();
    });
  });

  it('returns null when wallet is disconnected', async () => {
    walletState.address = null;
    walletState.isConnected = false;
    walletState.account = null;
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    expect(result.current.sessionKey).toBeNull();
    expect(result.current.hasActiveSessionKey).toBe(false);
  });
});

describe('useSessionKey - getSessionKeyNonce', () => {
  it('returns 0 when no session key exists', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSessionKey(), { wrapper });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
    });

    const nonce = await result.current.getSessionKeyNonce();
    expect(nonce).toBe(0);
  });
});
