'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import {
  publishTweet,
  publishReply,
  startThread,
  continueThread,
  calculateContentHash,
} from '@vauban/web3-utils';
import { uploadJSONToIPFSViaAPI } from '@/lib/ipfs-client';

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
  /** Loading state */
  isPosting: boolean;
  /** Error message */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for posting bastions (short posts), replies, and threads
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
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Upload content to IPFS and get CID + hash
   */
  const prepareContent = useCallback(async (
    content: string,
    type: 'bastion' | 'reply' | 'thread',
    parentId?: string,
    threadRootId?: string,
    imageUrl?: string
  ): Promise<{ cid: string; hash: string } | null> => {
    if (!address) {
      setError('Wallet not connected');
      return null;
    }

    const bastionData: BastionContent = {
      content,
      author: address,
      createdAt: Date.now(),
      type,
      ...(parentId && { parentId }),
      ...(threadRootId && { threadRootId }),
      ...(imageUrl && { imageUrl }),
    };

    try {
      // Upload to IPFS
      const cid = await uploadJSONToIPFSViaAPI(bastionData);

      // Calculate content hash
      const hash = await calculateContentHash(content);

      return { cid, hash };
    } catch (err) {
      console.error('Error preparing content:', err);
      setError('Failed to upload content');
      return null;
    }
  }, [address]);

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

    setIsPosting(true);
    setError(null);

    try {
      const prepared = await prepareContent(content, 'bastion', undefined, undefined, imageUrl);
      if (!prepared) {
        setIsPosting(false);
        return null;
      }

      // For bastions, we don't use Arweave (too slow for short posts)
      // Just use IPFS CID as both arweave_tx_id and ipfs_cid
      const postId = await publishTweet(
        account,
        prepared.cid, // Using CID as arweave placeholder
        prepared.cid,
        prepared.hash
      );

      return postId;
    } catch (err) {
      console.error('Error posting bastion:', err);
      setError(err instanceof Error ? err.message : 'Failed to post');
      return null;
    } finally {
      setIsPosting(false);
    }
  }, [isConnected, account, prepareContent]);

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

    setIsPosting(true);
    setError(null);

    try {
      const prepared = await prepareContent(content, 'reply', parentId);
      if (!prepared) {
        setIsPosting(false);
        return null;
      }

      const postId = await publishReply(
        account,
        prepared.cid,
        prepared.cid,
        prepared.hash,
        parentId
      );

      return postId;
    } catch (err) {
      console.error('Error posting reply:', err);
      setError(err instanceof Error ? err.message : 'Failed to post reply');
      return null;
    } finally {
      setIsPosting(false);
    }
  }, [isConnected, account, prepareContent]);

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

    setIsPosting(true);
    setError(null);

    try {
      const prepared = await prepareContent(content, 'thread');
      if (!prepared) {
        setIsPosting(false);
        return null;
      }

      const postId = await startThread(
        account,
        prepared.cid,
        prepared.cid,
        prepared.hash
      );

      return postId;
    } catch (err) {
      console.error('Error starting thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to start thread');
      return null;
    } finally {
      setIsPosting(false);
    }
  }, [isConnected, account, prepareContent]);

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

    setIsPosting(true);
    setError(null);

    try {
      const prepared = await prepareContent(content, 'thread', undefined, threadRootId);
      if (!prepared) {
        setIsPosting(false);
        return null;
      }

      const postId = await continueThread(
        account,
        prepared.cid,
        prepared.cid,
        prepared.hash,
        threadRootId
      );

      return postId;
    } catch (err) {
      console.error('Error continuing thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to continue thread');
      return null;
    } finally {
      setIsPosting(false);
    }
  }, [isConnected, account, prepareContent]);

  return {
    postBastion,
    postReply,
    postThreadStart,
    postThreadContinue,
    isPosting,
    error,
    clearError,
  };
}

export default usePostBastion;
