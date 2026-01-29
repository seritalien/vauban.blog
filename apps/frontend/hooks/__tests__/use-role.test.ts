import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { web3Mocks, walletState, mockContract } = vi.hoisted(() => {
  const mockContract = {
    is_registered: vi.fn().mockResolvedValue(false),
    get_user_role: vi.fn().mockResolvedValue({
      role: 0,
      granted_at: 0,
      granted_by: '0x0',
      approved_posts: 0,
      reputation: 0n,
      is_active: true,
    }),
    get_role_level: vi.fn().mockResolvedValue(0),
  };

  const web3Mocks = {
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    calculateContentHash: vi.fn(),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
    followsAbi: [],
    roleRegistryAbi: [],
  };

  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    isConnected: true,
  };

  return { web3Mocks, walletState, mockContract };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('starknet', () => {
  // Create a proper constructor function that returns mockContract
  function MockContract() {
    return mockContract;
  }
  MockContract.prototype = {};
  return {
    Contract: MockContract,
  };
});

vi.mock('@vauban/shared-types', () => ({
  ROLES: { READER: 0, WRITER: 1, CONTRIBUTOR: 2, EDITOR: 3, MODERATOR: 4, ADMIN: 5, OWNER: 6 },
  ROLE_NAMES: { 0: 'READER', 1: 'WRITER', 2: 'CONTRIBUTOR', 3: 'EDITOR', 4: 'MODERATOR', 5: 'ADMIN', 6: 'OWNER' },
  ROLE_LABELS: { 0: 'Reader', 1: 'Writer', 2: 'Contributor', 3: 'Editor', 4: 'Moderator', 5: 'Admin', 6: 'Owner' },
}));

import { useRole, useUserRole } from '@/hooks/use-role';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS = '0xROLEREGISTRY';
  walletState.address = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
  walletState.isConnected = true;

  mockContract.is_registered.mockResolvedValue(false);
  mockContract.get_user_role.mockResolvedValue({
    role: 0,
    granted_at: 0,
    granted_by: '0x0',
    approved_posts: 0,
    reputation: 0n,
    is_active: true,
  });
  mockContract.get_role_level.mockResolvedValue(0);
});

describe('useRole', () => {
  it('returns READER when wallet is not connected', async () => {
    walletState.address = null;
    walletState.isConnected = false;
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.roleName).toBe('READER');
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.userRole).toBeNull();
  });

  it('returns READER when contract address is not set', async () => {
    // fetchRoleData handles no contract address internally by returning READER
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.roleName).toBe('READER');
  });

  it('returns READER when user is not registered', async () => {
    mockContract.is_registered.mockResolvedValue(false);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.roleName).toBe('READER');
    expect(result.current.isRegistered).toBe(false);
  });

  it('returns full role data when user is registered', async () => {
    mockContract.is_registered.mockResolvedValue(true);
    mockContract.get_user_role.mockResolvedValue({
      role: 5,
      granted_at: 1000,
      granted_by: '0xGranter',
      approved_posts: 42,
      reputation: 100n,
      is_active: true,
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(5);
    expect(result.current.roleName).toBe('ADMIN');
    expect(result.current.roleLabel).toBe('Admin');
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.userRole).not.toBeNull();
    expect(result.current.userRole?.approvedPosts).toBe(42);
  });

  it('falls back to get_role_level when get_user_role fails', async () => {
    mockContract.is_registered.mockResolvedValue(true);
    mockContract.get_user_role.mockRejectedValue(new Error('Function not found'));
    mockContract.get_role_level.mockResolvedValue(3);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(3);
    expect(result.current.roleName).toBe('EDITOR');
    expect(result.current.userRole).toBeNull();
  });

  it('defaults to READER when both contract calls fail', async () => {
    mockContract.is_registered.mockRejectedValue(new Error('Network error'));
    mockContract.get_user_role.mockRejectedValue(new Error('fail'));
    mockContract.get_role_level.mockRejectedValue(new Error('fail'));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.roleName).toBe('READER');
  });

  it('clamps role level to valid range 0-6', async () => {
    mockContract.is_registered.mockResolvedValue(true);
    mockContract.get_user_role.mockResolvedValue({
      role: 99,
      granted_at: 0,
      granted_by: '0x0',
      approved_posts: 0,
      reputation: 0n,
      is_active: true,
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(6); // Clamped to max
  });
});

describe('useUserRole', () => {
  it('returns READER when address is null', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useUserRole(null), { wrapper });

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.roleName).toBe('READER');
  });

  it('fetches role for a specific address', async () => {
    mockContract.is_registered.mockResolvedValue(true);
    mockContract.get_user_role.mockResolvedValue({
      role: 2,
      granted_at: 500,
      granted_by: '0xAdmin',
      approved_posts: 10,
      reputation: 50n,
      is_active: true,
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useUserRole('0xSomeOtherUser'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(2);
    expect(result.current.roleName).toBe('CONTRIBUTOR');
  });
});

describe('useRole - refresh', () => {
  it('refresh invalidates and refetches', async () => {
    mockContract.is_registered.mockResolvedValue(false);
    const { wrapper, queryClient } = createQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refresh();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['role', 'user', walletState.address],
    });
  });
});
