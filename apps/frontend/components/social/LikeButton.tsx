'use client';

import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import { usePostEngagement, useUserLikeStatus, useLikeMutation } from '@/hooks/use-engagement';
import {
  likeComment,
  unlikeComment,
  hasLikedComment,
} from '@vauban/web3-utils';
import { useState, useEffect } from 'react';

interface LikeButtonProps {
  targetId: string;
  targetType: 'post' | 'comment';
  initialLikeCount?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function LikeButton({
  targetId,
  targetType,
  initialLikeCount = 0,
  size = 'md',
}: LikeButtonProps) {
  const { account, isConnected } = useWallet();
  const { showToast } = useToast();

  // For posts: use React Query hooks
  const { data: engagement } = usePostEngagement(targetId);
  const { data: userLiked, isLoading: isCheckingLike } = useUserLikeStatus(targetId);
  const likeMutation = useLikeMutation(targetId);

  // For comments: fall back to local state (different contract API)
  const [commentLiked, setCommentLiked] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentChecking, setCommentChecking] = useState(targetType === 'comment');

  useEffect(() => {
    if (targetType !== 'comment' || !account?.address) {
      setCommentChecking(false);
      return;
    }
    const checkComment = async () => {
      try {
        const liked = await hasLikedComment(targetId, String(account.address));
        setCommentLiked(liked);
      } catch (error) {
        console.error('Error checking comment like:', error);
      } finally {
        setCommentChecking(false);
      }
    };
    checkComment();
  }, [targetId, targetType, account?.address]);

  // Resolved values based on target type
  const isLiked = targetType === 'post' ? (userLiked ?? false) : commentLiked;
  const likeCount = targetType === 'post' ? (engagement?.likes ?? initialLikeCount) : initialLikeCount;
  const isLoading = targetType === 'post' ? likeMutation.isPending : commentLoading;
  const isChecking = targetType === 'post' ? isCheckingLike : commentChecking;

  const handleLike = async () => {
    if (!account || isLoading) return;

    try {
      if (targetType === 'post') {
        await likeMutation.mutateAsync({
          action: isLiked ? 'unlike' : 'like',
        });
      } else {
        setCommentLoading(true);
        if (isLiked) {
          await unlikeComment(account, targetId);
          setCommentLiked(false);
        } else {
          await likeComment(account, targetId);
          setCommentLiked(true);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showToast(`Failed to ${isLiked ? 'unlike' : 'like'}. Please try again.`, 'error');
    } finally {
      if (targetType === 'comment') {
        setCommentLoading(false);
      }
    }
  };

  const sizeClasses = {
    sm: 'text-sm gap-1 px-2 py-1',
    md: 'text-base gap-2 px-3 py-1.5',
    lg: 'text-lg gap-2 px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={handleLike}
      disabled={!isConnected || isLoading || isChecking}
      className={`
        inline-flex items-center rounded-full font-medium transition-all
        ${sizeClasses[size]}
        ${isLiked
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        }
        ${(!isConnected || isLoading || isChecking) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={!isConnected ? 'Connect wallet to like' : isLiked ? 'Unlike' : 'Like'}
    >
      {isLoading ? (
        <svg className={`${iconSizes[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg
          className={iconSizes[size]}
          fill={isLiked ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      )}
      <span>{likeCount}</span>
    </button>
  );
}
