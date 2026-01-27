'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFollow } from '@/hooks/use-follow';
import { useWallet } from '@/providers/wallet-provider';

interface FollowButtonProps {
  /** Address of the user to follow */
  targetAddress: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show follower count */
  showCount?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when follow state changes */
  onFollowChange?: (isFollowing: boolean) => void;
}

/**
 * Follow/Unfollow button component
 *
 * @example
 * ```tsx
 * <FollowButton targetAddress="0x123..." showCount />
 * ```
 */
export default function FollowButton({
  targetAddress,
  size = 'md',
  showCount = false,
  className = '',
  onFollowChange,
}: FollowButtonProps) {
  const { isConnected, address } = useWallet();
  const { isFollowing, isActing, toggleFollow, stats, error } = useFollow(targetAddress);
  const [isHovering, setIsHovering] = useState(false);

  // Don't show button if viewing own profile
  if (address === targetAddress) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
    lg: 'px-6 py-2 text-base',
  };

  // Handle click
  const handleClick = async () => {
    if (!isConnected) {
      // Could trigger wallet connection modal here
      return;
    }

    const success = await toggleFollow();
    if (success && onFollowChange) {
      onFollowChange(!isFollowing);
    }
  };

  // Determine button state and styling
  const getButtonState = () => {
    if (!isConnected) {
      return {
        text: 'Follow',
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
      };
    }

    if (isActing) {
      return {
        text: isFollowing ? 'Unfollowing...' : 'Following...',
        className: 'bg-gray-400 text-white cursor-wait',
      };
    }

    if (isFollowing) {
      if (isHovering) {
        return {
          text: 'Unfollow',
          className: 'bg-red-500 hover:bg-red-600 text-white border-red-500',
        };
      }
      return {
        text: 'Following',
        className: 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-500 hover:text-red-500',
      };
    }

    return {
      text: 'Follow',
      className: 'bg-blue-600 hover:bg-blue-700 text-white',
    };
  };

  const buttonState = getButtonState();

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <motion.button
        onClick={handleClick}
        disabled={isActing}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        whileTap={{ scale: 0.95 }}
        className={`
          ${sizeClasses[size]}
          ${buttonState.className}
          font-medium rounded-full
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2
        `}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={buttonState.text}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            {buttonState.text}
          </motion.span>
        </AnimatePresence>

        {/* Loading spinner */}
        {isActing && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </motion.button>

      {/* Follower count */}
      {showCount && (
        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {stats.followerCount.toLocaleString()} {stats.followerCount === 1 ? 'follower' : 'followers'}
        </span>
      )}

      {/* Error tooltip */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 px-2 py-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
