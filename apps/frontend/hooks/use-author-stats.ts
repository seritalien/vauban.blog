'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import { getPostLikes, getCommentsForPost } from '@vauban/web3-utils';
import { toAddressString } from '@/lib/profiles';

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
 * Hook to fetch author statistics including total likes and comments
 */
export function useAuthorStats(authorAddress: string) {
  const [stats, setStats] = useState<AuthorStats | null>(null);
  const [postsWithEngagement, setPostsWithEngagement] = useState<PostWithEngagement[]>([]);
  const [isLoadingEngagement, setIsLoadingEngagement] = useState(false);
  const [engagementError, setEngagementError] = useState<string | null>(null);

  // Fetch all posts
  const { posts, isLoading: isLoadingPosts, error: postsError } = usePosts(100, 0);

  // Filter posts by this author
  const authorPosts = useMemo(() => {
    if (!authorAddress) return [];
    const normalizedAddress = authorAddress.toLowerCase();
    return posts.filter(
      (post) => toAddressString(post.author) === normalizedAddress
    );
  }, [posts, authorAddress]);

  // Calculate basic stats from posts
  const basicStats = useMemo(() => {
    if (authorPosts.length === 0) {
      return {
        totalPosts: 0,
        memberSince: null,
        publicationFrequency: 'No posts yet',
        recentPostDates: [],
      };
    }

    // Sort posts by creation date
    const sortedPosts = [...authorPosts].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    );

    const postDates = sortedPosts
      .filter((p) => p.createdAt)
      .map((p) => p.createdAt as Date);

    return {
      totalPosts: authorPosts.length,
      memberSince: postDates[0] ?? null,
      publicationFrequency: calculatePublicationFrequency(postDates),
      recentPostDates: postDates.slice(-10), // Last 10 posts for timeline
    };
  }, [authorPosts]);

  // Fetch engagement data (likes and comments) for each post
  useEffect(() => {
    async function loadEngagement() {
      if (authorPosts.length === 0) {
        setPostsWithEngagement([]);
        setStats({
          ...basicStats,
          totalLikes: 0,
          totalComments: 0,
        });
        return;
      }

      setIsLoadingEngagement(true);
      setEngagementError(null);

      try {
        const postsWithData = await Promise.all(
          authorPosts.map(async (post) => {
            try {
              const [likeCount, comments] = await Promise.all([
                getPostLikes(post.id),
                getCommentsForPost(post.id, 100, 0), // Get comments (max 100)
              ]);
              return {
                ...post,
                likeCount,
                commentCount: comments.filter((c) => !c.isDeleted).length,
              };
            } catch (err) {
              console.warn(`Error fetching engagement for post ${post.id}:`, err);
              return {
                ...post,
                likeCount: 0,
                commentCount: 0,
              };
            }
          })
        );

        setPostsWithEngagement(postsWithData);

        // Calculate totals
        const totalLikes = postsWithData.reduce((sum, p) => sum + p.likeCount, 0);
        const totalComments = postsWithData.reduce((sum, p) => sum + p.commentCount, 0);

        setStats({
          ...basicStats,
          totalLikes,
          totalComments,
        });
      } catch (err) {
        console.error('Error loading engagement data:', err);
        setEngagementError(err instanceof Error ? err.message : 'Failed to load engagement data');
        // Still set stats with zeros if engagement fails
        setStats({
          ...basicStats,
          totalLikes: 0,
          totalComments: 0,
        });
      } finally {
        setIsLoadingEngagement(false);
      }
    }

    loadEngagement();
  }, [authorPosts, basicStats]);

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
    error: postsError ?? engagementError,
  };
}
