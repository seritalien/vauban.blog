import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { web3Mocks, walletState, mockContractInstance } = vi.hoisted(() => {
  const web3Mocks = {
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    followsAbi: [],
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
    calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
  };

  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    account: {
      address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001',
      execute: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_Alice' }),
      waitForTransaction: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' }),
    } as Record<string, unknown> | null,
    isConnected: true,
  };

  const mockContractInstance = {
    get_follower_count: vi.fn().mockResolvedValue(10n),
    get_following_count: vi.fn().mockResolvedValue(5n),
    is_following: vi.fn().mockResolvedValue(false),
    follow: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_FOLLOW' }),
    unfollow: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_UNFOLLOW' }),
    get_followers: vi.fn().mockResolvedValue([]),
    get_following: vi.fn().mockResolvedValue([]),
  };

  return { web3Mocks, walletState, mockContractInstance };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('starknet', () => ({
  Contract: function () { return mockContractInstance; },
  Account: function () { return {}; },
}));

// Import hooks after mocks
import { useFollow, useFollowStats } from '@/hooks/use-follow';
import { ALICE, BOB, createMockAccount } from '@/__tests__/helpers/test-users';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FOLLOWS_ADDRESS = '0xFOLLOWS_CONTRACT';

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
  return Wrapper;
}

function setWalletConnected(connected: boolean) {
  if (connected) {
    const acct = createMockAccount(ALICE);
    walletState.address = ALICE.address;
    walletState.account = acct;
    walletState.isConnected = true;
  } else {
    walletState.address = null;
    walletState.account = null;
    walletState.isConnected = false;
  }
}

function resetContractMocks() {
  mockContractInstance.get_follower_count.mockResolvedValue(10n);
  mockContractInstance.get_following_count.mockResolvedValue(5n);
  mockContractInstance.is_following.mockResolvedValue(false);
  mockContractInstance.follow.mockResolvedValue({ transaction_hash: '0xTX_FOLLOW' });
  mockContractInstance.unfollow.mockResolvedValue({ transaction_hash: '0xTX_UNFOLLOW' });
  mockContractInstance.get_followers.mockResolvedValue([]);
  mockContractInstance.get_following.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  resetContractMocks();
  setWalletConnected(true);
  process.env.NEXT_PUBLIC_FOLLOWS_ADDRESS = FOLLOWS_ADDRESS;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_FOLLOWS_ADDRESS;
});

// ============================
// useFollow - initial state
// ============================

describe('useFollow - initial state', () => {
  it('returns zeroed stats when targetAddress is null', async () => {
    const { result } = renderHook(() => useFollow(null), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual({ followerCount: 0, followingCount: 0 });
    expect(result.current.isFollowing).toBe(false);
  });

  it('returns zeroed stats when targetAddress is undefined', async () => {
    const { result } = renderHook(() => useFollow(undefined), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual({ followerCount: 0, followingCount: 0 });
    expect(result.current.isFollowing).toBe(false);
  });
});

// ============================
// useFollow - fetchData
// ============================

describe('useFollow - fetchData', () => {
  it('returns follower and following counts from contract', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(42n);
    mockContractInstance.get_following_count.mockResolvedValue(17n);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats.followerCount).toBe(42);
    expect(result.current.stats.followingCount).toBe(17);
  });

  it('checks isFollowing when connected and not self', async () => {
    mockContractInstance.is_following.mockResolvedValue(true);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockContractInstance.is_following).toHaveBeenCalledWith(
      ALICE.address,
      BOB.address,
    );
    expect(result.current.isFollowing).toBe(true);
  });

  it('skips isFollowing check when disconnected', async () => {
    setWalletConnected(false);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockContractInstance.is_following).not.toHaveBeenCalled();
    expect(result.current.isFollowing).toBe(false);
  });

  it('skips isFollowing when address equals targetAddress (self)', async () => {
    const { result } = renderHook(() => useFollow(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockContractInstance.is_following).not.toHaveBeenCalled();
    expect(result.current.isFollowing).toBe(false);
  });

  it('handles contract failure gracefully', async () => {
    mockContractInstance.get_follower_count.mockRejectedValue(new Error('RPC down'));

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe('RPC down');
    });
  });

  it('returns empty stats when no contract address is set', async () => {
    delete process.env.NEXT_PUBLIC_FOLLOWS_ADDRESS;

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual({ followerCount: 0, followingCount: 0 });
    expect(result.current.isFollowing).toBe(false);
  });
});

// ============================
// useFollow - follow
// ============================

describe('useFollow - follow', () => {
  it('calls contract.follow, waits for tx, and optimistically updates', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(10n);
    mockContractInstance.get_following_count.mockResolvedValue(5n);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialFollowerCount = result.current.stats.followerCount;

    let success = false;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(true);
    expect(mockContractInstance.follow).toHaveBeenCalledWith(BOB.address);
    expect(walletState.account!.waitForTransaction).toHaveBeenCalledWith('0xTX_FOLLOW');
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.stats.followerCount).toBe(initialFollowerCount + 1);
  });

  it('returns true on success', async () => {
    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(true);
  });

  it('returns false and sets error when wallet is not connected', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Please connect your wallet');
  });

  it('prevents self-follow and sets error', async () => {
    const { result } = renderHook(() => useFollow(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Cannot follow yourself');
  });

  it('returns false when contract is not deployed', async () => {
    delete process.env.NEXT_PUBLIC_FOLLOWS_ADDRESS;

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Follows contract not deployed');
  });

  it('returns false on contract error', async () => {
    mockContractInstance.follow.mockRejectedValueOnce(new Error('Execution reverted'));

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.follow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Execution reverted');
  });
});

