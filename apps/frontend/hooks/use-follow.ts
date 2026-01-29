'use client';

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Contract, Account } from 'starknet';
import { useWallet } from '@/providers/wallet-provider';
import { getProvider, initStarknetProvider, followsAbi } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';
import { getPublicEnv } from '@/lib/public-env';

// Ensure provider uses the Next.js RPC proxy (avoids CORS with direct RPC)
if (typeof window !== 'undefined') {
  initStarknetProvider({ nodeUrl: '/api/rpc' });
}

// ============================================================================
// FOLLOWS CONTRACT CONFIGURATION
// ============================================================================

function getFollowsAddress(): string | null {
  const address = getPublicEnv('NEXT_PUBLIC_FOLLOWS_ADDRESS');
  return address || null;
}

const FOLLOWS_ABI = followsAbi;

/**
 * Normalize an address from the contract to hex format (0x...).
 * Handles both BigInt values and already-formatted hex strings.
 */
function toHexAddress(value: unknown): string {
  const str = String(value);
  try {
    return '0x' + BigInt(str).toString(16);
  } catch {
    // Already a hex string or non-numeric — lowercase it
    return str.toLowerCase();
  }
}

function getReadContract(): Contract | null {
  const contractAddress = getFollowsAddress();
  if (!contractAddress) return null;
  const provider = getProvider();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Contract(FOLLOWS_ABI as any, contractAddress, provider);
}

function getWriteContract(account: Account): Contract | null {
  const contractAddress = getFollowsAddress();
  if (!contractAddress) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Contract(FOLLOWS_ABI as any, contractAddress, account);
}

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface FollowStats {
  followerCount: number;
  followingCount: number;
}

export interface UseFollowResult {
  /** Whether the current user is following the target */
  isFollowing: boolean;
  /** Follow stats for the target user */
  stats: FollowStats;
  /** Loading state for read operations */
  isLoading: boolean;
  /** Loading state for follow/unfollow actions */
  isActing: boolean;
  /** Error message if any */
  error: string | null;
  /** Follow the target user */
  follow: () => Promise<boolean>;
  /** Unfollow the target user */
  unfollow: () => Promise<boolean>;
  /** Toggle follow state */
  toggleFollow: () => Promise<boolean>;
  /** Refresh follow data */
  refresh: () => Promise<void>;
}

