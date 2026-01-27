'use client';

import Link from 'next/link';
import { useFollowCounts } from '@/hooks/use-follow';

interface FollowStatsProps {
  /** User address */
  address: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether stats are clickable (link to followers/following pages) */
  clickable?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Display follower/following counts for a user
 *
 * @example
 * ```tsx
 * <FollowStats address="0x123..." size="md" />
 * ```
 */
export default function FollowStats({
  address,
  size = 'md',
  clickable = false,
  className = '',
}: FollowStatsProps) {
  const { followerCount, followingCount, isLoading } = useFollowCounts(address);

  const sizeClasses = {
    sm: 'text-xs gap-3',
    md: 'text-sm gap-4',
    lg: 'text-base gap-6',
  };

  const numberClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
        <div className="animate-pulse flex gap-4">
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const StatItem = ({ count, label, href }: { count: number; label: string; href?: string }) => {
    const content = (
      <>
        <span className={`font-bold text-gray-900 dark:text-white ${numberClasses[size]}`}>
          {formatNumber(count)}
        </span>
        <span className="text-gray-500 dark:text-gray-400 ml-1">{label}</span>
      </>
    );

    if (clickable && href) {
      return (
        <Link
          href={href}
          className="hover:underline transition-colors hover:text-blue-600 dark:hover:text-blue-400"
        >
          {content}
        </Link>
      );
    }

    return <span>{content}</span>;
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <StatItem
        count={followingCount}
        label="Following"
        href={clickable ? `/authors/${address}?tab=following` : undefined}
      />
      <StatItem
        count={followerCount}
        label={followerCount === 1 ? 'Follower' : 'Followers'}
        href={clickable ? `/authors/${address}?tab=followers` : undefined}
      />
    </div>
  );
}
