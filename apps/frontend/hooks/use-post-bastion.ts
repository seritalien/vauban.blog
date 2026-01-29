'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import {
  publishTweet,
  publishReply,
  startThread,
  continueThread,
  publishThreadAtomic,
  calculateContentHash,
} from '@vauban/web3-utils';
import { uploadJSONToIPFSViaAPI } from '@/lib/ipfs-client';
import { queryKeys } from '@/lib/query-keys';

// =============================================================================
// TYPES
// =============================================================================

export interface BastionContent {
  content: string;
  author: string;
  createdAt: number;
  type: 'bastion' | 'reply' | 'thread';
  parentId?: string;
  threadRootId?: string;
  imageUrl?: string;
}

export interface UsePostBastionResult {
  /** Post a new bastion (short post), optionally with an image */
  postBastion: (content: string, imageUrl?: string) => Promise<string | null>;
  /** Reply to an existing post */
  postReply: (content: string, parentId: string) => Promise<string | null>;
  /** Start a new thread */
  postThreadStart: (content: string) => Promise<string | null>;
  /** Continue an existing thread */
  postThreadContinue: (content: string, threadRootId: string) => Promise<string | null>;
  /** Post an entire thread (all posts) in just 2 transactions using multicall */
  postThread: (posts: string[]) => Promise<string | null>;
  /** Loading state */
  isPosting: boolean;
  /** Error message */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

// =============================================================================
// CONTENT PREPARATION
// =============================================================================

interface PrepareContentArgs {
  content: string;
  type: 'bastion' | 'reply' | 'thread';
  author: string;
  parentId?: string;
  threadRootId?: string;
  imageUrl?: string;
}

async function prepareContent(args: PrepareContentArgs): Promise<{ cid: string; hash: string }> {
  const bastionData: BastionContent = {
    content: args.content,
    author: args.author,
    createdAt: Date.now(),
    type: args.type,
    ...(args.parentId && { parentId: args.parentId }),
    ...(args.threadRootId && { threadRootId: args.threadRootId }),
    ...(args.imageUrl && { imageUrl: args.imageUrl }),
  };

  const cid = await uploadJSONToIPFSViaAPI(bastionData);
  const hash = await calculateContentHash(args.content);

  return { cid, hash };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for posting bastions (short posts), replies, and threads.
 * Uses React Query mutations for automatic cache invalidation on success.
 *
 * @example
 * ```tsx
 * function Composer() {
 *   const { postBastion, isPosting, error } = usePostBastion();
 *
 *   const handlePost = async (content: string) => {
 *     const postId = await postBastion(content);
 *     if (postId) {
 *       console.log('Posted:', postId);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={() => handlePost('Hello!')} disabled={isPosting}>
 *       {isPosting ? 'Posting...' : 'Bastionne!'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePostBastion(): UsePostBastionResult {
  const { account, address, isConnected } = useWallet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const onMutationSuccess = useCallback(async () => {
    // Clear the RPC proxy cache so subsequent reads return fresh blockchain state
    await fetch('/api/rpc', { method: 'DELETE' }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
  }, [queryClient]);

  // --- Bastion mutation ---
  const bastionMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      const prepared = await prepareContent({
        content,
        type: 'bastion',
        author: address!,
        imageUrl,
      });
      return publishTweet(account!, prepared.cid, prepared.cid, prepared.hash);
    },
    onSuccess: onMutationSuccess,
  });

  // --- Reply mutation ---
  const replyMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId: string }) => {
      const prepared = await prepareContent({
        content,
        type: 'reply',
        author: address!,
        parentId,
      });
      return publishReply(account!, prepared.cid, prepared.cid, prepared.hash, parentId);
    },
    onSuccess: onMutationSuccess,
  });

  // --- Thread start mutation ---
  const threadStartMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const prepared = await prepareContent({
        content,
        type: 'thread',
        author: address!,
      });
      return startThread(account!, prepared.cid, prepared.cid, prepared.hash);
    },
    onSuccess: onMutationSuccess,
  });

  // --- Thread continue mutation ---
  const threadContinueMutation = useMutation({
    mutationFn: async ({ content, threadRootId }: { content: string; threadRootId: string }) => {
      const prepared = await prepareContent({
        content,
        type: 'thread',
        author: address!,
        threadRootId,
      });
      return continueThread(account!, prepared.cid, prepared.cid, prepared.hash, threadRootId);
    },
    onSuccess: onMutationSuccess,
  });

  // --- Thread batch mutation (atomic multicall for ALL posts including root) ---
  const threadBatchMutation = useMutation({
    mutationFn: async ({ posts }: { posts: string[] }) => {
      if (posts.length === 0) throw new Error('No posts provided');

      // Prepare ALL posts in parallel (we don't know threadRootId yet, but publishThreadAtomic handles it)
      const preparedPosts = await Promise.all(
        posts.map(async (content) => {
          const prepared = await prepareContent({
            content,
            type: 'thread',
            author: address!,
          });
          return {
            arweaveTxId: prepared.cid,
            ipfsCid: prepared.cid,
            contentHash: prepared.hash,
          };
        })
      );

      // Publish entire thread atomically in a single transaction
      // This predicts the threadRootId and bundles all posts to avoid nonce issues
      const rootId = await publishThreadAtomic(account!, preparedPosts);

      return rootId;
    },
    onSuccess: onMutationSuccess,
  });

  // Aggregate isPosting from all mutations
  const isPosting =
    bastionMutation.isPending ||
    replyMutation.isPending ||
    threadStartMutation.isPending ||
    threadContinueMutation.isPending ||
    threadBatchMutation.isPending;

  /**
   * Post a new bastion (short post)
   */
  const postBastion = useCallback(async (content: string, imageUrl?: string): Promise<string | null> => {
    if (!isConnected || !account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!content.trim()) {
      setError('Content cannot be empty');
      return null;
    }

    if (content.length > 280) {
      setError('Content exceeds 280 characters');
      return null;
    }

    setError(null);

    try {
      const postId = await bastionMutation.mutateAsync({ content, imageUrl });
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post';
      setError(message);
      return null;
    }
  }, [isConnected, account, bastionMutation]);

  /**
   * Reply to an existing post
   */
  const postReply = useCallback(async (
    content: string,
    parentId: string
  ): Promise<string | null> => {
    if (!isConnected || !account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!content.trim()) {
      setError('Content cannot be empty');
      return null;
    }

    if (content.length > 280) {
      setError('Content exceeds 280 characters');
      return null;
    }

    setError(null);

    try {
      const postId = await replyMutation.mutateAsync({ content, parentId });
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post reply';
      setError(message);
      return null;
    }
  }, [isConnected, account, replyMutation]);

  /**
   * Start a new thread
   */
  const postThreadStart = useCallback(async (content: string): Promise<string | null> => {
    if (!isConnected || !account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!content.trim()) {
      setError('Content cannot be empty');
      return null;
    }

    setError(null);

    try {
      const postId = await threadStartMutation.mutateAsync({ content });
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start thread';
      setError(message);
      return null;
    }
  }, [isConnected, account, threadStartMutation]);

  /**
   * Continue an existing thread
   */
  const postThreadContinue = useCallback(async (
    content: string,
    threadRootId: string
  ): Promise<string | null> => {
    if (!isConnected || !account) {
      setError('Please connect your wallet');
      return null;
    }

    if (!content.trim()) {
      setError('Content cannot be empty');
      return null;
    }

    setError(null);

    try {
      const postId = await threadContinueMutation.mutateAsync({ content, threadRootId });
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to continue thread';
      setError(message);
      return null;
    }
  }, [isConnected, account, threadContinueMutation]);

  /**
   * Post an entire thread using just 2 transactions:
   * 1. First post creates the thread root
   * 2. All remaining posts are batched in a single multicall transaction
   *
   * This is MUCH faster than posting each item sequentially and avoids nonce issues.
   */
  const postThread = useCallback(async (posts: string[]): Promise<string | null> => {
    if (!isConnected || !account) {
      setError('Please connect your wallet');
      return null;
    }

    const validPosts = posts.filter((p) => p.trim());
    if (validPosts.length === 0) {
      setError('No valid posts provided');
      return null;
    }

    setError(null);

    try {
      const rootId = await threadBatchMutation.mutateAsync({ posts: validPosts });
      return rootId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post thread';
      setError(message);
      return null;
    }
  }, [isConnected, account, threadBatchMutation]);

  return {
    postBastion,
    postReply,
    postThreadStart,
    postThreadContinue,
    postThread,
    isPosting,
    error,
    clearError,
  };
}

export default usePostBastion;
