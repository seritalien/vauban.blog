'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthorStats, PostWithEngagement } from '@/hooks/use-author-stats';
import { getProfile, formatAddress, getDisplayName } from '@/lib/profiles';
import { type AuthorProfile } from '@vauban/shared-types';
import { POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE } from '@vauban/shared-types';
import { ArticleCardSkeleton } from '@/components/ui/Skeleton';
import AuthorBadge, { getAuthorBadges } from '@/components/ui/AuthorBadge';
import { FollowButton, FollowStats } from '@/components/social';
import { MessageUserButton } from '@/components/messaging';

export const dynamic = 'force-dynamic';

type ProfileTab = 'all' | 'tweets' | 'articles' | 'threads';

export default function AuthorProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [profile, setProfile] = useState<AuthorProfile | null>(null);

  const {
    stats,
    postsWithEngagement,
    featuredPosts,
    recentActivity,
    isLoading,
    error,
  } = useAuthorStats(address);

  // Load profile
  useEffect(() => {
    if (address) {
      const authorProfile = getProfile(address);
      setProfile(authorProfile);
    }
  }, [address]);

  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('all');

  const displayName = getDisplayName(address, profile);
  const shortAddress = formatAddress(address);

  // Filter posts by content type tab
  const filteredPosts = useMemo(() => {
    if (activeProfileTab === 'all') return postsWithEngagement;
    return postsWithEngagement.filter((post) => {
      const postType = post.postType ?? POST_TYPE_ARTICLE;
      switch (activeProfileTab) {
        case 'tweets': return postType === POST_TYPE_TWEET;
        case 'articles': return postType === POST_TYPE_ARTICLE;
        case 'threads': return postType === POST_TYPE_THREAD;
        default: return true;
      }
    });
  }, [postsWithEngagement, activeProfileTab]);

  // Counts per tab
  const tabCounts = useMemo(() => ({
    all: postsWithEngagement.length,
    tweets: postsWithEngagement.filter((p) => (p.postType ?? POST_TYPE_ARTICLE) === POST_TYPE_TWEET).length,
    articles: postsWithEngagement.filter((p) => (p.postType ?? POST_TYPE_ARTICLE) === POST_TYPE_ARTICLE).length,
    threads: postsWithEngagement.filter((p) => p.postType === POST_TYPE_THREAD).length,
  }), [postsWithEngagement]);

  // Get author badges
  const badges = getAuthorBadges(
    stats?.totalPosts ?? 0,
    profile !== null,
    stats?.memberSince ?? undefined
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Profile header skeleton */}
          <div className="flex items-start gap-6 mb-12 animate-pulse">
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            ))}
          </div>

          {/* Articles skeleton */}
          <div className="grid gap-6 sm:grid-cols-2">
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
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
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          {/* Avatar */}
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-100 dark:ring-gray-800"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-gray-100 dark:ring-gray-800">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              {/* Author Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center sm:justify-start">
                  {badges.map((badgeType) => (
                    <AuthorBadge key={badgeType} type={badgeType} size="sm" />
                  ))}
                </div>
              )}
            </div>

            <p className="text-gray-500 dark:text-gray-400 font-mono text-sm mb-4">
              {shortAddress}
            </p>

            {profile?.bio && (
              <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-xl">
                {profile.bio}
              </p>
            )}

            {/* Social Links */}
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {profile?.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Website
                </a>
              )}
              {profile?.twitter && (
                <a
                  href={`https://twitter.com/${profile.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{profile.twitter.replace('@', '')}
                </a>
              )}
              {profile?.github && (
                <a
                  href={`https://github.com/${profile.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  {profile.github}
                </a>
              )}
            </div>

            {/* Follow Stats and Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <FollowStats address={address} size="md" />
              <div className="flex items-center gap-2">
                <FollowButton targetAddress={address} size="md" />
                <MessageUserButton recipientAddress={address} size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            value={stats?.totalPosts ?? 0}
            label="Articles"
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }
            value={stats?.totalLikes ?? 0}
            label="Likes Received"
            highlight
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            value={stats?.totalComments ?? 0}
            label="Comments"
          />
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            value={stats?.memberSince ? format(stats.memberSince, 'MMM yyyy') : '-'}
            label="Member Since"
          />
        </div>

        {/* Featured Posts Section */}
        {featuredPosts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Featured Posts</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Most liked articles
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {featuredPosts.map((post) => (
                <FeaturedPostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        )}

        {/* Publication Activity */}
        {recentActivity.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Recent Activity</h2>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                {stats?.publicationFrequency}
              </span>
            </div>
            <div className="space-y-4">
              {recentActivity.map((post) => (
                <ActivityItem key={post.id} post={post} />
              ))}
            </div>
          </div>
        )}

        {/* Content Tabs */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            {([
              { key: 'all' as ProfileTab, label: 'All', count: tabCounts.all },
              { key: 'tweets' as ProfileTab, label: 'Tweets', count: tabCounts.tweets },
              { key: 'articles' as ProfileTab, label: 'Articles', count: tabCounts.articles },
              { key: 'threads' as ProfileTab, label: 'Threads', count: tabCounts.threads },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveProfileTab(tab.key)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeProfileTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${activeProfileTab === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }
                  `}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filtered content */}
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>
                {activeProfileTab === 'all'
                  ? "This author hasn\u0027t published anything yet."
                  : `No ${activeProfileTab} from this author yet.`}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {filteredPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  highlight?: boolean;
}

function StatCard({ icon, value, label, highlight = false }: StatCardProps) {
  return (
    <div
      className={`
        rounded-xl p-4 text-center transition-all
        ${highlight
          ? 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-100 dark:border-red-800/30'
          : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700'
        }
      `}
    >
      <div className={`flex justify-center mb-2 ${highlight ? 'text-red-500' : 'text-gray-400'}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

// Featured Post Card Component
function FeaturedPostCard({ post }: { post: PostWithEngagement }) {
  return (
    <Link
      href={`/articles/${post.id}`}
      className="block group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-lg dark:hover:shadow-gray-800/50 transition-all"
    >
      {post.coverImage && (
        <div className="relative h-32 overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-bold text-sm mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {post.excerpt}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-red-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.likeCount}
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Activity Item Component
function ActivityItem({ post }: { post: PostWithEngagement }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/articles/${post.id}`}
          className="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1"
        >
          {post.title}
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Published {post.createdAt ? formatDistanceToNow(post.createdAt, { addSuffix: true }) : 'recently'}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.likeCount}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.commentCount}
        </span>
      </div>
    </div>
  );
}

// Article Card Component (for All Articles section)
function ArticleCard({ post }: { post: PostWithEngagement }) {
  return (
    <article className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-gray-800 transition-shadow bg-white dark:bg-gray-800">
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {post.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link href={`/articles/${post.id}`}>
          <h3 className="text-lg font-bold mb-2 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">
            {post.title}
          </h3>
        </Link>

        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <time dateTime={post.createdAt?.toISOString()}>
            {post.createdAt ? format(post.createdAt, 'MMM d, yyyy') : 'Unknown date'}
          </time>

          <div className="flex items-center gap-3">
            {post.isPaid && (
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                {post.price} STRK
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {post.likeCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
