'use client';

import { useMemo } from 'react';
import { usePosts, type VerifiedPost } from '@/hooks/use-posts';
import { useBatchEngagement } from '@/hooks/use-engagement';
import { normalizeAddress } from '@/lib/profiles';

// Author statistics interface
export interface AuthorStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  memberSince: Date | null;
  publicationFrequency: string;
  recentPostDates: Date[];
}

// Post with social engagement data
export interface PostWithEngagement extends VerifiedPost {
  likeCount: number;
  commentCount: number;
}

// Calculate publication frequency based on post dates
function calculatePublicationFrequency(postDates: Date[]): string {
  if (postDates.length === 0) return 'No posts yet';
  if (postDates.length === 1) return 'Just started';

  // Sort dates descending
  const sorted = [...postDates].sort((a, b) => b.getTime() - a.getTime());

  // Calculate average days between posts
  let totalDays = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = sorted[i].getTime() - sorted[i + 1].getTime();
    totalDays += diff / (1000 * 60 * 60 * 24);
  }
  const avgDays = totalDays / (sorted.length - 1);

  if (avgDays <= 1) return 'Publishes daily';
  if (avgDays <= 7) return 'Publishes weekly';
  if (avgDays <= 14) return 'Publishes bi-weekly';
  if (avgDays <= 30) return 'Publishes monthly';
  if (avgDays <= 90) return 'Publishes quarterly';
  return 'Occasional writer';
}

/**
 * Hook to fetch author statistics including total likes and comments.
 *
 * Uses the batch engagement API (1 HTTP call) instead of N×2 direct RPC calls.
 */
export function useAuthorStats(authorAddress: string) {
  // Fetch all posts (shared React Query cache)
  const { posts, isLoading: isLoadingPosts, error: postsError } = usePosts(100, 0);

  // Filter posts by this author
  const authorPosts = useMemo(() => {
    if (!authorAddress) return [];
    const normalizedAuthor = normalizeAddress(authorAddress);
    return posts.filter(
      (post) => normalizeAddress(post.author) === normalizedAuthor
    );
  }, [posts, authorAddress]);

  // Stable array of post IDs for the batch engagement hook
  const authorPostIds = useMemo(
    () => authorPosts.map((p) => p.id),
    [authorPosts],
  );

  // Batch fetch engagement data — single HTTP call replaces N×2 RPC calls
  const {
    data: engagementMap,
    isLoading: isLoadingEngagement,
    error: engagementError,
  } = useBatchEngagement(authorPostIds);

  // Merge engagement data onto posts
  const postsWithEngagement: PostWithEngagement[] = useMemo(() => {
    if (!engagementMap) return [];
    return authorPosts.map((post) => {
      const engagement = engagementMap[post.id];
      return {
        ...post,
        likeCount: engagement?.likes ?? 0,
        commentCount: engagement?.comments ?? 0,
      };
    });
  }, [authorPosts, engagementMap]);

  // Calculate stats
  const stats: AuthorStats | null = useMemo(() => {
    if (authorPosts.length === 0) {
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        memberSince: null,
        publicationFrequency: 'No posts yet',
        recentPostDates: [],
      };
    }

    // Sort posts by creation date ascending
    const sortedPosts = [...authorPosts].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    );

    const postDates = sortedPosts
      .filter((p) => p.createdAt)
      .map((p) => p.createdAt as Date);

    const totalLikes = postsWithEngagement.reduce((sum, p) => sum + p.likeCount, 0);
    const totalComments = postsWithEngagement.reduce((sum, p) => sum + p.commentCount, 0);

    return {
      totalPosts: authorPosts.length,
      totalLikes,
      totalComments,
      memberSince: postDates[0] ?? null,
      publicationFrequency: calculatePublicationFrequency(postDates),
      recentPostDates: postDates.slice(-10),
    };
  }, [authorPosts, postsWithEngagement]);

  // Get featured posts (top 3 by likes)
  const featuredPosts = useMemo(() => {
    return [...postsWithEngagement]
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 3);
  }, [postsWithEngagement]);

  // Get recent activity (last 5 posts, sorted by date descending)
  const recentActivity = useMemo(() => {
    return [...postsWithEngagement]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 5);
  }, [postsWithEngagement]);

  return {
    stats,
    authorPosts,
    postsWithEngagement,
    featuredPosts,
    recentActivity,
    isLoading: isLoadingPosts || isLoadingEngagement,
    isLoadingEngagement,
    error: postsError ?? (engagementError instanceof Error ? engagementError.message : null),
  };
}
