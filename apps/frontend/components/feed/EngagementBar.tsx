'use client';

import { useWallet } from '@/providers/wallet-provider';
import { usePostEngagement, useUserLikeStatus, useLikeMutation } from '@/hooks/use-engagement';

interface EngagementBarProps {
  postId: string;
  initialLikes?: number;
  initialComments?: number;
  initialReposts?: number;
  onComment?: () => void;
  onRepost?: () => void;
  onShare?: () => void;
  compact?: boolean;
}

export default function EngagementBar({
  postId,
  initialLikes = 0,
  initialComments = 0,
  initialReposts = 0,
  onComment,
  onRepost,
  onShare,
  compact = false,
}: EngagementBarProps) {
  const { isConnected } = useWallet();

  // React Query hooks for engagement data
  const { data: engagement } = usePostEngagement(postId);
  const { data: isLiked = false } = useUserLikeStatus(postId);
  const likeMutation = useLikeMutation(postId);

  const likeCount = engagement?.likes ?? initialLikes;
  const commentCount = engagement?.comments ?? initialComments;
  const isLiking = likeMutation.isPending;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConnected || isLiking) return;

    try {
      await likeMutation.mutateAsync({
        action: isLiked ? 'unlike' : 'like',
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComment?.();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare();
    } else {
      // Default share behavior
      if (navigator.share) {
        navigator.share({
          title: 'Check out this post',
          url: `${window.location.origin}/articles/${postId}`,
        });
      } else {
        navigator.clipboard.writeText(`${window.location.origin}/articles/${postId}`);
      }
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const buttonClass = compact
    ? 'p-1.5 rounded-full transition-colors'
    : 'flex items-center gap-1.5 p-2 rounded-full transition-colors';

  const iconClass = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-1 -ml-2'}`}>
      {/* Comment */}
      <button
        onClick={handleComment}
        className={`${buttonClass} text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20`}
        title="Comment"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {!compact && commentCount > 0 && (
          <span className="text-sm">{formatCount(commentCount)}</span>
        )}
      </button>

      {/* Repost / Quote */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRepost?.();
        }}
        className={`${buttonClass} text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20`}
        title="Quote"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {!compact && initialReposts > 0 && (
          <span className="text-sm">{formatCount(initialReposts)}</span>
        )}
      </button>

      {/* Like */}
      <button
        onClick={handleLike}
        disabled={!isConnected || isLiking}
        className={`
          ${buttonClass}
          ${isLiked
            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          }
          ${(!isConnected || isLiking) && 'opacity-50 cursor-not-allowed'}
        `}
        title={isLiked ? 'Unlike' : 'Like'}
      >
        <svg
          className={iconClass}
          fill={isLiked ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {!compact && likeCount > 0 && (
          <span className="text-sm">{formatCount(likeCount)}</span>
        )}
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className={`${buttonClass} text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20`}
        title="Share"
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </button>
    </div>
  );
}
