'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import { getProfile, formatAddress, getDisplayName, toAddressString } from '@/lib/profiles';
import { type AuthorProfile } from '@vauban/shared-types';
import { ArticleCardSkeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

export default function AuthorProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [profile, setProfile] = useState<AuthorProfile | null>(null);

  const { posts, isLoading, error } = usePosts(100, 0);

  // Filter posts by this author
  const authorPosts = useMemo(() => {
    if (!address) return [];
    const normalizedAddress = address.toLowerCase();
    return posts.filter(
      (post) => toAddressString(post.author) === normalizedAddress
    );
  }, [posts, address]);

  // Load profile
  useEffect(() => {
    if (address) {
      const authorProfile = getProfile(address);
      setProfile(authorProfile);
    }
  }, [address]);

  const displayName = getDisplayName(address, profile);
  const shortAddress = formatAddress(address);

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
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-12">
          {/* Avatar */}
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
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
          </div>

          {/* Stats */}
          <div className="flex gap-6 sm:flex-col sm:gap-2 text-center">
            <div>
              <div className="text-2xl font-bold">{authorPosts.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Articles</div>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-2xl font-bold mb-6">Articles</h2>

          {authorPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>This author hasn&apos;t published any articles yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {authorPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ post }: { post: VerifiedPost }) {
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

          {post.isPaid && (
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
              {post.price} STRK
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
