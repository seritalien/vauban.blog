'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { format } from 'date-fns';
import { VerifiedPost } from '@/hooks/use-posts';
import { getProfile, getDisplayName, toAddressString } from '@/lib/profiles';

interface ArticleGridProps {
  posts: VerifiedPost[];
  variant?: 'default' | 'compact';
}

function ArticleCard({ post, index, variant = 'default' }: { post: VerifiedPost; index: number; variant?: 'default' | 'compact' }) {
  const authorAddress = toAddressString(post.author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(post.author, profile);

  if (variant === 'compact') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex gap-4 group"
      >
        {post.coverImage && (
          <Link href={`/articles/${post.id}`} className="flex-shrink-0">
            <img
              src={post.coverImage}
              alt={post.title || 'Article'}
              className="w-24 h-24 rounded-lg object-cover group-hover:opacity-90 transition-opacity"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <Link href={`/articles/${post.id}`}>
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {post.title || 'Untitled'}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
            {post.excerpt}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{format(post.createdAt, 'MMM d')}</span>
            {post.readingTimeMinutes && (
              <>
                <span>·</span>
                <span>{post.readingTimeMinutes} min</span>
              </>
            )}
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
    >
      {/* Cover Image */}
      {post.coverImage && (
        <Link href={`/articles/${post.id}`} className="block relative h-48 overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title || 'Article'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {post.isVerified && (
              <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>
          {post.isPaid && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full">
              {post.price} STRK
            </div>
          )}
        </Link>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <Link href={`/articles/${post.id}`}>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {post.title || 'Untitled'}
          </h3>
        </Link>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {post.excerpt}
          </p>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          {/* Author */}
          <Link
            href={`/authors/${authorAddress}`}
            className="flex items-center gap-2 group/author"
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover/author:text-blue-600 dark:group-hover/author:text-blue-400 transition-colors truncate max-w-[120px]">
              {displayName}
            </span>
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <time dateTime={post.createdAt.toISOString()}>
              {format(post.createdAt, 'MMM d')}
            </time>
            {post.readingTimeMinutes && (
              <span>{post.readingTimeMinutes} min</span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function ArticleGrid({ posts, variant = 'default' }: ArticleGridProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No articles found</h3>
        <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or check back later.</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-6">
        {posts.map((post, index) => (
          <ArticleCard key={post.id} post={post} index={index} variant="compact" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post, index) => (
        <ArticleCard key={post.id} post={post} index={index} />
      ))}
    </div>
  );
}