export interface UseFollowStatsResult {
  /** Follow stats */
  stats: FollowStats;
  /** List of follower addresses */
  followers: string[];
  /** List of following addresses */
  following: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh stats */
  refresh: () => Promise<void>;
  /** Load more followers */
  loadMoreFollowers: () => Promise<void>;
  /** Load more following */
  loadMoreFollowing: () => Promise<void>;
  /** Whether there are more followers to load */
  hasMoreFollowers: boolean;
  /** Whether there are more following to load */
  hasMoreFollowing: boolean;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

async function fetchFollowStats(targetAddress: string): Promise<FollowStats> {
  const contract = getReadContract();
  if (!contract) return { followerCount: 0, followingCount: 0 };

  const [followerCount, followingCount] = await Promise.all([
    contract.get_follower_count(targetAddress),
    contract.get_following_count(targetAddress),
  ]);

  return {
    followerCount: Number(followerCount),
    followingCount: Number(followingCount),
  };
}

async function fetchIsFollowing(
  userAddress: string,
  targetAddress: string,
): Promise<boolean> {
  const contract = getReadContract();
  if (!contract) return false;

  const following = await contract.is_following(userAddress, targetAddress);
  return Boolean(following);
}

// ============================================================================
// MAIN HOOK: useFollow
// ============================================================================

export function useFollow(targetAddress: string | null | undefined): UseFollowResult {
  const { address, isConnected, account } = useWallet();
  const queryClient = useQueryClient();

  // Local state for error and acting — needed because the boolean-returning
  // wrappers (follow/unfollow) catch errors, so React Query mutation.error
  // never gets set.
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const hasTarget = !!targetAddress;
  const hasContract = !!getFollowsAddress();
  const enabled = hasTarget && hasContract;

  // Fetch follow stats
  const statsQuery = useQuery({
    queryKey: queryKeys.follow.stats(targetAddress ?? ''),
    queryFn: () => fetchFollowStats(targetAddress!),
    enabled,
    staleTime: 30 * 1000,
  });

  // Check if current user is following target
  const canCheckFollowing = enabled && isConnected && !!address && address !== targetAddress;
  const isFollowingQuery = useQuery({
    queryKey: queryKeys.follow.isFollowing(address ?? '', targetAddress ?? ''),
    queryFn: () => fetchIsFollowing(address!, targetAddress!),
    enabled: canCheckFollowing,
    staleTime: 30 * 1000,
  });

  // Follow action
  const follow = useCallback(async (): Promise<boolean> => {
    setActionError(null);

    if (!isConnected || !account || !targetAddress) {
      setActionError('Please connect your wallet');
      return false;
    }
    if (address === targetAddress) {
      setActionError('Cannot follow yourself');
      return false;
    }
    const contract = getWriteContract(account as Account);
    if (!contract) {
      setActionError('Follows contract not deployed');
      return false;
    }

    setIsActing(true);
    try {
      const tx = await contract.follow(targetAddress);
      await (account as unknown as { waitForTransaction: (hash: string) => Promise<unknown> }).waitForTransaction(tx.transaction_hash);

      // Update cache after confirmed tx
      queryClient.setQueryData<boolean>(
        queryKeys.follow.isFollowing(address ?? '', targetAddress),
        true,
      );
      queryClient.setQueryData<FollowStats>(
        queryKeys.follow.stats(targetAddress),
        (old) => old ? { ...old, followerCount: old.followerCount + 1 } : { followerCount: 1, followingCount: 0 },
      );
      // Refetch in background after a tick to avoid overwriting the optimistic update
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.follow.stats(targetAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.follow.isFollowing(address ?? '', targetAddress) });
      }, 100);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to follow user';
      setActionError(msg);
      return false;
    } finally {
      setIsActing(false);
    }
  }, [isConnected, account, address, targetAddress, queryClient]);

  // Unfollow action
  const unfollow = useCallback(async (): Promise<boolean> => {
    setActionError(null);

    if (!isConnected || !account || !targetAddress) {
      setActionError('Please connect your wallet');
      return false;
    }
    const contract = getWriteContract(account as Account);
    if (!contract) {
      setActionError('Follows contract not deployed');
      return false;
    }

    setIsActing(true);
    try {
      const tx = await contract.unfollow(targetAddress);
      await (account as unknown as { waitForTransaction: (hash: string) => Promise<unknown> }).waitForTransaction(tx.transaction_hash);

      queryClient.setQueryData<boolean>(
        queryKeys.follow.isFollowing(address ?? '', targetAddress),
        false,
      );
      queryClient.setQueryData<FollowStats>(
        queryKeys.follow.stats(targetAddress),
        (old) => old ? { ...old, followerCount: Math.max(0, old.followerCount - 1) } : { followerCount: 0, followingCount: 0 },
      );
      // Refetch in background after a tick to avoid overwriting the optimistic update
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.follow.stats(targetAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.follow.isFollowing(address ?? '', targetAddress) });
      }, 100);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unfollow user';
      setActionError(msg);
      return false;
    } finally {
      setIsActing(false);
    }
  }, [isConnected, account, address, targetAddress, queryClient]);

  const toggleFollow = useCallback(async (): Promise<boolean> => {
    if (isFollowingQuery.data) {
      return unfollow();
    }
    return follow();
  }, [isFollowingQuery.data, follow, unfollow]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.follow.stats(targetAddress ?? '') });
    if (canCheckFollowing) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.follow.isFollowing(address ?? '', targetAddress ?? '') });
    }
  }, [queryClient, targetAddress, address, canCheckFollowing]);

  // Derive error: action errors take priority, then query errors
  const queryError = statsQuery.error ?? isFollowingQuery.error;
  const errorMessage = actionError
    ?? (queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null);

  return {
    isFollowing: isFollowingQuery.data ?? false,
    stats: statsQuery.data ?? { followerCount: 0, followingCount: 0 },
    isLoading: statsQuery.isLoading || isFollowingQuery.isLoading,
    isActing,
    error: errorMessage,
    follow,
    unfollow,
    toggleFollow,
    refresh,
  };
}

// ============================================================================
// STATS HOOK: useFollowStats
// ============================================================================

const PAGE_SIZE = 20;

