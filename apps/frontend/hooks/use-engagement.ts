'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import { hasLikedPost, likePost, unlikePost } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';
import type { BatchEngagementResponse, EngagementData } from '@/app/api/engagement/batch/route';

// ---------------------------------------------------------------------------
// Batch engagement fetcher
// ---------------------------------------------------------------------------

async function fetchBatchEngagement(postIds: string[]): Promise<BatchEngagementResponse> {
  if (postIds.length === 0) return {};

  const response = await fetch('/api/engagement/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postIds }),
  });

  if (!response.ok) {
    throw new Error(`Engagement batch failed: ${response.status}`);
  }

  return response.json() as Promise<BatchEngagementResponse>;
}

// ---------------------------------------------------------------------------
// Batch hook: fetch engagement for multiple posts at once
// ---------------------------------------------------------------------------

export function useBatchEngagement(postIds: string[]) {
  // Sort IDs for stable cache key
  const sortedIds = [...postIds].sort();

  return useQuery({
    queryKey: queryKeys.engagement.batch(sortedIds),
    queryFn: () => fetchBatchEngagement(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds for engagement data
  });
}

// ---------------------------------------------------------------------------
// Single post engagement: reads from batch cache if available
// ---------------------------------------------------------------------------

export function usePostEngagement(postId: string) {
  return useQuery({
    queryKey: queryKeys.engagement.single(postId),
    queryFn: async (): Promise<EngagementData> => {
      const result = await fetchBatchEngagement([postId]);
      return result[postId] ?? { likes: 0, comments: 0 };
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// User like status
// ---------------------------------------------------------------------------

export function useUserLikeStatus(postId: string) {
  const { account } = useWallet();
  const userAddress = account?.address ? String(account.address) : null;

  return useQuery({
    queryKey: queryKeys.engagement.userLike(postId, userAddress ?? ''),
    queryFn: async () => {
      if (!userAddress) return false;
      return hasLikedPost(postId, userAddress);
    },
    enabled: !!userAddress,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Like mutation with optimistic update
// ---------------------------------------------------------------------------

export function useLikeMutation(postId: string) {
  const queryClient = useQueryClient();
  const { account } = useWallet();
  const userAddress = account?.address ? String(account.address) : null;

  return useMutation({
    mutationFn: async ({ action }: { action: 'like' | 'unlike' }) => {
      if (!account) throw new Error('Wallet not connected');
      if (action === 'like') {
        await likePost(account, postId);
      } else {
        await unlikePost(account, postId);
      }
      return action;
    },
    onMutate: async ({ action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.engagement.single(postId) });

      if (userAddress) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.engagement.userLike(postId, userAddress),
        });
      }

      // Snapshot previous values
      const previousEngagement = queryClient.getQueryData<EngagementData>(
        queryKeys.engagement.single(postId)
      );
      const previousLiked = userAddress
        ? queryClient.getQueryData<boolean>(queryKeys.engagement.userLike(postId, userAddress))
        : undefined;

      // Optimistic update
      const delta = action === 'like' ? 1 : -1;

      queryClient.setQueryData<EngagementData>(
        queryKeys.engagement.single(postId),
        (old) => ({
          likes: Math.max(0, (old?.likes ?? 0) + delta),
          comments: old?.comments ?? 0,
        })
      );

      if (userAddress) {
        queryClient.setQueryData(
          queryKeys.engagement.userLike(postId, userAddress),
          action === 'like'
        );
      }

      return { previousEngagement, previousLiked };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousEngagement !== undefined) {
        queryClient.setQueryData(
          queryKeys.engagement.single(postId),
          context.previousEngagement
        );
      }
      if (context?.previousLiked !== undefined && userAddress) {
        queryClient.setQueryData(
          queryKeys.engagement.userLike(postId, userAddress),
          context.previousLiked
        );
      }
    },
    onSettled: () => {
      // Refetch to sync with server state
      queryClient.invalidateQueries({ queryKey: queryKeys.engagement.single(postId) });
      // Also invalidate any batch queries that include this post
      queryClient.invalidateQueries({ queryKey: queryKeys.engagement.all });
    },
  });
}
