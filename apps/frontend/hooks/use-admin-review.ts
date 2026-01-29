'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import { queryKeys } from '@/lib/query-keys';
import {
  getPostsByStatus,
  getPendingReviewCount,
  approvePost as approvePostContract,
  rejectPost as rejectPostContract,
  POST_STATUS_PENDING_REVIEW,
} from '@vauban/web3-utils';

interface PendingPost {
  id: string;
  author: string;
  arweaveTxId: string;
  ipfsCid: string;
  contentHash: string;
  createdAt: number;
  updatedAt: number;
  postType: number;
}

interface UseAdminReviewResult {
  pendingPosts: PendingPost[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  approvePost: (postId: string) => Promise<void>;
  rejectPost: (postId: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
  refetch: () => void;
}

export function useAdminReview(): UseAdminReviewResult {
  const { account } = useWallet();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: queryKeys.admin.pendingReview,
    queryFn: () => getPostsByStatus(POST_STATUS_PENDING_REVIEW, 50, 0),
    select: (data): PendingPost[] =>
      data.map((post) => ({
        id: post.id,
        author: post.author,
        arweaveTxId: post.arweaveTxId,
        ipfsCid: post.ipfsCid,
        contentHash: post.contentHash,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        postType: post.postType,
      })),
  });

  const countQuery = useQuery({
    queryKey: [...queryKeys.admin.pendingReview, 'count'],
    queryFn: () => getPendingReviewCount(),
  });

  const approveMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!account) throw new Error('Wallet not connected');
      await approvePostContract(account, postId);
    },
    onSuccess: async (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pendingReview });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'post:approved', data: { postId } }),
      }).catch(() => {});
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!account) throw new Error('Wallet not connected');
      await rejectPostContract(account, postId);
    },
    onSuccess: async (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pendingReview });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'post:rejected', data: { postId } }),
      }).catch(() => {});
    },
  });

  return {
    pendingPosts: postsQuery.data ?? [],
    pendingCount: countQuery.data ?? 0,
    isLoading: postsQuery.isLoading || countQuery.isLoading,
    error: postsQuery.error?.message ?? rejectMutation.error?.message ?? null,
    approvePost: (postId: string) => approveMutation.mutateAsync(postId),
    rejectPost: (postId: string) => rejectMutation.mutateAsync(postId),
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    refetch: () => {
      postsQuery.refetch();
      countQuery.refetch();
    },
  };
}
