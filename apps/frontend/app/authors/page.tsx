'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import { getProfile, formatAddress, getDisplayName, toAddressString } from '@/lib/profiles';
import { type AuthorProfile } from '@vauban/shared-types';
import { getPostLikes, getCommentsForPost } from '@vauban/web3-utils';
import AuthorBadge, { getAuthorBadges } from '@/components/ui/AuthorBadge';

export const dynamic = 'force-dynamic';

// Sort options
type SortOption = 'most-posts' | 'most-engagement' | 'newest';

// Author with aggregated data
interface AuthorData {
  address: string;
  profile: AuthorProfile | null;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  firstPostDate: Date | null;
}

export default function AuthorsDiscoveryPage() {
  const [sortBy, setSortBy] = useState<SortOption>('most-posts');
  const [authors, setAuthors] = useState<AuthorData[]>([]);
  const [isLoadingEngagement, setIsLoadingEngagement] = useState(false);

  const { posts, isLoading: isLoadingPosts, error } = usePosts(100, 0);

  // Group posts by author
  const authorPostsMap = useMemo(() => {
    const map = new Map<string, VerifiedPost[]>();
    posts.forEach((post) => {
      const authorAddr = toAddressString(post.author);
      if (!map.has(authorAddr)) {
        map.set(authorAddr, []);
      }
      map.get(authorAddr)?.push(post);
    });
    return map;
  }, [posts]);

  // Build basic author data
  useEffect(() => {
    const authorAddresses = Array.from(authorPostsMap.keys());
    const basicAuthors: AuthorData[] = authorAddresses.map((address) => {
      const authorPosts = authorPostsMap.get(address) ?? [];
      const sortedPosts = [...authorPosts].sort(
        (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
      );
      return {
        address,
        profile: getProfile(address),
        postCount: authorPosts.length,
        totalLikes: 0,
        totalComments: 0,
        firstPostDate: sortedPosts[0]?.createdAt ?? null,
      };
    });
    setAuthors(basicAuthors);
  }, [authorPostsMap]);

  // Fetch engagement data for all authors
  useEffect(() => {
    async function loadEngagement() {
      if (authors.length === 0 || isLoadingEngagement) return;

      setIsLoadingEngagement(true);

      try {
        const updatedAuthors = await Promise.all(
          authors.map(async (author) => {
            const authorPosts = authorPostsMap.get(author.address) ?? [];
            let totalLikes = 0;
            let totalComments = 0;

            // Fetch engagement for each post
            for (const post of authorPosts) {
              try {
                const [likes, comments] = await Promise.all([
                  getPostLikes(post.id),
                  getCommentsForPost(post.id, 100, 0),
                ]);
                totalLikes += likes;
                totalComments += comments.filter((c) => !c.isDeleted).length;
              } catch (err) {
                console.warn(`Error fetching engagement for post ${post.id}:`, err);
              }
            }

            return {
              ...author,
              totalLikes,
              totalComments,
            };
          })
        );
        setAuthors(updatedAuthors);
      } catch (err) {
        console.error('Error loading engagement:', err);
      } finally {
        setIsLoadingEngagement(false);
      }
    }

    // Only fetch if we have basic author data
    if (authors.length > 0 && authors[0]?.totalLikes === 0) {
      loadEngagement();
    }
  }, [authors.length, authorPostsMap]);

  // Sort authors
  const sortedAuthors = useMemo(() => {
    const sorted = [...authors];
    switch (sortBy) {
      case 'most-posts':
        sorted.sort((a, b) => b.postCount - a.postCount);
        break;
      case 'most-engagement':
        sorted.sort((a, b) => (b.totalLikes + b.totalComments) - (a.totalLikes + a.totalComments));
        break;
      case 'newest':
        sorted.sort((a, b) => {
          const dateA = a.firstPostDate?.getTime() ?? 0;
          const dateB = b.firstPostDate?.getTime() ?? 0;
          return dateB - dateA;
        });
        break;
    }
    return sorted;
  }, [authors, sortBy]);

  if (isLoadingPosts) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 animate-pulse">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <AuthorCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h2 className="font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Discover Authors</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Explore the talented writers contributing to our decentralized blog platform.
          </p>

          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2">
            <SortButton
              label="Most Posts"
              value="most-posts"
              currentSort={sortBy}
              onClick={setSortBy}
            />
            <SortButton
              label="Most Engagement"
              value="most-engagement"
              currentSort={sortBy}
              onClick={setSortBy}
            />
            <SortButton
              label="Newest"
              value="newest"
              currentSort={sortBy}
              onClick={setSortBy}
            />
          </div>
        </div>

        {/* Author Grid */}
        {sortedAuthors.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p>No authors found yet. Be the first to publish!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAuthors.map((author) => (
              <AuthorCard
                key={author.address}
                author={author}
                isLoadingEngagement={isLoadingEngagement}
              />
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {sortedAuthors.length > 0 && (
          <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold mb-4">Platform Statistics</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {sortedAuthors.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Authors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {posts.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Articles</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {sortedAuthors.reduce((sum, a) => sum + a.totalLikes, 0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Likes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sort Button Component
interface SortButtonProps {
  label: string;
  value: SortOption;
  currentSort: SortOption;
  onClick: (value: SortOption) => void;
}

function SortButton({ label, value, currentSort, onClick }: SortButtonProps) {
  const isActive = currentSort === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`
        px-4 py-2 text-sm font-medium rounded-full transition-all
        ${isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
    >
      {label}
    </button>
  );
}

// Author Card Component
interface AuthorCardProps {
  author: AuthorData;
  isLoadingEngagement: boolean;
}

function AuthorCard({ author, isLoadingEngagement }: AuthorCardProps) {
  const displayName = getDisplayName(author.address, author.profile);
  const shortAddress = formatAddress(author.address);
  const badges = getAuthorBadges(
    author.postCount,
    author.profile !== null,
    author.firstPostDate ?? undefined
  );

  return (
    <Link
      href={`/authors/${author.address}`}
      className="block group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-gray-800/50 transition-all"
    >
      {/* Avatar and Name */}
      <div className="flex items-center gap-4 mb-4">
        {author.profile?.avatar ? (
          <img
            src={author.profile.avatar}
            alt={displayName}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold ring-2 ring-gray-100 dark:ring-gray-700">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
            {shortAddress}
          </p>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {badges.slice(0, 3).map((badgeType) => (
            <AuthorBadge key={badgeType} type={badgeType} size="sm" />
          ))}
        </div>
      )}

      {/* Bio */}
      {author.profile?.bio && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
          {author.profile.bio}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {author.postCount} posts
        </span>
        <span className="flex items-center gap-1">
          {isLoadingEngagement ? (
            <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {author.totalLikes}
            </>
          )}
        </span>
        <span className="flex items-center gap-1">
          {isLoadingEngagement ? (
            <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {author.totalComments}
            </>
          )}
        </span>
      </div>
    </Link>
  );
}

// Skeleton Component
function AuthorCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
      <div className="flex gap-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
      </div>
    </div>
  );
}
