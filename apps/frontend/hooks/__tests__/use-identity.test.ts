import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseWallet = vi.hoisted(() => vi.fn());
const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: mockUseWallet,
}));

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}));

import { useIdentity } from '../use-identity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walletState(overrides: Record<string, unknown> = {}) {
  return {
    address: null,
    isConnected: false,
    ...overrides,
  };
}

function oauthSession(user: Record<string, unknown> | null = null) {
  if (!user) {
    return { data: null, status: 'unauthenticated' };
  }
  return {
    data: { user },
    status: 'authenticated',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue(walletState());
    mockUseSession.mockReturnValue(oauthSession(null));
  });

  it('returns null identity when no auth source', () => {
    const { result } = renderHook(() => useIdentity());

    expect(result.current).toEqual({
      address: null,
      displayName: null,
      isAuthenticated: false,
      authSource: null,
      isCustodial: false,
      isSovereign: false,
    });
  });

  it('returns sovereign identity when wallet is connected', () => {
    mockUseWallet.mockReturnValue(
      walletState({ address: '0xwallet123', isConnected: true })
    );

    const { result } = renderHook(() => useIdentity());

    expect(result.current).toEqual({
      address: '0xwallet123',
      displayName: null,
      isAuthenticated: true,
      authSource: 'wallet',
      isCustodial: false,
      isSovereign: true,
    });
  });

  it('returns custodial identity when only OAuth (GitHub) is active', () => {
    mockUseSession.mockReturnValue(
      oauthSession({
        name: 'Alice',
        email: 'alice@github.com',
        image: 'https://avatars.githubusercontent.com/u/123',
        walletAddress: '0xcustodial456',
      })
    );

    const { result } = renderHook(() => useIdentity());

    expect(result.current).toEqual({
      address: '0xcustodial456',
      displayName: 'Alice',
      isAuthenticated: true,
      authSource: 'github',
      isCustodial: true,
      isSovereign: false,
    });
  });

  it('returns custodial identity with google provider', () => {
    mockUseSession.mockReturnValue(
      oauthSession({
        name: 'Bob',
        email: 'bob@gmail.com',
        image: 'https://lh3.googleusercontent.com/photo123',
        walletAddress: '0xcustodial789',
      })
    );

    const { result } = renderHook(() => useIdentity());

    expect(result.current.authSource).toBe('google');
    expect(result.current.isCustodial).toBe(true);
    expect(result.current.address).toBe('0xcustodial789');
  });

  it('wallet takes priority over OAuth when both are active', () => {
    mockUseWallet.mockReturnValue(
      walletState({ address: '0xsovereign', isConnected: true })
    );
    mockUseSession.mockReturnValue(
      oauthSession({
        name: 'Alice',
        walletAddress: '0xcustodial',
        image: 'https://avatars.githubusercontent.com/u/123',
      })
    );

    const { result } = renderHook(() => useIdentity());

    expect(result.current.address).toBe('0xsovereign');
    expect(result.current.authSource).toBe('wallet');
    expect(result.current.isSovereign).toBe(true);
    expect(result.current.isCustodial).toBe(false);
    // Display name comes from OAuth session even when wallet takes priority
    expect(result.current.displayName).toBe('Alice');
  });

  it('isCustodial and isSovereign are always opposite when authenticated', () => {
    // Wallet only
    mockUseWallet.mockReturnValue(
      walletState({ address: '0xwallet', isConnected: true })
    );
    const { result: r1 } = renderHook(() => useIdentity());
    expect(r1.current.isCustodial).toBe(false);
    expect(r1.current.isSovereign).toBe(true);

    // OAuth only
    mockUseWallet.mockReturnValue(walletState());
    mockUseSession.mockReturnValue(
      oauthSession({
        name: 'Test',
        walletAddress: '0xcust',
        image: 'https://avatars.githubusercontent.com/u/1',
      })
    );
    const { result: r2 } = renderHook(() => useIdentity());
    expect(r2.current.isCustodial).toBe(true);
    expect(r2.current.isSovereign).toBe(false);
  });

  it('returns null address when OAuth session has no walletAddress', () => {
    mockUseSession.mockReturnValue(
      oauthSession({
        name: 'NoWallet',
        email: 'x@test.com',
        image: 'https://avatars.githubusercontent.com/u/1',
      })
    );

    const { result } = renderHook(() => useIdentity());

    expect(result.current.address).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