// ============================
// useFollow - unfollow
// ============================

describe('useFollow - unfollow', () => {
  it('calls contract.unfollow and decrements follower count (min 0)', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(1n);
    mockContractInstance.get_following_count.mockResolvedValue(5n);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.unfollow();
    });

    expect(success).toBe(true);
    expect(mockContractInstance.unfollow).toHaveBeenCalledWith(BOB.address);
    expect(result.current.isFollowing).toBe(false);
    expect(result.current.stats.followerCount).toBe(0);
  });

  it('does not decrement below 0', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(0n);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unfollow();
    });

    expect(result.current.stats.followerCount).toBe(0);
  });

  it('returns false when wallet is not connected', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.unfollow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Please connect your wallet');
  });

  it('returns false on contract error', async () => {
    mockContractInstance.unfollow.mockRejectedValueOnce(new Error('Unfollow failed'));

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.unfollow();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Unfollow failed');
  });
});

// ============================
// useFollow - toggleFollow
// ============================

describe('useFollow - toggleFollow', () => {
  it('routes to follow when not currently following', async () => {
    mockContractInstance.is_following.mockResolvedValue(false);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFollowing).toBe(false);

    // After follow succeeds, the refetch should also return true
    mockContractInstance.is_following.mockResolvedValue(true);

    await act(async () => {
      await result.current.toggleFollow();
    });

    expect(mockContractInstance.follow).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.isFollowing).toBe(true);
    });
  });

  it('routes to unfollow when currently following', async () => {
    mockContractInstance.is_following.mockResolvedValue(true);

    const { result } = renderHook(() => useFollow(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFollowing).toBe(true);
    });

    // After unfollow succeeds, the refetch should return false
    mockContractInstance.is_following.mockResolvedValue(false);

    await act(async () => {
      await result.current.toggleFollow();
    });

    expect(mockContractInstance.unfollow).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.isFollowing).toBe(false);
    });
  });
});

// ============================
// useFollowStats
// ============================

describe('useFollowStats - fetches all 4 values on mount', () => {
  it('returns followerCount, followingCount, followers list, and following list', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(3n);
    mockContractInstance.get_following_count.mockResolvedValue(2n);
    mockContractInstance.get_followers.mockResolvedValue(['0xF1', '0xF2', '0xF3']);
    mockContractInstance.get_following.mockResolvedValue(['0xG1', '0xG2']);

    const { result } = renderHook(() => useFollowStats(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats.followerCount).toBe(3);
    expect(result.current.stats.followingCount).toBe(2);
    expect(result.current.followers).toEqual(['0xf1', '0xf2', '0xf3']);
    expect(result.current.following).toEqual(['0xg1', '0xg2']);  // 0xG1 → lowercased
  });
});

describe('useFollowStats - pagination', () => {
  it('sets hasMoreFollowers and hasMoreFollowing based on count vs list length', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(25n);
    mockContractInstance.get_following_count.mockResolvedValue(5n);

    const twentyFollowers = Array.from({ length: 20 }, (_, i) => `0xFollower${i}`);
    mockContractInstance.get_followers.mockResolvedValue(twentyFollowers);
    mockContractInstance.get_following.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => `0xFollowing${i}`),
    );

    const { result } = renderHook(() => useFollowStats(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMoreFollowers).toBe(true);
    expect(result.current.hasMoreFollowing).toBe(false);
  });

  it('loadMoreFollowers fetches next page and appends results', async () => {
    mockContractInstance.get_follower_count.mockResolvedValue(25n);
    mockContractInstance.get_following_count.mockResolvedValue(0n);

    const initialFollowers = Array.from({ length: 20 }, (_, i) => `0xF${i}`);
    // Use mockImplementation so subsequent calls also return the initial list
    // (in case React Query refetches)
    mockContractInstance.get_followers.mockResolvedValue(initialFollowers);
    mockContractInstance.get_following.mockResolvedValue([]);

    const { result } = renderHook(() => useFollowStats(BOB.address), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.followers).toHaveLength(20);
      expect(result.current.hasMoreFollowers).toBe(true);
    });

    // Mock second page — loadMoreFollowers calls get_followers(addr, 20, 20)
    const secondPage = Array.from({ length: 5 }, (_, i) => `0xF${20 + i}`);
    mockContractInstance.get_followers.mockResolvedValueOnce(secondPage);

    await act(async () => {
      await result.current.loadMoreFollowers();
    });

    await waitFor(() => {
      expect(result.current.followers).toHaveLength(25);
    });
    // Since second page < PAGE_SIZE (20), hasMoreFollowers should be false
    expect(result.current.hasMoreFollowers).toBe(false);
  });
});

describe('useFollowStats - null userAddress', () => {
  it('returns empty stats and lists when userAddress is null', async () => {
    const { result } = renderHook(() => useFollowStats(null), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual({ followerCount: 0, followingCount: 0 });
    expect(result.current.followers).toEqual([]);
    expect(result.current.following).toEqual([]);
  });
});
