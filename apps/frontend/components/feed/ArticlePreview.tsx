'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import EngagementBar from './EngagementBar';
import InlineComments from './InlineComments';
import { getProfile, getDisplayName, formatAddress, toAddressString } from '@/lib/profiles';

interface ArticlePreviewProps {
  id: string;
  author: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  createdAt: Date;
  readingTimeMinutes?: number;
  likesCount?: number;
  commentsCount?: number;
  isPaid?: boolean;
  price?: number;
  index?: number;
}

export default function ArticlePreview({
  id,
  author,
  title,
  excerpt,
  coverImage,
  tags = [],
  createdAt,
  readingTimeMinutes,
  likesCount = 0,
  commentsCount = 0,
  isPaid = false,
  price = 0,
  index = 0,
}: ArticlePreviewProps) {
  const [showComments, setShowComments] = useState(false);
  const authorAddress = toAddressString(author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(author, profile);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Link href={`/authors/${authorAddress}`} className="flex-shrink-0">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm hover:opacity-80 transition-opacity">
              {displayName[0].toUpperCase()}
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/authors/${authorAddress}`}
              className="font-semibold text-gray-900 dark:text-white hover:underline truncate"
            >
              {displayName}
            </Link>
            <Link
              href={`/authors/${authorAddress}`}
              className="text-gray-500 dark:text-gray-400 text-sm truncate"
            >
              @{formatAddress(authorAddress)}
            </Link>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>

          {/* Article badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              ARTICLE
            </span>
            {isPaid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                {price} STRK
              </span>
            )}
          </div>

          {/* Article card */}
          <Link
            href={`/articles/${id}`}
            className="block mt-3 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            {coverImage && (
              <div className="relative h-40 sm:h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={coverImage}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2">
                {title}
              </h3>
              {excerpt && (
                <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                  {excerpt}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {readingTimeMinutes && (
                  <span>{readingTimeMinutes} min read</span>
                )}
                {tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-blue-600 dark:text-blue-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center gap-1">
                Read full article
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Engagement bar */}
          <div className="mt-3">
            <EngagementBar
              postId={id}
              initialLikes={likesCount}
              initialComments={commentsCount}
              onComment={() => setShowComments(!showComments)}
            />
          </div>
        </div>

        {/* More options menu */}
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors self-start">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </button>
      </div>

      {/* Inline comments */}
      <InlineComments
        postId={id}
        isExpanded={showComments}
        onClose={() => setShowComments(false)}
        initialCount={commentsCount}
      />
    </motion.article>
  );
}
