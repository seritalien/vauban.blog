'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { usePosts } from '@/hooks/use-posts';
import { POST_TYPE_ARTICLE } from '@vauban/shared-types';
import { getProfile, getDisplayName, toAddressString } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface MonthGroup {
  key: string; // "2025-12"
  label: string; // "December 2025"
  posts: Array<{
    id: string;
    title: string;
    author: string;
    createdAt: Date;
    excerpt?: string;
    tags?: string[];
    coverImage?: string;
  }>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ArchivePage() {
  const { posts, isLoading } = usePosts(200, 0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Filter to articles only and group by month
  const { monthGroups, allTags, totalArticles } = useMemo(() => {
    const articles = posts.filter((p) => {
      const isArticle = (p.postType ?? POST_TYPE_ARTICLE) === POST_TYPE_ARTICLE;
      if (!isArticle) return false;
      if (selectedTag && !(p.tags ?? []).includes(selectedTag)) return false;
      return true;
    });

    // Collect all tags
    const tagSet = new Set<string>();
    posts
      .filter((p) => (p.postType ?? POST_TYPE_ARTICLE) === POST_TYPE_ARTICLE)
      .forEach((p) => (p.tags ?? []).forEach((t) => tagSet.add(t)));

    // Group by month
    const groups: Record<string, MonthGroup> = {};
    articles.forEach((post) => {
      if (!post.createdAt) return;
      const key = format(post.createdAt, 'yyyy-MM');
      if (!groups[key]) {
        groups[key] = {
          key,
          label: format(post.createdAt, 'MMMM yyyy'),
          posts: [],
        };
      }
      groups[key].posts.push({
        id: post.id,
        title: post.title ?? 'Untitled',
        author: post.author,
        createdAt: post.createdAt,
        excerpt: post.excerpt,
        tags: post.tags,
        coverImage: post.coverImage,
      });
    });

    // Sort months descending
    const sorted = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

    return {
      monthGroups: sorted,
      allTags: Array.from(tagSet).sort(),
      totalArticles: articles.length,
    };
  }, [posts, selectedTag]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              Home
            </Link>
            <span>/</span>
            <span>Archive</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Archive
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {totalArticles} {totalArticles === 1 ? 'article' : 'articles'} published
          </p>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectedTag === null
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    selectedTag === tag
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && monthGroups.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {selectedTag ? `No articles tagged "${selectedTag}"` : 'No articles yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {selectedTag
                ? 'Try a different tag or view all articles.'
                : 'Articles will appear here once published.'}
            </p>
          </div>
        )}

        {/* Month groups */}
        <div className="space-y-10">
          {monthGroups.map((group) => (
            <motion.section
              key={group.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                {group.label}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({group.posts.length})
                </span>
              </h2>

              <div className="space-y-3">
                {group.posts.map((post) => (
                  <ArchiveItem key={post.id} post={post} />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ARCHIVE ITEM
// =============================================================================

function ArchiveItem({ post }: {
  post: {
    id: string;
    title: string;
    author: string;
    createdAt: Date;
    excerpt?: string;
    tags?: string[];
    coverImage?: string;
  };
}) {
  const authorAddress = toAddressString(post.author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(post.author, profile);

  return (
    <Link
      href={`/articles/${post.id}`}
      className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group"
    >
      {/* Date */}
      <div className="flex-shrink-0 w-12 text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {format(post.createdAt, 'd')}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
          {format(post.createdAt, 'MMM')}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
          <span>by {displayName}</span>
          {post.tags && post.tags.length > 0 && (
            <>
              <span>·</span>
              <span>{post.tags.slice(0, 3).join(', ')}</span>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {post.coverImage && (
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
          <img
            src={post.coverImage}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </Link>
  );
}
