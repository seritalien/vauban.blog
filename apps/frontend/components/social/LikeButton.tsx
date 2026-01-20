'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import {
  likePost,
  unlikePost,
  hasLikedPost,
  getPostLikes,
  likeComment,
  unlikeComment,
  hasLikedComment,
} from '@vauban/web3-utils';

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
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check initial like status
  useEffect(() => {
    async function checkLikeStatus() {
      if (!account?.address) {
        setIsChecking(false);
        return;
      }

      try {
        const addressStr = String(account.address);

        if (targetType === 'post') {
          const [liked, count] = await Promise.all([
            hasLikedPost(targetId, addressStr),
            getPostLikes(targetId),
          ]);
          setIsLiked(liked);
          setLikeCount(count);
        } else {
          const liked = await hasLikedComment(targetId, addressStr);
          setIsLiked(liked);
        }
      } catch (error) {
        console.error('Error checking like status:', error);
      } finally {
        setIsChecking(false);
      }
    }

    checkLikeStatus();
  }, [targetId, targetType, account?.address]);

  const handleLike = async () => {
    if (!account || isLoading) return;

    try {
      setIsLoading(true);

      if (isLiked) {
        // Unlike
        if (targetType === 'post') {
          await unlikePost(account, targetId);
        } else {
          await unlikeComment(account, targetId);
        }
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // Like
        if (targetType === 'post') {
          await likePost(account, targetId);
        } else {
          await likeComment(account, targetId);
        }
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showToast(`Failed to ${isLiked ? 'unlike' : 'like'}. Please try again.`, 'error');
    } finally {
      setIsLoading(false);
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