export function useFollowStats(userAddress: string | null | undefined): UseFollowStatsResult {
  const queryClient = useQueryClient();

  const hasAddress = !!userAddress;
  const hasContract = !!getFollowsAddress();
  const enabled = hasAddress && hasContract;

  // Fetch counts
  const statsQuery = useQuery({
    queryKey: queryKeys.follow.stats(userAddress ?? ''),
    queryFn: () => fetchFollowStats(userAddress!),
    enabled,
    staleTime: 30 * 1000,
  });

  // Fetch initial follower/following lists
  const followersQuery = useQuery({
    queryKey: [...queryKeys.follow.list(userAddress ?? ''), 'followers'] as const,
    queryFn: async () => {
      const contract = getReadContract();
      if (!contract) return { items: [] as string[], hasMore: false };
      const list = await contract.get_followers(userAddress!, PAGE_SIZE, 0);
      // Convert BigInt addresses to hex format (0x...)
      const items = Array.isArray(list) ? list.map((f: unknown) => toHexAddress(f)) : [];
      const totalCount = statsQuery.data?.followerCount ?? 0;
      return { items, hasMore: items.length < totalCount };
    },
    enabled: enabled && statsQuery.isSuccess,
    staleTime: 30 * 1000,
  });

  const followingQuery = useQuery({
    queryKey: [...queryKeys.follow.list(userAddress ?? ''), 'following'] as const,
    queryFn: async () => {
      const contract = getReadContract();
      if (!contract) return { items: [] as string[], hasMore: false };
      const list = await contract.get_following(userAddress!, PAGE_SIZE, 0);
      // Convert BigInt addresses to hex format (0x...)
      const items = Array.isArray(list) ? list.map((f: unknown) => toHexAddress(f)) : [];
      const totalCount = statsQuery.data?.followingCount ?? 0;
      return { items, hasMore: items.length < totalCount };
    },
    enabled: enabled && statsQuery.isSuccess,
    staleTime: 30 * 1000,
  });

  // Load more handlers — read current cache via queryClient to avoid stale closures
  const followersKey = [...queryKeys.follow.list(userAddress ?? ''), 'followers'] as const;
  const followingKey = [...queryKeys.follow.list(userAddress ?? ''), 'following'] as const;

  const loadMoreFollowers = useCallback(async () => {
    const current = queryClient.getQueryData<{ items: string[]; hasMore: boolean }>(followersKey);
    if (!userAddress || !current?.hasMore) return;
    const contract = getReadContract();
    if (!contract) return;

    const offset = current.items.length;
    const moreFollowers = await contract.get_followers(userAddress, PAGE_SIZE, offset);
    // Convert BigInt addresses to hex format (0x...)
    const newItems = Array.isArray(moreFollowers)
      ? moreFollowers.map((f: unknown) => toHexAddress(f))
      : [];

    queryClient.setQueryData(followersKey, {
      items: [...current.items, ...newItems],
      hasMore: newItems.length === PAGE_SIZE,
    });
  }, [userAddress, queryClient, followersKey]);

  const loadMoreFollowing = useCallback(async () => {
    const current = queryClient.getQueryData<{ items: string[]; hasMore: boolean }>(followingKey);
    if (!userAddress || !current?.hasMore) return;
    const contract = getReadContract();
    if (!contract) return;

    const offset = current.items.length;
    const moreFollowing = await contract.get_following(userAddress, PAGE_SIZE, offset);
    // Convert BigInt addresses to hex format (0x...)
    const newItems = Array.isArray(moreFollowing)
      ? moreFollowing.map((f: unknown) => toHexAddress(f))
      : [];

    queryClient.setQueryData(followingKey, {
      items: [...current.items, ...newItems],
      hasMore: newItems.length === PAGE_SIZE,
    });
  }, [userAddress, queryClient, followingKey]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.follow.stats(userAddress ?? '') });
    await queryClient.invalidateQueries({ queryKey: queryKeys.follow.list(userAddress ?? '') });
  }, [queryClient, userAddress]);

  const isLoading = statsQuery.isLoading || followersQuery.isLoading || followingQuery.isLoading;
  const error = statsQuery.error ?? followersQuery.error ?? followingQuery.error;
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    stats: statsQuery.data ?? { followerCount: 0, followingCount: 0 },
    followers: followersQuery.data?.items ?? [],
    following: followingQuery.data?.items ?? [],
    isLoading,
    error: errorMessage,
    refresh,
    loadMoreFollowers,
    loadMoreFollowing,
    hasMoreFollowers: followersQuery.data?.hasMore ?? false,
    hasMoreFollowing: followingQuery.data?.hasMore ?? false,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

export function useIsFollowing(targetAddress: string | null | undefined): boolean {
  const { isFollowing } = useFollow(targetAddress);
  return isFollowing;
}

export function useFollowCounts(userAddress: string | null | undefined): FollowStats & { isLoading: boolean } {
  const hasAddress = !!userAddress;
  const hasContract = !!getFollowsAddress();

  const statsQuery = useQuery({
    queryKey: queryKeys.follow.stats(userAddress ?? ''),
    queryFn: () => fetchFollowStats(userAddress!),
    enabled: hasAddress && hasContract,
    staleTime: 30 * 1000,
  });

  return {
    followerCount: statsQuery.data?.followerCount ?? 0,
    followingCount: statsQuery.data?.followingCount ?? 0,
    isLoading: statsQuery.isLoading,
  };
}
